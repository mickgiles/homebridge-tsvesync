import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncFan } from '../types/device.types';

// Constants for fan direction
const CLOCKWISE = 0;
const COUNTER_CLOCKWISE = 1;

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

    // Set up optional characteristics based on device capabilities
    const capabilities = this.getDeviceCapabilities();

    if (capabilities.hasSpeed) {
      this.setupCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        this.getRotationSpeed.bind(this),
        this.handleSetRotationSpeed.bind(this)
      );
    }

    // Add rotation direction (if supported by the device)
    if ('setRotationDirection' in this.device) {
      this.setupCharacteristic(
        this.platform.Characteristic.RotationDirection,
        this.getRotationDirection.bind(this),
        this.setRotationDirection.bind(this)
      );
    }

    if (capabilities.hasSwingMode) {
      this.setupCharacteristic(
        this.platform.Characteristic.SwingMode,
        this.getSwingMode.bind(this),
        this.setSwingMode.bind(this)
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
    const fanDetails = details as {
      deviceStatus: string;
      speed: number;
      childLock: boolean;
      swingMode: boolean;
    };

    // Update active state
    const isActive = fanDetails.deviceStatus === 'on';
    this.updateCharacteristicValue(
      this.platform.Characteristic.Active,
      isActive ? 1 : 0
    );

    // Update rotation speed if supported
    if (this.capabilities.hasSpeed) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.RotationSpeed,
        fanDetails.speed
      );
    }

    // Update child lock if supported
    if (this.capabilities.hasChildLock) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.LockPhysicalControls,
        fanDetails.childLock ? 1 : 0
      );
    }

    // Update swing mode if supported
    if (this.capabilities.hasSwingMode) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.SwingMode,
        fanDetails.swingMode ? 1 : 0
      );
    }

    // Update polling state based on active status
    this.updatePollingState(isActive);
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
      
      await this.persistDeviceState('deviceStatus', isOn ? 'on' : 'off');
    } catch (error) {
      this.handleDeviceError('set active state', error);
    }
  }

  private async handleSetRotationSpeed(value: CharacteristicValue): Promise<void> {
    const speed = Math.round((value as number / 100) * this.device.maxSpeed);
    await this.withRetry(async () => {
      await this.device.changeFanSpeed(speed);
    }, 'set rotation speed');
  }

  private async getRotationSpeed(): Promise<CharacteristicValue> {
    return (this.device.speed / this.device.maxSpeed) * 100;
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