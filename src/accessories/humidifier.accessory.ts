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

    this.setupCharacteristic(
      this.platform.Characteristic.CurrentHumidifierDehumidifierState,
      this.getCurrentState.bind(this)
    );

    this.setupCharacteristic(
      this.platform.Characteristic.TargetHumidifierDehumidifierState,
      this.getTargetState.bind(this),
      this.setTargetState.bind(this)
    );

    this.setupCharacteristic(
      this.platform.Characteristic.CurrentRelativeHumidity,
      this.getCurrentHumidity.bind(this)
    );

    this.setupCharacteristic(
      this.platform.Characteristic.RelativeHumidityHumidifierThreshold,
      this.getTargetHumidity.bind(this),
      this.setTargetHumidity.bind(this)
    );

    // Set up optional characteristics based on device capabilities
    const capabilities = this.getDeviceCapabilities();

    if (capabilities.hasSpeed) {
      this.setupCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        this.getRotationSpeed.bind(this),
        this.handleSetRotationSpeed.bind(this)
      );
    }

    if (capabilities.hasWaterLevel) {
      this.setupCharacteristic(
        this.platform.Characteristic.WaterLevel,
        this.getWaterLevel.bind(this)
      );
    }

    if (capabilities.hasChildLock) {
      this.setupCharacteristic(
        this.platform.Characteristic.LockPhysicalControls,
        this.getLockPhysicalControls.bind(this),
        this.setLockPhysicalControls.bind(this)
      );
    }

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
      humidity: number;
      targetHumidity: number;
      speed: number;
      childLock: boolean;
      waterLevel: number;
    };

    // Update active state
    const isActive = humidifierDetails.deviceStatus === 'on';
    this.updateCharacteristicValue(
      this.platform.Characteristic.Active,
      isActive ? 1 : 0
    );

    // Update current state
    this.updateCharacteristicValue(
      this.platform.Characteristic.CurrentHumidifierDehumidifierState,
      isActive ? 2 : 0
    );

    // Update target state
    this.updateCharacteristicValue(
      this.platform.Characteristic.TargetHumidifierDehumidifierState,
      1 // Always HUMIDIFIER for these devices
    );

    // Update current humidity
    if (humidifierDetails.humidity !== undefined) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.CurrentRelativeHumidity,
        humidifierDetails.humidity
      );
    }

    // Update target humidity
    if (humidifierDetails.targetHumidity !== undefined) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.RelativeHumidityHumidifierThreshold,
        humidifierDetails.targetHumidity
      );
    }

    // Update rotation speed if supported
    if (this.capabilities.hasSpeed) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.RotationSpeed,
        humidifierDetails.speed
      );
    }

    // Update child lock if supported
    if (this.capabilities.hasChildLock) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.LockPhysicalControls,
        humidifierDetails.childLock ? 1 : 0
      );
    }

    // Update water level if supported
    if (this.capabilities.hasWaterLevel && humidifierDetails.waterLevel !== undefined) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.WaterLevel,
        humidifierDetails.waterLevel
      );
    }
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
      
      await this.persistDeviceState('deviceStatus', isOn ? 'on' : 'off');
    } catch (error) {
      this.handleDeviceError('set active state', error);
    }
  }

  private async getCurrentState(): Promise<CharacteristicValue> {
    return this.device.deviceStatus === 'on' ? 2 : 0; // 0 = INACTIVE, 2 = HUMIDIFYING
  }

  private async getTargetState(): Promise<CharacteristicValue> {
    return 1; // 1 = HUMIDIFIER (we only support humidifier mode)
  }

  private async setTargetState(value: CharacteristicValue): Promise<void> {
    // No-op as we only support humidifier mode
    if (value !== 1) {
      throw new Error('Only humidifier mode is supported');
    }
  }

  private async getCurrentHumidity(): Promise<CharacteristicValue> {
    return this.device.humidity;
  }

  private async getTargetHumidity(): Promise<CharacteristicValue> {
    return this.device.targetHumidity;
  }

  private async setTargetHumidity(value: CharacteristicValue): Promise<void> {
    try {
      const success = await this.device.setTargetHumidity(value as number);
      
      if (!success) {
        throw new Error(`Failed to set target humidity to ${value}`);
      }
      
      await this.persistDeviceState('targetHumidity', value);
    } catch (error) {
      this.handleDeviceError('set target humidity', error);
    }
  }

  private async handleSetRotationSpeed(value: CharacteristicValue): Promise<void> {
    const percentage = value as number;
    
    if (percentage === 0) {
      // Turn off the device instead of setting speed to 0
      await this.withRetry(async () => {
        await this.device.turnOff();
      }, 'turn off device');
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

    await this.withRetry(async () => {
      await this.device.changeFanSpeed(speed);
    }, 'set rotation speed');
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

  private async getWaterLevel(): Promise<CharacteristicValue> {
    return this.device.waterLevel || 0;
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