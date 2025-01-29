import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncFan } from '../types/device.types';

// Constants for fan direction
const CLOCKWISE = 1;
const COUNTER_CLOCKWISE = 0;

// Constants for fan modes
const MODE_NORMAL = 0;
const MODE_AUTO = 1;
const MODE_SLEEP = 2;
const MODE_TURBO = 3;

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

    // Set up mode control
    this.setupCharacteristic(
      this.platform.Characteristic.SwingMode,
      this.getSwingMode.bind(this),
      this.setSwingMode.bind(this)
    );

    // Set up rotation direction
    this.setupCharacteristic(
      this.platform.Characteristic.RotationDirection,
      this.getRotationDirection.bind(this),
      this.setRotationDirection.bind(this)
    );

    // Set up child lock
    this.setupCharacteristic(
      this.platform.Characteristic.LockPhysicalControls,
      this.getLockPhysicalControls.bind(this),
      this.setLockPhysicalControls.bind(this)
    );

    // Add mode control service
    const modeService = this.accessory.getService('Fan Mode') ||
      this.accessory.addService(this.platform.Service.Switch, 'Fan Mode', 'fan-mode');

    // Set up mode characteristics
    modeService.getCharacteristic(this.platform.Characteristic.On)
      .onGet(() => this.getMode())
      .onSet((value) => this.setMode(value));

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
      mode: 'normal' | 'auto' | 'sleep' | 'turbo';
      oscillationState: boolean;
    };

    // Update active state
    const isActive = fanDetails.deviceStatus === 'on';
    this.updateCharacteristicValue(
      this.platform.Characteristic.Active,
      isActive ? 1 : 0
    );

    // Update current state (INACTIVE = 0, IDLE = 1, BLOWING_AIR = 2)
    this.updateCharacteristicValue(
      this.platform.Characteristic.CurrentFanState,
      isActive ? 2 : 0
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

    // Update oscillation status
    if ('oscillationState' in fanDetails) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.SwingMode,
        fanDetails.oscillationState ? 1 : 0
      );
    }

    // Update mode
    const modeService = this.accessory.getService('Fan Mode');
    if (modeService && fanDetails.mode) {
      modeService.setCharacteristic(
        this.platform.Characteristic.On,
        this.getModeValue(fanDetails.mode)
      );
    }
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
    return 'oscillation' in this.device && this.device.oscillation
      ? CLOCKWISE 
      : COUNTER_CLOCKWISE;
  }

  private async setRotationDirection(value: CharacteristicValue): Promise<void> {
    try {
      if (!('setOscillation' in this.device)) {
        throw new Error('Device does not support oscillation');
      }

      // Map CLOCKWISE to oscillation ON, COUNTER_CLOCKWISE to oscillation OFF
      const shouldOscillate = value === CLOCKWISE;
      const success = await (this.device as any).setOscillation(shouldOscillate);
      
      if (!success) {
        throw new Error(`Failed to ${shouldOscillate ? 'enable' : 'disable'} oscillation`);
      }
    } catch (error) {
      this.handleDeviceError('set rotation direction', error);
      throw error;
    }
  }

  private async getSwingMode(): Promise<CharacteristicValue> {
    return this.device.oscillationState ? 1 : 0;
  }

  private async setSwingMode(value: CharacteristicValue): Promise<void> {
    try {
      if (!this.device.setOscillation) {
        throw new Error('Device does not support oscillation');
      }
      
      const enabled = value as number === 1;
      const success = await this.device.setOscillation(enabled);
      
      if (!success) {
        throw new Error(`Failed to ${enabled ? 'enable' : 'disable'} oscillation`);
      }
      
      await this.persistDeviceState('oscillationState', enabled);
    } catch (error) {
      this.handleDeviceError('set oscillation', error);
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

  private getModeValue(mode: 'normal' | 'auto' | 'sleep' | 'turbo'): number {
    switch (mode) {
      case 'normal': return MODE_NORMAL;
      case 'auto': return MODE_AUTO;
      case 'sleep': return MODE_SLEEP;
      case 'turbo': return MODE_TURBO;
      default: return MODE_NORMAL;
    }
  }

  private getModeString(value: number): 'normal' | 'auto' | 'sleep' | 'turbo' {
    switch (value) {
      case MODE_AUTO: return 'auto';
      case MODE_SLEEP: return 'sleep';
      case MODE_TURBO: return 'turbo';
      default: return 'normal';
    }
  }

  private async getMode(): Promise<CharacteristicValue> {
    return this.getModeValue(this.device.mode || 'normal');
  }

  private async setMode(value: CharacteristicValue): Promise<void> {
    try {
      const mode = this.getModeString(value as number);
      const success = await this.device.setMode(mode);
      
      if (!success) {
        throw new Error(`Failed to set mode to ${mode}`);
      }
      
      await this.persistDeviceState('mode', mode);
    } catch (error) {
      this.handleDeviceError('set mode', error);
    }
  }
} 