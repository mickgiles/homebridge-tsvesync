import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
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
      this.platform.config.debug
    );

    this.pollingManager = new PollingManager(
      this.getDeviceType(),
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
    this.logger.operationStart(context);

    try {
      // Use platform's token refresh wrapper
      const result = await this.platform.withTokenRefresh(async () => {
        return await this.retryManager.execute(operation, {
          deviceName: this.device.deviceName,
          operation: operationName,
        });
      });

      this.logger.operationEnd(context);
      return result;
    } catch (error) {
      this.logger.operationEnd(context, error as Error);
      await this.handleDeviceError(
        `Failed to ${operationName}`,
        error instanceof Error ? error : new Error(String(error))
      );
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
      // Initialize the device state
      await this.initializeDeviceState();
      this.isInitialized = true;
      this.logger.info('Accessory initialized', this.getLogContext());
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to initialize device state', this.getLogContext(), err);
    } finally {
      this.isInitializing = false;
      // Signal initialization completion regardless of success
      this.initializationResolver();
    }
  }

  /**
   * Initialize the device state
   */
  private async initializeDeviceState(): Promise<void> {
    try {
      // Wait for platform to be ready
      if (typeof this.platform.isReady === 'function') {
        await this.platform.isReady();
      }
      
      // Attempt to get initial device state
      await this.syncDeviceState();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn('Failed to get initial device state, will retry during polling', this.getLogContext());
      throw err;
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

    // Start polling for updates
    this.startPolling();
  }

  /**
   * Start polling for device updates
   */
  protected startPolling(): void {
    this.pollingManager.startPolling(async () => {
      try {
        // Wait for initialization before starting polling
        await this.initializationPromise;
        
        // Wait for platform to be ready
        if (typeof this.platform.isReady === 'function') {
          await this.platform.isReady();
        }

        if (!this.isInitialized) {
          // If not initialized, try to initialize first
          await this.initializeDeviceState();
        } else {
          await this.syncDeviceState();
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error('Failed during polling', this.getLogContext(), err);
      }
    });
  }

  /**
   * Stop polling for device updates
   */
  protected stopPolling(): void {
    this.pollingManager.stopPolling();
  }

  /**
   * Update the polling manager with the device's active state
   */
  protected updatePollingState(isActive: boolean): void {
    this.pollingManager.updateDeviceState(isActive);
  }

  /**
   * Sync the device state with VeSync
   */
  public async syncDeviceState(): Promise<void> {
    try {
      if (this.needsRetry) {
        this.platform.log.debug(`[${this.accessory.displayName}] Retrying previous failed operation`);
      }
      
      await this.withRetry(
        async () => {
          // First try to get device details
          const details = await this.device.getDetails();
          
          if (!details) {
            throw new Error('Failed to get device details');
          }
          
          // Then update device state with the details
          await this.updateDeviceSpecificStates(details);
          
          // Clear retry flag on success
          this.needsRetry = false;
        },
        'sync device state'
      );
    } catch (error) {
      // Set initialization state to false on error to force re-initialization
      if (!this.isInitialized) {
        this.logger.warn('Device not initialized, will retry initialization', this.getLogContext());
      }
      await this.handleDeviceError(
        'Failed to sync device state',
        error instanceof Error ? error : new Error(String(error))
      );
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
   * Helper method to set up a characteristic with get/set handlers
   */
  protected setupCharacteristic(
    characteristic: any,
    onGet?: () => Promise<CharacteristicValue>,
    onSet?: (value: CharacteristicValue) => Promise<void>,
    props?: Record<string, any>,
    service?: Service
  ): void {
    const targetService = service || this.service;
    const char = targetService.getCharacteristic(characteristic);
    
    if (onGet) {
      char.onGet(async () => {
        const context = this.getLogContext(
          'get characteristic',
          characteristic.name
        );
        
        try {
          const value = await this.withRetry(onGet, `get ${characteristic.name}`);
          this.logger.stateChange({ ...context, value } as LogContext);
          return value;
        } catch (error) {
          this.logger.error(
            'Failed to get characteristic value',
            context,
            error as Error
          );
          throw error;
        }
      });
    }
    
    if (onSet) {
      char.onSet(async (value) => {
        const context = this.getLogContext(
          'set characteristic',
          characteristic.name,
          value
        );
        
        try {
          await this.withRetry(
            () => onSet(value),
            `set ${characteristic.name} to ${value}`
          );
          this.logger.stateChange(context as LogContext);
        } catch (error) {
          this.logger.error(
            'Failed to set characteristic value',
            context,
            error as Error
          );
          throw error;
        }
      });
    }
    
    if (props) {
      char.setProps(props);
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
} 