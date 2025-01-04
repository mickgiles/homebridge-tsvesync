import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncBulb } from '../types/device.types';

// Constants for color temperature
const MIN_COLOR_TEMP = 140; // 7143K (cool)
const MAX_COLOR_TEMP = 500; // 2000K (warm)
const DEFAULT_COLOR_TEMP = MIN_COLOR_TEMP;

export class LightAccessory extends BaseAccessory {
  protected readonly device: VeSyncBulb;
  private readonly capabilities: DeviceCapabilities;

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncBulb
  ) {
    super(platform, accessory, device);
    this.device = device;
    this.capabilities = this.getDeviceCapabilities();
  }

  protected setupService(): void {
    // Get or create the light service
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    // Set up required characteristics
    this.setupCharacteristic(
      this.platform.Characteristic.On,
      this.getOn.bind(this),
      this.setOn.bind(this)
    );

    // Set up optional characteristics based on device capabilities
    const capabilities = this.getDeviceCapabilities();

    if (capabilities.hasBrightness) {
      this.setupCharacteristic(
        this.platform.Characteristic.Brightness,
        this.getBrightness.bind(this),
        this.setBrightness.bind(this)
      );
    }

    if (capabilities.hasColorTemp) {
      this.setupColorTemperature();
    }

    if (capabilities.hasColor) {
      this.setupColor();
    }

    // Add Name characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.Name,
      async () => this.device.deviceName
    );
  }

  private setupColorTemperature(): void {
    this.service.getCharacteristic(this.platform.Characteristic.ColorTemperature)
      .setProps({
        minValue: MIN_COLOR_TEMP,
        maxValue: MAX_COLOR_TEMP,
      });

    this.setupCharacteristic(
      this.platform.Characteristic.ColorTemperature,
      this.getColorTemperature.bind(this),
      this.setColorTemperature.bind(this)
    );
  }

  private setupColor(): void {
    this.setupCharacteristic(
      this.platform.Characteristic.Hue,
      this.getHue.bind(this),
      this.setHue.bind(this)
    );

    this.setupCharacteristic(
      this.platform.Characteristic.Saturation,
      this.getSaturation.bind(this),
      this.setSaturation.bind(this)
    );
  }

  /**
   * Update device states based on the latest details
   */
  protected async updateDeviceSpecificStates(details: any): Promise<void> {
    const lightDetails = details as {
      deviceStatus: string;
      brightness: number;
      colorTemp?: number;
      hue?: number;
      saturation?: number;
    };

    // Update active state
    const isActive = lightDetails.deviceStatus === 'on';
    this.updateCharacteristicValue(
      this.platform.Characteristic.On,
      isActive
    );

    // Update brightness if supported
    if (this.capabilities.hasBrightness && lightDetails.brightness !== undefined) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.Brightness,
        lightDetails.brightness
      );
    }

    // Update color temperature if supported
    if (this.capabilities.hasColorTemp && lightDetails.colorTemp !== undefined) {
      this.updateCharacteristicValue(
        this.platform.Characteristic.ColorTemperature,
        lightDetails.colorTemp
      );
    }

    // Update color if supported
    if (this.capabilities.hasColor) {
      if (lightDetails.hue !== undefined) {
        this.updateCharacteristicValue(
          this.platform.Characteristic.Hue,
          lightDetails.hue
        );
      }

      if (lightDetails.saturation !== undefined) {
        this.updateCharacteristicValue(
          this.platform.Characteristic.Saturation,
          lightDetails.saturation
        );
      }
    }

    // Update polling state based on active status
    this.updatePollingState(isActive);
  }

  protected getDeviceCapabilities(): DeviceCapabilities {
    // Determine capabilities based on model
    const model = this.device.deviceType.toUpperCase();
    return {
      hasBrightness: true, // All VeSync bulbs support brightness
      hasColorTemp: model.includes('CW') || model.includes('MC'), // CW and MC models support color temperature
      hasColor: model.includes('MC') || model === 'XYD0001', // MC models and XYD0001 support color
      hasSpeed: false,
      hasHumidity: false,
      hasAirQuality: false,
      hasWaterLevel: false,
      hasChildLock: false,
      hasSwingMode: false,
    };
  }

  private async getOn(): Promise<CharacteristicValue> {
    return this.device.deviceStatus === 'on';
  }

  private async setOn(value: CharacteristicValue): Promise<void> {
    try {
      const isOn = value as boolean;
      const success = isOn ? await this.device.turnOn() : await this.device.turnOff();
      
      if (!success) {
        throw new Error(`Failed to turn ${isOn ? 'on' : 'off'} device`);
      }
      
      await this.persistDeviceState('deviceStatus', isOn ? 'on' : 'off');
    } catch (error) {
      this.handleDeviceError('set on state', error);
    }
  }

  private async getBrightness(): Promise<CharacteristicValue> {
    return this.device.brightness;
  }

  private async setBrightness(value: CharacteristicValue): Promise<void> {
    try {
      const success = await this.device.setBrightness(value as number);
      
      if (!success) {
        throw new Error(`Failed to set brightness to ${value}`);
      }
      
      await this.persistDeviceState('brightness', value);
    } catch (error) {
      this.handleDeviceError('set brightness', error);
    }
  }

  private async getColorTemperature(): Promise<CharacteristicValue> {
    return this.device.colorTemp || DEFAULT_COLOR_TEMP;
  }

  private async setColorTemperature(value: CharacteristicValue): Promise<void> {
    try {
      if (!this.device.setColorTemperature) {
        throw new Error('Device does not support color temperature');
      }
      
      const success = await this.device.setColorTemperature(value as number);
      
      if (!success) {
        throw new Error(`Failed to set color temperature to ${value}`);
      }
      
      await this.persistDeviceState('colorTemp', value);
    } catch (error) {
      this.handleDeviceError('set color temperature', error);
    }
  }

  private async getHue(): Promise<CharacteristicValue> {
    return this.device.hue || 0;
  }

  private async getSaturation(): Promise<CharacteristicValue> {
    return this.device.saturation || 0;
  }

  private async setHue(value: CharacteristicValue): Promise<void> {
    try {
      if (!this.device.setColor) {
        throw new Error('Device does not support color');
      }
      
      const success = await this.device.setColor(
        value as number,
        this.device.saturation || 0
      );
      
      if (!success) {
        throw new Error(`Failed to set hue to ${value}`);
      }
      
      await this.persistDeviceState('hue', value);
    } catch (error) {
      this.handleDeviceError('set hue', error);
    }
  }

  private async setSaturation(value: CharacteristicValue): Promise<void> {
    try {
      if (!this.device.setColor) {
        throw new Error('Device does not support color');
      }
      
      const success = await this.device.setColor(
        this.device.hue || 0,
        value as number
      );
      
      if (!success) {
        throw new Error(`Failed to set saturation to ${value}`);
      }
      
      await this.persistDeviceState('saturation', value);
    } catch (error) {
      this.handleDeviceError('set saturation', error);
    }
  }
} 