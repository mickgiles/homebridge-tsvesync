import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncAirPurifier } from '../types/device.types';

// Extended interface to include LV-series specific methods and properties
interface ExtendedVeSyncAirPurifier extends VeSyncAirPurifier {
  deviceType: string;
  // Override setMode from base interface to make it more specific
  setMode(mode: string): Promise<boolean>;
  // Add additional methods specific to LV-series
  autoMode?(): Promise<boolean>;
  manualMode?(): Promise<boolean>;
  sleepMode?(): Promise<boolean>;
  setDisplay?(on: boolean): Promise<boolean>;
  turnOnDisplay?(): Promise<boolean>;
  turnOffDisplay?(): Promise<boolean>;
  setChildLock?(enabled: boolean): Promise<boolean>;
  setOscillation?(enabled: boolean): Promise<boolean>;
  hasFeature?(feature: string): boolean;
  details?: {
    filter_life?: number;
    child_lock?: boolean;
    air_quality_value?: number;
    air_quality?: string;
    screen_status?: 'on' | 'off';
  };
}

export class AirPurifierAccessory extends BaseAccessory {
  private readonly capabilities: DeviceCapabilities;
  protected readonly device: VeSyncAirPurifier;
  private isLVSeries: boolean;

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncAirPurifier
  ) {
    super(platform, accessory, device);
    this.device = device;
    this.capabilities = this.getDeviceCapabilities();
    
    // Detect if this is an LV-series device (LV-PUR131S or LV-RH131S)
    const extendedDevice = this.device as ExtendedVeSyncAirPurifier;
    this.isLVSeries = extendedDevice.deviceType?.startsWith('LV-') || false;
    
    if (this.isLVSeries) {
      this.platform.log.debug(`Detected LV-series device: ${this.device.deviceName} (${extendedDevice.deviceType})`);
    }
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

    // Set up target state characteristic for mode mapping
    this.setupCharacteristic(
      this.platform.Characteristic.TargetAirPurifierState,
      this.getTargetState.bind(this),
      this.setTargetState.bind(this)
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
    const isOn = details.enabled || details.deviceStatus === 'on';
    this.service.updateCharacteristic(this.platform.Characteristic.Active, isOn ? 1 : 0);
    
    // Update current state (INACTIVE = 0, IDLE = 1, PURIFYING_AIR = 2)
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentAirPurifierState,
      isOn ? 2 : 0
    );

    // Get the extended device to access mode information
    const extendedDevice = this.device as ExtendedVeSyncAirPurifier;
    
    // Update target state (AUTO = 0, MANUAL = 1)
    // If mode is available, use it to determine target state
    let targetState = 1; // Default to MANUAL
    if (extendedDevice.mode) {
      targetState = extendedDevice.mode === 'auto' ? 0 : 1;
    }
    
    this.service.updateCharacteristic(
      this.platform.Characteristic.TargetAirPurifierState,
      targetState
    );

    // Update rotation speed
    let rotationSpeed = 0;
    if (isOn && details.speed !== undefined) {
      if (this.isLVSeries) {
        // For LV-series devices, speed is limited to 1-3
        // Convert device speed (1-3) to HomeKit percentage (0-100)
        switch (details.speed) {
          case 1: rotationSpeed = 33; break;  // Low
          case 2: rotationSpeed = 66; break;  // Medium
          case 3: rotationSpeed = 100; break; // High
        }
      } else {
        // For standard devices, speed can be 1-5
        // Convert device speed (1-5) to HomeKit percentage (0-100)
        switch (details.speed) {
          case 1: rotationSpeed = 20; break;  // Sleep
          case 2: rotationSpeed = 40; break;  // Low
          case 3: rotationSpeed = 60; break;  // Medium
          case 4: rotationSpeed = 80; break;  // High
          case 5: rotationSpeed = 100; break; // Turbo
        }
      }
    }
    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, rotationSpeed);
  }

  /**
   * Get target state (AUTO = 0, MANUAL = 1)
   */
  private async getTargetState(): Promise<CharacteristicValue> {
    const extendedDevice = this.device as ExtendedVeSyncAirPurifier;
    return extendedDevice.mode === 'auto' ? 0 : 1;
  }

  /**
   * Set target state (AUTO = 0, MANUAL = 1)
   */
  private async setTargetState(value: CharacteristicValue): Promise<void> {
    try {
      const targetState = value as number;
      const extendedDevice = this.device as ExtendedVeSyncAirPurifier;
      
      // Map HomeKit target states to device modes
      const mode = targetState === 0 ? 'auto' : 'manual';
      this.platform.log.debug(`Setting mode to ${mode} for device: ${this.device.deviceName}`);
      
      let success = false;
      
      // Use the appropriate method to set the mode
      if (targetState === 0 && typeof extendedDevice.autoMode === 'function') {
        success = await extendedDevice.autoMode();
      } else if (targetState === 1 && typeof extendedDevice.manualMode === 'function') {
        success = await extendedDevice.manualMode();
      } else if (typeof extendedDevice.setMode === 'function') {
        success = await extendedDevice.setMode(mode as 'auto' | 'manual' | 'sleep');
      } else if (typeof this.device.setMode === 'function') {
        success = await this.device.setMode(mode);
      } else {
        throw new Error('Device API does not support mode setting operations');
      }
      
      if (!success) {
        throw new Error(`Failed to set mode to ${mode}`);
      }
      
      // Update device state and characteristics
      await this.updateDeviceSpecificStates(this.device);
    } catch (error) {
      this.handleDeviceError('set target state', error);
    }
  }

  /**
   * Handle set rotation speed
   */
  private async handleSetRotationSpeed(value: CharacteristicValue): Promise<void> {
    try {
      const percentage = value as number;
      this.platform.log.debug(`Setting rotation speed to ${percentage}% for device: ${this.device.deviceName}`);
      
      if (percentage === 0) {
        // Turn off the device instead of setting speed to 0
        this.platform.log.debug(`Turning off device ${this.device.deviceName} due to 0% rotation speed`);
        const success = await this.device.turnOff();
        if (!success) {
          throw new Error('Failed to turn off device');
        }
        return;
      }
      
      const extendedDevice = this.device as ExtendedVeSyncAirPurifier;
      
      // For LV-series devices, ensure the device is in manual mode before changing fan speed
      if (this.isLVSeries && extendedDevice.mode !== 'manual') {
        this.platform.log.debug(`Setting device to manual mode before changing fan speed: ${this.device.deviceName}`);
        
        // Use the appropriate method to set manual mode
        if (typeof extendedDevice.manualMode === 'function') {
          const modeSuccess = await extendedDevice.manualMode();
          this.platform.log.debug(`Set manual mode result: ${modeSuccess ? 'success' : 'failed'}`);
        } else if (typeof extendedDevice.setMode === 'function') {
          const modeSuccess = await extendedDevice.setMode('manual');
          this.platform.log.debug(`Set manual mode result: ${modeSuccess ? 'success' : 'failed'}`);
        }
      }
      
      let speed: number;
      
      if (this.isLVSeries) {
        // For LV-series devices, speed is limited to 1-3
        // Convert HomeKit percentage (0-100) to device speed (1-3)
        if (percentage <= 33) {
          speed = 1; // Low
        } else if (percentage <= 66) {
          speed = 2; // Medium
        } else {
          speed = 3; // High
        }
      } else {
        // For standard devices, speed can be 1-5
        // Convert HomeKit percentage (0-100) to device speed (1-5)
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
      }
      
      this.platform.log.debug(`Setting fan speed to ${speed} for device: ${this.device.deviceName}`);
      const success = await this.device.changeFanSpeed(speed);
      
      if (!success) {
        throw new Error(`Failed to set speed to ${speed}`);
      }
      
      // Update device state and characteristics
      await this.updateDeviceSpecificStates(this.device);
    } catch (error) {
      this.handleDeviceError('set rotation speed', error);
    }
  }

  private async getActive(): Promise<CharacteristicValue> {
    return this.device.deviceStatus === 'on' ? 1 : 0;
  }

  private async setActive(value: CharacteristicValue): Promise<void> {
    try {
      const isOn = value as number === 1;
      this.platform.log.debug(`Setting device ${this.device.deviceName} to ${isOn ? 'on' : 'off'}`);
      
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

    if (this.isLVSeries) {
      // For LV-series devices, speed is limited to 1-3
      // Convert device speed (1-3) to HomeKit percentage (0-100)
      switch (this.device.speed) {
        case 0: return 0;   // Off
        case 1: return 33;  // Low
        case 2: return 66;  // Medium
        case 3: return 100; // High
        default: return 0;
      }
    } else {
      // For standard devices, speed can be 1-5
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
}
