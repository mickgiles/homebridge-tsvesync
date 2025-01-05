import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncFan } from '../types/device.types';

// Constants for fan direction
const CLOCKWISE = 1;
const COUNTER_CLOCKWISE = 0;

export class FanAccessory extends BaseAccessory {
  protected readonly device: VeSyncFan;
  private readonly capabilities: DeviceCapabilities;

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncFan
  ) {
    super(platform, accessory, device);
    this.device = device;
    this.capabilities = this.getDeviceCapabilities();
  }

  protected setupService(): void {
    // Get or create the fan service
    this.service = this.accessory.getService(this.platform.Service.Fanv2) ||
      this.accessory.addService(this.platform.Service.Fanv2);

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
    const fanDetails = details as {
      deviceStatus: string;
      speed: number;
    };

    // Update active state
    const isActive = fanDetails.deviceStatus === 'on';
    this.updateCharacteristicValue(
      this.platform.Characteristic.Active,
      isActive ? 1 : 0
    );

    // Update rotation speed - convert device speed (1-5) to HomeKit percentage (0-100)
    let rotationSpeed = 0;
    if (isActive && fanDetails.speed !== undefined) {
      switch (fanDetails.speed) {
        case 1: rotationSpeed = 20; break;  // Sleep
        case 2: rotationSpeed = 40; break;  // Low
        case 3: rotationSpeed = 60; break;  // Medium
        case 4: rotationSpeed = 80; break;  // High
        case 5: rotationSpeed = 100; break; // Turbo
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
      hasHumidity: false,
      hasAirQuality: false,
      hasWaterLevel: false,
      hasChildLock: true,
      hasSwingMode: true,
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

  private async getRotationDirection(): Promise<CharacteristicValue> {
    return 'rotationDirection' in this.device && this.device.rotationDirection === 'clockwise' 
      ? CLOCKWISE 
      : COUNTER_CLOCKWISE;
  }

  private async setRotationDirection(value: CharacteristicValue): Promise<void> {
    try {
      if (!('setRotationDirection' in this.device)) {
        throw new Error('Device does not support rotation direction');
      }

      const direction = value === CLOCKWISE ? 'clockwise' : 'counterclockwise';
      const success = await (this.device as any).setRotationDirection(direction);
      
      if (!success) {
        throw new Error(`Failed to set rotation direction to ${direction}`);
      }
      
      await this.persistDeviceState('rotationDirection', direction);
    } catch (error) {
      this.handleDeviceError('set rotation direction', error);
    }
  }

  private async getSwingMode(): Promise<CharacteristicValue> {
    return this.device.swingMode ? 1 : 0;
  }

  private async setSwingMode(value: CharacteristicValue): Promise<void> {
    try {
      if (!this.device.setSwingMode) {
        throw new Error('Device does not support swing mode');
      }
      
      const enabled = value as number === 1;
      const success = await this.device.setSwingMode(enabled);
      
      if (!success) {
        throw new Error(`Failed to ${enabled ? 'enable' : 'disable'} swing mode`);
      }
      
      await this.persistDeviceState('swingMode', enabled);
    } catch (error) {
      this.handleDeviceError('set swing mode', error);
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
} 