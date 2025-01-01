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

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncDeviceWithPower
  ) {
    this.platform = platform;
    this.accessory = accessory;
    this.device = device;

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

    this.logger.info('Accessory initialized', this.getLogContext());
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
      const result = await this.retryManager.execute(operation, {
        deviceName: this.device.deviceName,
        operation: operationName,
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
      await this.syncDeviceState();
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
  protected async syncDeviceState(): Promise<void> {
    try {
      if (this.needsRetry) {
        this.platform.log.debug(`[${this.accessory.displayName}] Retrying previous failed operation`);
      }
      
      await this.withRetry(
        async () => {
          // First try to get device details
          const details = await this.device.getDetails();
          
          // Then update device state with the details
          await this.updateDeviceSpecificStates(details);
          
          // Clear retry flag on success
          this.needsRetry = false;
        },
        'sync device state'
      );
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
  protected async handleDeviceError(operation: string, error: unknown): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const errorDetails = errorObj as any;
    const errorCode = errorDetails?.error?.code || errorDetails?.code;
    const errorMsg = errorDetails?.error?.msg || errorDetails?.msg || errorObj.message;
    
    // Log the error with context
    this.platform.log.error(
      `[${this.accessory.displayName}] ${operation}: ${errorMsg}`,
      errorDetails?.error || errorDetails || errorObj
    );

    // Handle specific error codes
    switch (errorCode) {
      case 4041008: // Device not found
        this.platform.log.warn(`[${this.accessory.displayName}] Device not found, will attempt to rediscover`);
        await this.attemptReconnection();
        break;
      case -11102086: // Internal error
        this.platform.log.warn(`[${this.accessory.displayName}] VeSync API internal error, will retry later`);
        this.markForRetry();
        break;
      default:
        if (errorMsg?.includes('not found') || errorMsg?.includes('undefined') || !errorMsg) {
          this.platform.log.warn(`[${this.accessory.displayName}] Connection issue detected, attempting to reconnect`);
          await this.attemptReconnection();
        } else {
          this.markForRetry();
        }
    }
  }

  /**
   * Attempt to reconnect to the device by triggering device discovery
   */
  private async attemptReconnection(): Promise<void> {
    try {
      // Attempt to refresh the device list
      await this.platform.discoverDevices();
      this.platform.log.info(`[${this.accessory.displayName}] Successfully refreshed device list`);
    } catch (error) {
      this.platform.log.error(`[${this.accessory.displayName}] Failed to reconnect: ${error}`);
    }
  }

  /**
   * Mark the device for retry on next update cycle
   */
  private markForRetry(): void {
    this.needsRetry = true;
  }
} 