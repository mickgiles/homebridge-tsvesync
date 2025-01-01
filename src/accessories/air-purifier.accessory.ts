import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncAirPurifier } from '../types/device.types';

export class AirPurifierAccessory extends BaseAccessory {
  private readonly capabilities: DeviceCapabilities;
  protected readonly device: VeSyncAirPurifier;

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncAirPurifier
  ) {
    super(platform, accessory, device);
    this.device = device;
    this.capabilities = this.getDeviceCapabilities();
  }

  /**
   * Set up the air purifier service
   */
  protected setupService(): void {
    // Get or create the air purifier service
    this.service = this.accessory.getService(this.platform.Service.AirPurifier) ||
      this.accessory.addService(this.platform.Service.AirPurifier);

    // Set up required characteristics
    this.setupCharacteristic(
      this.platform.Characteristic.Active,
      this.getActive.bind(this),
      this.setActive.bind(this)
    );

    this.setupCharacteristic(
      this.platform.Characteristic.CurrentAirPurifierState,
      this.getCurrentAirPurifierState.bind(this)
    );

    this.setupCharacteristic(
      this.platform.Characteristic.TargetAirPurifierState,
      this.getTargetAirPurifierState.bind(this),
      this.setTargetAirPurifierState.bind(this)
    );

    // Set up optional characteristics based on device capabilities
    const capabilities = this.getDeviceCapabilities();

    if (capabilities.hasAirQuality) {
      // Create a separate Air Quality service for air quality characteristics
      const airQualityService = this.accessory.getService(this.platform.Service.AirQualitySensor) ||
        this.accessory.addService(this.platform.Service.AirQualitySensor);

      // Add air quality characteristics to the Air Quality service
      this.setupCharacteristic(
        this.platform.Characteristic.AirQuality,
        this.getAirQuality.bind(this),
        undefined,
        undefined,
        airQualityService
      );

      this.setupCharacteristic(
        this.platform.Characteristic.PM2_5Density,
        this.getPM25Density.bind(this),
        undefined,
        undefined,
        airQualityService
      );
    }

    if (capabilities.hasSpeed) {
      this.setupCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        this.getRotationSpeed.bind(this),
        this.handleSetRotationSpeed.bind(this)
      );
    }

    if (capabilities.hasChildLock) {
      this.setupCharacteristic(
        this.platform.Characteristic.LockPhysicalControls,
        this.getLockPhysicalControls.bind(this),
        this.setLockPhysicalControls.bind(this)
      );
    }

    // Add filter maintenance characteristics
    this.setupCharacteristic(
      this.platform.Characteristic.FilterChangeIndication,
      this.getFilterChangeIndication.bind(this)
    );

    this.setupCharacteristic(
      this.platform.Characteristic.FilterLifeLevel,
      this.getFilterLifeLevel.bind(this)
    );

    // Add Name characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.Name,
      async () => this.device.deviceName
    );
  }

  /**
   * Get device capabilities
   */
  protected getDeviceCapabilities(): DeviceCapabilities {
    return {
      hasSpeed: true,
      hasAirQuality: true,
      hasChildLock: true,
      hasBrightness: false,
      hasColorTemp: false,
      hasColor: false,
      hasHumidity: false,
      hasWaterLevel: false,
      hasSwingMode: false,
    };
  }

  /**
   * Update device states based on the latest details
   */
  protected async updateDeviceSpecificStates(details: any): Promise<void> {
    // Update power state
    const isOn = details.enabled;
    this.service.updateCharacteristic(this.platform.Characteristic.Active, isOn ? 1 : 0);
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, isOn ? 2 : 0);

    // Update rotation speed
    const speed = details.speed;
    const rotationSpeed = Math.round((speed / this.device.maxSpeed) * 100);
    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, rotationSpeed);

    // Update air quality if available
    if (this.capabilities.hasAirQuality) {
      const pm25 = details.airQuality?.pm25 ?? 0;
      const airQuality = this.convertAirQualityToHomeKit(pm25);
      this.service.updateCharacteristic(this.platform.Characteristic.AirQuality, airQuality);
      this.service.updateCharacteristic(this.platform.Characteristic.PM2_5Density, pm25);
    }

    // Update filter life if available
    if (details.filterLife !== undefined) {
      const filterLife = details.filterLife;
      this.service.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, filterLife);
      this.service.updateCharacteristic(
        this.platform.Characteristic.FilterChangeIndication,
        filterLife <= 20 ? 1 : 0
      );
    }

    // Update device state based on activity
    this.updatePollingState(isOn);
  }

  /**
   * Handle set active state
   */
  private async handleSetActive(value: CharacteristicValue): Promise<void> {
    try {
      const newState = value as number;
      if (newState === 1) {
        await this.device.turnOn();
      } else {
        await this.device.turnOff();
      }
    } catch (err) {
      await this.handleDeviceError('set active state', err);
      throw err;
    }
  }

  /**
   * Handle set target state
   */
  private async handleSetTargetState(value: CharacteristicValue): Promise<void> {
    try {
      const newState = value as number;
      if (this.device.setMode) {
        await this.device.setMode(newState === 1 ? 'auto' : 'manual');
      }
    } catch (err) {
      await this.handleDeviceError('set target state', err);
      throw err;
    }
  }

  /**
   * Handle set rotation speed
   */
  private async handleSetRotationSpeed(value: CharacteristicValue): Promise<void> {
    const percentage = value as number;
    
    if (percentage === 0) {
      // Turn off the device instead of setting speed to 0
      await this.withRetry(async () => {
        await this.device.turnOff();
      }, 'turn off device');
      return;
    }

    // Convert HomeKit percentage (0-100) to device speed (1-5)
    let speed: number;
    if (percentage <= 20) {
      speed = 1; // Sleep
    } else if (percentage <= 40) {
      speed = 2; // Low
    } else if (percentage <= 60) {
      speed = 3; // Medium
    } else if (percentage <= 80) {
      speed = 4; // High
    } else {
      speed = 5; // Turbo
    }

    await this.withRetry(async () => {
      await this.device.changeFanSpeed(speed);
    }, 'set rotation speed');
  }

  /**
   * Handle set child lock
   */
  private async handleSetChildLock(value: CharacteristicValue): Promise<void> {
    try {
      const enabled = value as number === 1;
      if (this.device.setChildLock) {
        await this.device.setChildLock(enabled);
      }
    } catch (err) {
      await this.handleDeviceError('set child lock', err);
      throw err;
    }
  }

  private async getActive(): Promise<CharacteristicValue> {
    return this.device.deviceStatus === 'on' ? 1 : 0;
  }

  private async setActive(value: CharacteristicValue): Promise<void> {
    try {
      const isOn = value as number === 1;
      const success = isOn ? await this.device.turnOn() : await this.device.turnOff();
      
      if (!success) {
        throw new Error(`Failed to turn ${isOn ? 'on' : 'off'} device`);
      }
      
      await this.persistDeviceState('deviceStatus', isOn ? 'on' : 'off');
    } catch (error) {
      this.handleDeviceError('set active state', error);
    }
  }

  private async getCurrentAirPurifierState(): Promise<CharacteristicValue> {
    return this.device.deviceStatus === 'on' ? 2 : 0; // 0 = INACTIVE, 2 = PURIFYING_AIR
  }

  private async getTargetAirPurifierState(): Promise<CharacteristicValue> {
    return this.device.mode === 'auto' ? 1 : 0; // 0 = MANUAL, 1 = AUTO
  }

  private async setTargetAirPurifierState(value: CharacteristicValue): Promise<void> {
    try {
      const mode = value as number === 1 ? 'auto' : 'manual';
      const success = await this.device.setMode(mode);
      
      if (!success) {
        throw new Error(`Failed to set mode to ${mode}`);
      }
      
      await this.persistDeviceState('mode', mode);
    } catch (error) {
      this.handleDeviceError('set target state', error);
    }
  }

  private async getAirQuality(): Promise<CharacteristicValue> {
    return this.device.airQuality !== undefined && this.device.airQuality !== null
      ? this.convertAirQualityToHomeKit(this.device.airQuality)
      : 0;
  }

  private async getPM25Density(): Promise<CharacteristicValue> {
    // First try to get PM2.5 specific value
    if (typeof this.device.pm25 === 'number' && !isNaN(this.device.pm25)) {
      return this.device.pm25;
    }
    
    // Fall back to general air quality value if available
    if (typeof this.device.airQuality === 'number' && !isNaN(this.device.airQuality)) {
      return this.device.airQuality;
    }
    
    // Return 0 if no valid value is available
    return 0;
  }

  /**
   * Get rotation speed
   */
  private async getRotationSpeed(): Promise<CharacteristicValue> {
    if (this.device.speed === undefined || this.device.speed === null) {
      return 0;
    }

    // Convert device speed (1-5) to HomeKit percentage (0-100)
    switch (this.device.speed) {
      case 0: return 0;   // Off
      case 1: return 20;  // Sleep
      case 2: return 40;  // Low
      case 3: return 60;  // Medium
      case 4: return 80;  // High
      case 5: return 100; // Turbo
      default: return 0;
    }
  }

  private async getLockPhysicalControls(): Promise<CharacteristicValue> {
    return this.device.childLock ? 1 : 0;
  }

  private async setLockPhysicalControls(value: CharacteristicValue): Promise<void> {
    try {
      if (!this.device.setChildLock) {
        throw new Error('Device does not support child lock');
      }
      
      const enabled = value as number === 1;
      const success = await this.device.setChildLock(enabled);
      
      if (!success) {
        throw new Error(`Failed to ${enabled ? 'enable' : 'disable'} child lock`);
      }
      
      await this.persistDeviceState('childLock', enabled);
    } catch (error) {
      this.handleDeviceError('set child lock', error);
    }
  }

  private async getFilterChangeIndication(): Promise<CharacteristicValue> {
    return this.device.filterLife <= 20 ? 1 : 0;
  }

  private async getFilterLifeLevel(): Promise<CharacteristicValue> {
    return this.device.filterLife;
  }

  protected async updateRotationSpeed(speed: number): Promise<void> {
    await this.withRetry(async () => {
      await this.device.changeFanSpeed(speed);
    }, 'update rotation speed');
  }
} 