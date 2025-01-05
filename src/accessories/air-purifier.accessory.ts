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

    // Set up speed control
    this.setupCharacteristic(
      this.platform.Characteristic.RotationSpeed,
      this.getRotationSpeed.bind(this),
      this.handleSetRotationSpeed.bind(this)
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

    // Update rotation speed
    const speed = details.speed ?? 0;
    const maxSpeed = this.device.maxSpeed ?? 5; // Default to 5 if maxSpeed is not defined
    const rotationSpeed = Math.round((speed / maxSpeed) * 100);
    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, rotationSpeed);
  }

  /**
   * Handle set rotation speed
   */
  private async handleSetRotationSpeed(value: CharacteristicValue): Promise<void> {
    const percentage = value as number;
    
    if (percentage === 0) {
      // Turn off the device instead of setting speed to 0
      await this.device.turnOff();
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

    await this.device.changeFanSpeed(speed);
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
} 