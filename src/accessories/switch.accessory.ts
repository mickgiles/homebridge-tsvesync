import { CharacteristicValue, Service } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { DeviceCapabilities, VeSyncSwitch } from '../types/device.types';
import { TSVESyncPlatform } from '../platform';
import { PlatformAccessory } from 'homebridge';

export class SwitchAccessory extends BaseAccessory {
  protected readonly device: VeSyncSwitch;
  protected service!: Service;

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncSwitch
  ) {
    super(platform, accessory, device);
    this.device = device;
  }

  protected setupService(): void {
    // Get the switch service if it exists, otherwise create a new switch service
    this.service = this.accessory.getService(this.platform.Service.Switch)
      || this.accessory.addService(this.platform.Service.Switch);

    // Set up handlers for the On/Off characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.handleOnSet.bind(this))
      .onGet(this.handleOnGet.bind(this));

    // Add Name characteristic
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.device.deviceName
    );
  }

  /**
   * Update device states based on the latest details
   */
  protected async updateDeviceSpecificStates(details: any): Promise<void> {
    const isOn = details.deviceStatus === 'on';
    this.updateCharacteristicValue(
      this.platform.Characteristic.On,
      isOn
    );
  }

  protected getDeviceCapabilities(): DeviceCapabilities {
    return {
      hasBrightness: false,
      hasColorTemp: false,
      hasColor: false,
      hasSpeed: false,
      hasHumidity: false,
      hasAirQuality: false,
      hasWaterLevel: false,
      hasChildLock: false,
      hasSwingMode: false,
    };
  }

  private async handleOnGet(): Promise<CharacteristicValue> {
    try {
      await this.device.getDetails();
      return this.device.power || this.device.deviceStatus === 'on';
    } catch (error) {
      this.platform.log.error('Failed to get switch state:', error);
      throw error;
    }
  }

  private async handleOnSet(value: CharacteristicValue): Promise<void> {
    try {
      const isOn = value as boolean;
      const success = isOn
        ? await this.device.turnOn()
        : await this.device.turnOff();

      if (!success) {
        throw new Error(`Failed to turn ${isOn ? 'on' : 'off'} switch`);
      }

      // Update the device state after successful change
      await this.device.getDetails();
    } catch (error) {
      this.platform.log.error('Failed to set switch state:', error);
      throw error;
    }
  }
} 