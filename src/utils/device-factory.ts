import { Categories, PlatformAccessory } from 'homebridge';
import { TSVESyncPlatform } from '../platform';
import { VeSyncBaseDevice } from 'tsvesync';
import { AirPurifierAccessory } from '../accessories/air-purifier.accessory';
import { HumidifierAccessory } from '../accessories/humidifier.accessory';
import { FanAccessory } from '../accessories/fan.accessory';
import { LightAccessory } from '../accessories/light.accessory';
import { OutletAccessory } from '../accessories/outlet.accessory';
import { BaseAccessory } from '../accessories/base.accessory';
import { 
  VeSyncAirPurifier,
  VeSyncHumidifier,
  VeSyncFan,
  VeSyncBulb,
  VeSyncOutlet 
} from '../types/device.types';

// Device model constants
const AIR_PURIFIER_MODELS = [
  'Core200S', 'Core300S', 'Core400S', 'Core600S',
  'Vital100S', 'Vital200S', 'LV-PUR131S', 'LV-RH131S',
  'EverestAir'
];

const HUMIDIFIER_MODELS = [
  'Classic200S', 'Classic300S', 'Dual200S', 'LV600S',
  'OasisMist', 'OasisMist600S', 'Superior6000S',
  'OasisMist1000S'
];

const FAN_MODELS = ['LTF-F422'];

const OUTLET_MODELS = [
  'ESO15-TB', 'ESW15-USA', 'ESW03-USA', 'ESW01-EU',
  'wifi-switch-1.3'
];

const SWITCH_MODELS = ['ESWD16', 'ESWL01', 'ESWL03'];

export class DeviceFactory {
  private static modelMatches(deviceType: string, models: string[]): boolean {
    const upperDeviceType = deviceType.toUpperCase();
    return models.some(model => upperDeviceType.includes(model.toUpperCase()));
  }

  private static isAirPurifier(deviceType: string): boolean {
    return deviceType.startsWith('LAP-') || 
           this.modelMatches(deviceType, AIR_PURIFIER_MODELS);
  }

  private static isHumidifier(deviceType: string): boolean {
    return deviceType.startsWith('LUH-') || 
           deviceType.startsWith('LEH-') ||
           this.modelMatches(deviceType, HUMIDIFIER_MODELS);
  }

  private static isFan(deviceType: string): boolean {
    return deviceType.startsWith('LTF-') || 
           this.modelMatches(deviceType, FAN_MODELS);
  }

  private static isBulb(deviceType: string): boolean {
    return deviceType.startsWith('ESL') || deviceType === 'XYD0001';
  }

  private static isOutlet(deviceType: string): boolean {
    return this.modelMatches(deviceType, OUTLET_MODELS);
  }

  private static isSwitch(deviceType: string): boolean {
    return this.modelMatches(deviceType, SWITCH_MODELS);
  }

  static createAccessory(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncBaseDevice
  ): BaseAccessory {
    const deviceType = device.deviceType.toUpperCase();

    // Air Purifiers
    if (this.isAirPurifier(deviceType)) {
      return new AirPurifierAccessory(platform, accessory, device as VeSyncAirPurifier);
    }

    // Humidifiers
    if (this.isHumidifier(deviceType)) {
      return new HumidifierAccessory(platform, accessory, device as VeSyncHumidifier);
    }

    // Fans
    if (this.isFan(deviceType)) {
      return new FanAccessory(platform, accessory, device as VeSyncFan);
    }

    // Bulbs
    if (this.isBulb(deviceType)) {
      return new LightAccessory(platform, accessory, device as VeSyncBulb);
    }

    // Outlets and Switches
    if (this.isOutlet(deviceType) || this.isSwitch(deviceType)) {
      return new OutletAccessory(platform, accessory, device as VeSyncOutlet);
    }

    // Default to outlet for unknown devices
    platform.log.warn(`Unknown device type: ${deviceType}, defaulting to outlet`);
    return new OutletAccessory(platform, accessory, device as VeSyncOutlet);
  }

  static getAccessoryCategory(deviceType: string): Categories {
    const type = deviceType.toUpperCase();

    if (this.isAirPurifier(type)) {
      return Categories.AIR_PURIFIER;
    }

    if (this.isHumidifier(type)) {
      return Categories.AIR_HUMIDIFIER;
    }

    if (this.isFan(type)) {
      return Categories.FAN;
    }

    if (this.isBulb(type)) {
      return Categories.LIGHTBULB;
    }

    if (this.isSwitch(type)) {
      return Categories.SWITCH;
    }

    if (this.isOutlet(type)) {
      return Categories.OUTLET;
    }

    // Default to outlet for unknown devices
    return Categories.OUTLET;
  }
} 