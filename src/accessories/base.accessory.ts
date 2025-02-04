import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncDeviceWithPower } from '../types/device.types';
import { RetryManager } from '../utils/retry';
import { LogContext, PluginLogger } from '../utils/logger';

export abstract class BaseAccessory {
  protected service!: Service;
  protected readonly platform: TSVESyncPlatform;
  protected readonly accessory: PlatformAccessory;
  protected readonly device: VeSyncDeviceWithPower;
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

    this.retryManager = new RetryManager(
      this.platform.log,
      this.platform.config.retry
    );

    // Note: setupAccessory is now called in initialize() instead of constructor
    this.logger.debug('Accessory created', this.getLogContext());
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
   * Set up the accessory services
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
      // Set up the accessory first
      this.setupAccessory();
      
      // Ensure platform is ready before proceeding
      await this.platform.isReady();
      
      // Update states using device info we already have from getDevices
      await this.updateDeviceSpecificStates(this.device);
      
      this.isInitialized = true;
      this.logger.debug('Accessory initialized', this.getLogContext());
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to initialize device state', this.getLogContext(), err);
    } finally {
      this.isInitializing = false;
      this.initializationResolver();
    }
  }

  /**
   * Sync the device state with VeSync
   */
  public async syncDeviceState(): Promise<void> {
    try {
      // Update states using the device's internal state
      await this.updateDeviceSpecificStates(this.device);
    } catch (error) {
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
          const value = await onGet();
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
          await onSet(value); 
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
    if (!this.service) {
      this.logger.debug('Service not initialized, calling setupAccessory', this.getLogContext());
      this.setupAccessory();
    }
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