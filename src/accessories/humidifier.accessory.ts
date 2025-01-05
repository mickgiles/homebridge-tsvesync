import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncHumidifier } from '../types/device.types';

export class HumidifierAccessory extends BaseAccessory {
  protected readonly device: VeSyncHumidifier;
  private readonly capabilities: DeviceCapabilities;

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncHumidifier
  ) {
    super(platform, accessory, device);
    this.device = device;
    this.capabilities = this.getDeviceCapabilities();
  }

  protected setupService(): void {
    // Get or create the humidifier service
    this.service = this.accessory.getService(this.platform.Service.HumidifierDehumidifier) ||
      this.accessory.addService(this.platform.Service.HumidifierDehumidifier);

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
   * Update device states based on the latest details
   */
  protected async updateDeviceSpecificStates(details: any): Promise<void> {
    const humidifierDetails = details as {
      deviceStatus: string;
      speed: number;
    };

    // Update active state
    const isActive = humidifierDetails.deviceStatus === 'on';
    this.updateCharacteristicValue(
      this.platform.Characteristic.Active,
      isActive ? 1 : 0
    );

    // Update rotation speed - convert device speed (1-9) to HomeKit percentage (0-100)
    let rotationSpeed = 0;
    if (isActive && humidifierDetails.speed !== undefined) {
      switch (humidifierDetails.speed) {
        case 1: rotationSpeed = 11; break;
        case 2: rotationSpeed = 22; break;
        case 3: rotationSpeed = 33; break;
        case 4: rotationSpeed = 44; break;
        case 5: rotationSpeed = 55; break;
        case 6: rotationSpeed = 66; break;
        case 7: rotationSpeed = 77; break;
        case 8: rotationSpeed = 88; break;
        case 9: rotationSpeed = 100; break;
      }
    }
    this.updateCharacteristicValue(
      this.platform.Characteristic.RotationSpeed,
      rotationSpeed
    );
  }

  protected getDeviceCapabilities(): DeviceCapabilities {
    return {
      hasBrightness: false,
      hasColorTemp: false,
      hasColor: false,
      hasSpeed: true,
      hasHumidity: true,
      hasAirQuality: false,
      hasWaterLevel: true,
      hasChildLock: true,
      hasSwingMode: false,
    };
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
      
      // Update device state and characteristics
      await this.updateDeviceSpecificStates(this.device);
      await this.persistDeviceState('deviceStatus', isOn ? 'on' : 'off');
    } catch (error) {
      this.handleDeviceError('set active state', error);
    }
  }

  private async getRotationSpeed(): Promise<CharacteristicValue> {
    if (this.device.speed === undefined || this.device.speed === null) {
      return 0;
    }

    // Convert device speed (1-9) to HomeKit percentage (0-100)
    switch (this.device.speed) {
      case 0: return 0;   // Off
      case 1: return 11;
      case 2: return 22;
      case 3: return 33;
      case 4: return 44;
      case 5: return 55;
      case 6: return 66;
      case 7: return 77;
      case 8: return 88;
      case 9: return 100;
      default: return 0;
    }
  }

  private async handleSetRotationSpeed(value: CharacteristicValue): Promise<void> {
    const percentage = value as number;
    
    if (percentage === 0) {
      // Turn off the device instead of setting speed to 0
      await this.device.turnOff();
      return;
    }

    // Convert HomeKit percentage (0-100) to device speed (1-9)
    let speed: number;
    if (percentage <= 11) {
      speed = 1;
    } else if (percentage <= 22) {
      speed = 2;
    } else if (percentage <= 33) {
      speed = 3;
    } else if (percentage <= 44) {
      speed = 4;
    } else if (percentage <= 55) {
      speed = 5;
    } else if (percentage <= 66) {
      speed = 6;
    } else if (percentage <= 77) {
      speed = 7;
    } else if (percentage <= 88) {
      speed = 8;
    } else {
      speed = 9;
    }

    await this.device.changeFanSpeed(speed);
  }
} 