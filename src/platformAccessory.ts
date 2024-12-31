import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TSVESyncPlatform } from './platform';
import { TSVESync, Device } from 'tsvesync';

export class TSVESyncAccessory {
  private service: Service;

  constructor(
    private readonly platform: TSVESyncPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly client: TSVESync,
  ) {
    // Get the device from context
    const device = accessory.context.device as Device;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'TSVESync')
      .setCharacteristic(this.platform.Characteristic.Model, device.model || 'Unknown')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, device.id);

    // Set up the appropriate service based on device type
    this.setupService(device);
  }

  private setupService(device: Device) {
    // Determine the appropriate service type based on device capabilities
    if (device.supportsBrightness) {
      // Set up as a lightbulb if it supports brightness
      this.service = this.accessory.getService(this.platform.Service.Lightbulb) 
        || this.accessory.addService(this.platform.Service.Lightbulb);

      // Add brightness characteristic
      this.service.getCharacteristic(this.platform.Characteristic.Brightness)
        .onSet(this.setBrightness.bind(this))
        .onGet(this.getBrightness.bind(this));
    } else {
      // Set up as a switch for basic on/off functionality
      this.service = this.accessory.getService(this.platform.Service.Switch) 
        || this.accessory.addService(this.platform.Service.Switch);
    }

    // Add on/off characteristic (common to both switch and lightbulb)
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));
  }

  /**
   * Handle "SET" requests from HomeKit for power state
   */
  async setOn(value: CharacteristicValue) {
    try {
      const device = this.accessory.context.device as Device;
      await this.client.setPowerState(device.id, value as boolean);
      this.platform.log.debug('Set power state ->', value);
    } catch (error) {
      this.platform.log.error('Failed to set power state:', error);
      throw error;
    }
  }

  /**
   * Handle "GET" requests from HomeKit for power state
   */
  async getOn(): Promise<CharacteristicValue> {
    try {
      const device = this.accessory.context.device as Device;
      const state = await this.client.getPowerState(device.id);
      this.platform.log.debug('Get power state ->', state);
      return state;
    } catch (error) {
      this.platform.log.error('Failed to get power state:', error);
      throw error;
    }
  }

  /**
   * Handle "SET" requests from HomeKit for brightness
   */
  async setBrightness(value: CharacteristicValue) {
    try {
      const device = this.accessory.context.device as Device;
      if (device.supportsBrightness) {
        await this.client.setBrightness(device.id, value as number);
        this.platform.log.debug('Set brightness ->', value);
      }
    } catch (error) {
      this.platform.log.error('Failed to set brightness:', error);
      throw error;
    }
  }

  /**
   * Handle "GET" requests from HomeKit for brightness
   */
  async getBrightness(): Promise<CharacteristicValue> {
    try {
      const device = this.accessory.context.device as Device;
      if (device.supportsBrightness) {
        const brightness = await this.client.getBrightness(device.id);
        this.platform.log.debug('Get brightness ->', brightness);
        return brightness;
      }
      return 100;
    } catch (error) {
      this.platform.log.error('Failed to get brightness:', error);
      throw error;
    }
  }
} 