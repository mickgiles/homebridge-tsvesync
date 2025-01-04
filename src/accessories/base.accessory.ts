import { CharacteristicValue, PlatformAccessory, Service, Characteristic, WithUUID } from 'homebridge';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncDeviceWithPower } from '../types/device.types';
import { PollingManager } from '../utils/polling-manager';
import { RetryManager } from '../utils/retry';
import { LogContext, PluginLogger } from '../utils/logger';

export abstract class BaseAccessory {
  protected service!: Service;
  protected readonly platform: TSVESyncPlatform;
  protected readonly accessory: PlatformAccessory;
  protected readonly device: VeSyncDeviceWithPower;
  private readonly pollingManager: PollingManager;
  private readonly retryManager: RetryManager;
  private readonly logger: PluginLogger;
  private needsRetry = false;
  private isInitialized = false;
  private initializationPromise: Promise<void>;
  private initializationResolver!: () => void;
  private isInitializing = false;
  private initializationAttempts = 0;
  private readonly maxInitializationAttempts = 5;

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncDeviceWithPower
  ) {
    this.platform = platform;
    this.accessory = accessory;
    this.device = device;

    // Create initialization promise
    this.initializationPromise = new Promise((resolve) => {
      this.initializationResolver = resolve;
    });

    // Initialize managers
    this.logger = new PluginLogger(
      this.platform.log,
      this.platform.debug
    );

    this.pollingManager = new PollingManager(
      this.platform.log,
      this.platform.config.polling
    );

    this.retryManager = new RetryManager(
      this.platform.log,
      this.platform.config.retry
    );

    // Set up the accessory
    this.setupAccessory();

    this.logger.info('Accessory created', this.getLogContext());
  }

  /**
   * Get base context for logging
   */
  private getLogContext(
    operation?: string,
    characteristic?: string,
    value?: any
  ): Partial<LogContext> {
    return {
      deviceName: this.device.deviceName,
      deviceType: this.getDeviceType(),
      operation,
      characteristic,
      value,
    };
  }

  /**
   * Execute an operation with retry logic
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const context = this.getLogContext(operationName);
    
    try {
      return await this.retryManager.execute(operation, {
        deviceName: this.device.deviceName,
        operation: operationName,
      });
    } catch (error) {
      // Don't log here - let the error propagate up to be logged at a higher level
      throw error;
    }
  }

  /**
   * Set up the device-specific service
   */
  protected abstract setupService(): void;

  /**
   * Update device-specific states
   */
  protected abstract updateDeviceSpecificStates(details: any): Promise<void>;

  /**
   * Update device states from platform
   */
  public async updateFromPlatform(details: any): Promise<void> {
    await this.updateDeviceSpecificStates(details);
  }

  /**
   * Get device capabilities
   */
  protected abstract getDeviceCapabilities(): DeviceCapabilities;

  /**
   * Get the device type for polling configuration
   */
  protected getDeviceType(): string {
    // Default implementation - override in subclasses if needed
    if (this.device.deviceType.toLowerCase().includes('air')) {
      return 'airPurifier';
    } else if (this.device.deviceType.toLowerCase().includes('humidifier')) {
      return 'humidifier';
    } else if (this.device.deviceType.toLowerCase().includes('fan')) {
      return 'fan';
    } else if (this.device.deviceType.toLowerCase().includes('bulb')) {
      return 'light';
    } else if (this.device.deviceType.toLowerCase().includes('outlet')) {
      return 'outlet';
    }
    return 'default';
  }

  /**
   * Initialize the accessory
   */
  public async initialize(): Promise<void> {
    if (this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    try {
      while (this.initializationAttempts < this.maxInitializationAttempts) {
        try {
          await this.initializeDeviceState();
          this.isInitialized = true;
          return;
        } catch (error) {
          this.initializationAttempts++;
          
          if (this.initializationAttempts >= this.maxInitializationAttempts) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`=== INIT: Failed to initialize accessory after ${this.maxInitializationAttempts} attempts ===`, this.getLogContext(), err);
            throw err;
          }
          
          const delay = Math.min(5000 * Math.pow(2, this.initializationAttempts - 1), 40000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } finally {
      this.isInitializing = false;
      this.initializationResolver();
    }
  }

  /**
   * Initialize the device state
   */
  private async initializeDeviceState(): Promise<void> {
    
    // Wait for platform to be ready
    if (typeof this.platform.isReady === 'function') {
      await this.platform.isReady();
    }
    
    // Attempt to get initial device state
    const success = await this.syncDeviceState();
    
    if (!success) {
      throw new Error('Failed to get initial device state - got null details');
    }
    
  }

  /**
   * Set up the accessory services and start polling
   */
  private setupAccessory(): void {
    // Set accessory information
    const infoService = this.accessory.getService(this.platform.Service.AccessoryInformation);
    if (infoService) {
      infoService
        .setCharacteristic(this.platform.Characteristic.Manufacturer, 'VeSync')
        .setCharacteristic(this.platform.Characteristic.Model, this.device.deviceType)
        .setCharacteristic(this.platform.Characteristic.SerialNumber, this.device.uuid);
    }

    // Set up device-specific service
    this.setupService();

    // Initialize the accessory
    this.initializationPromise.then(() => {
      if (!this.isInitialized) {
        this.logger.warn('=== INIT: Device failed to initialize ===', this.getLogContext());
      }
    });
  }

  /**
   * Sync the device state with VeSync
   */
  public async syncDeviceState(): Promise<boolean> {
    try {
      const details = await this.withRetry(
        async () => {
          await this.platform.updateDeviceStatesFromAPI();
            
          // After getDetails(), the device object should have updated internal state
          if (!this.device.deviceStatus) {
            return null;
          }
            
          await this.updateDeviceSpecificStates(this.device);
          return this.device;
        },
        'sync device state'
      );

      return details !== null;
    } catch (error) {
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Helper method to convert air quality values to HomeKit format
   */
  protected convertAirQualityToHomeKit(pm25: number): number {
    if (pm25 <= 12) return 1;  // EXCELLENT
    if (pm25 <= 35) return 2;  // GOOD
    if (pm25 <= 55) return 3;  // FAIR
    if (pm25 <= 150) return 4; // INFERIOR
    return 5;                  // POOR
  }

  /**
   * Set up a characteristic with get/set handlers
   */
  protected setupCharacteristic(
    characteristic: WithUUID<new () => Characteristic>,
    getter: () => CharacteristicValue | Promise<CharacteristicValue>,
    setter?: (value: CharacteristicValue) => Promise<void>,
  ): void {
    this.service
      .getCharacteristic(characteristic)
      .onGet(async () => {
        try {
          await this.platform.updateDeviceStatesFromAPI();
          return await Promise.resolve(getter());
        } catch (error) {
          this.logger.error('Failed to get characteristic value', {
            operation: 'getCharacteristic',
            deviceName: this.accessory.displayName,
            deviceType: this.device.deviceType,
            characteristic: characteristic.name,
          }, error as Error);
          throw error;
        }
      });

    if (setter) {
      this.service
        .getCharacteristic(characteristic)
        .onSet(async (value) => {
          try {
            await setter(value);
          } catch (error) {
            this.logger.error('Failed to set characteristic value', {
              operation: 'setCharacteristic',
              deviceName: this.accessory.displayName,
              deviceType: this.device.deviceType,
              characteristic: characteristic.name,
              value,
            }, error as Error);
            throw error;
          }
        });
    }
  }

  /**
   * Helper method to update a characteristic value
   */
  protected updateCharacteristicValue(
    characteristic: any,
    value: CharacteristicValue
  ): void {
    this.service.updateCharacteristic(characteristic, value);
    
    this.logger.stateChange({
      ...this.getLogContext('update characteristic', characteristic.name, value),
      deviceName: this.device.deviceName,
      deviceType: this.getDeviceType(),
    } as LogContext);
  }

  /**
   * Persist device state to accessory context
   */
  protected async persistDeviceState(key: string, value: unknown): Promise<void> {
    try {
      this.accessory.context.device = {
        ...this.accessory.context.device,
        details: {
          ...this.accessory.context.device?.details,
          [key]: value
        }
      };
      
      await this.platform.api.updatePlatformAccessories([this.accessory]);
      
      this.logger.debug(
        `Updated ${key} to ${value}`,
        this.getLogContext('persist state')
      );
    } catch (error) {
      this.handleDeviceError(`persist ${key} state`, error as Error);
    }
  }

  /**
   * Handle device errors with appropriate recovery actions
   */
  protected async handleDeviceError(message: string, error: Error | any): Promise<void> {
    const context = this.getLogContext();
    const retryCount = this.retryManager.getRetryCount();
    const wrappedError = error instanceof Error ? error : new Error(JSON.stringify(error));

    // Handle device not found error
    if (error?.error?.code === 4041008 || error?.error?.msg?.includes('Device not found')) {
      this.logger.warn('Device not found', context, wrappedError);
      return;
    }

    // Handle rate limit error
    if (error?.message?.includes('rate limit') || error?.message?.includes('429')) {
      this.logger.warn(`Hit API rate limit (attempt ${retryCount})`, context, wrappedError);
      return;
    }

    // Handle network errors
    if (error?.code?.startsWith('ECONN') || error?.code === 'ETIMEDOUT') {
      this.logger.warn('Network error', context, wrappedError);
      return;
    }

    // Handle other errors
    this.logger.error(message, context, wrappedError);
    this.needsRetry = true;
  }

  /**
   * Update polling state based on device activity
   */
  protected updatePollingState(isActive: boolean): void {
    this.pollingManager.updateDeviceStates(isActive);
  }

  /**
   * Get the current state of the device from the API
   */
  protected async getDeviceState(): Promise<void> {
    try {
      this.logger.debug('Getting device state', {
        operation: 'getDeviceState',
        deviceName: this.accessory.displayName,
        deviceType: this.device.deviceType,
      });
      await this.platform.updateDeviceStatesFromAPI();
      this.logger.debug('Successfully got device state', {
        operation: 'getDeviceState',
        deviceName: this.accessory.displayName,
        deviceType: this.device.deviceType,
      });
    } catch (error) {
      this.logger.error('Failed to get device state', {
        operation: 'getDeviceState',
        deviceName: this.accessory.displayName,
        deviceType: this.device.deviceType,
      }, error as Error);
      throw error;
    }
  }
} 