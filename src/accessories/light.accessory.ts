import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncBulb, VeSyncDimmerSwitch, VeSyncLightDevice } from '../types/device.types';

// Constants for color temperature
const MIN_COLOR_TEMP = 140; // 7143K (cool)
const MAX_COLOR_TEMP = 500; // 2000K (warm)
const DEFAULT_COLOR_TEMP = MIN_COLOR_TEMP;
const DEVICE_MIN_KELVIN = 2700;
const DEVICE_MAX_KELVIN = 6500;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const clampMired = (value: number): number => clamp(Math.round(value), MIN_COLOR_TEMP, MAX_COLOR_TEMP);
const percentToKelvin = (percent: number): number => DEVICE_MIN_KELVIN + ((DEVICE_MAX_KELVIN - DEVICE_MIN_KELVIN) * clamp(percent, 0, 100) / 100);
const kelvinToPercent = (kelvin: number): number => ((clamp(kelvin, DEVICE_MIN_KELVIN, DEVICE_MAX_KELVIN) - DEVICE_MIN_KELVIN) / (DEVICE_MAX_KELVIN - DEVICE_MIN_KELVIN)) * 100;
const kelvinToMired = (kelvin: number): number => Math.round(1_000_000 / clamp(kelvin, DEVICE_MIN_KELVIN, DEVICE_MAX_KELVIN));
const miredToKelvin = (mired: number): number => clamp(Math.round(1_000_000 / clamp(mired, MIN_COLOR_TEMP, MAX_COLOR_TEMP)), DEVICE_MIN_KELVIN, DEVICE_MAX_KELVIN);
const percentToMired = (percent: number): number => clampMired(kelvinToMired(percentToKelvin(percent)));
const miredToPercent = (mired: number): number => kelvinToPercent(miredToKelvin(mired));

export class LightAccessory extends BaseAccessory {
  protected readonly device: VeSyncLightDevice;
  private capabilities!: DeviceCapabilities;
  private isDimmerDevice = false;
  private indicatorService?: Service;
  private indicatorColorState = { hue: 0, saturation: 0 };
  private indicatorColorUpdateTimeout?: NodeJS.Timeout;
  private lastKnownDimmerBrightness = 100;
  private lastDimmerRefresh = 0;
  private static readonly DIMMER_REFRESH_DEBOUNCE_MS = 2000;

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncLightDevice
  ) {
    super(platform, accessory, device);
    this.device = device;

    const initialBrightness = Number((device as any)?.brightness);
    if (!Number.isNaN(initialBrightness) && initialBrightness > 0) {
      this.lastKnownDimmerBrightness = Math.min(100, Math.max(1, initialBrightness));
    }
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
    this.isDimmerDevice = this.detectDimmer(this.device);
    this.capabilities = this.getDeviceCapabilities();
    const capabilities = this.capabilities;

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

    if (this.isDimmerDevice) {
      this.setupIndicatorService();
    }
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
    const lightDetails = details as VeSyncLightDevice & {
      colorTemp?: number;
      hue?: number;
      saturation?: number;
    };

    const deviceStatus = lightDetails.deviceStatus ?? this.device.deviceStatus;
    const isActive = deviceStatus === 'on';
    this.updateCharacteristicValue(
      this.platform.Characteristic.On,
      isActive
    );

    // Update brightness if supported
    if (this.capabilities.hasBrightness) {
      let brightness: number | undefined = lightDetails.brightness;

      if (!this.isDimmerDevice) {
        const bulb = this.device as VeSyncBulb;
        if (typeof bulb.getBrightness === 'function') {
          brightness = bulb.getBrightness();
        }
      }

      if (brightness !== undefined) {
        this.updateCharacteristicValue(
          this.platform.Characteristic.Brightness,
          brightness
        );

        if (this.isDimmerDevice && brightness > 0) {
          this.lastKnownDimmerBrightness = brightness;
        }
      }
    }

    // Update color temperature if supported
    if (this.capabilities.hasColorTemp && !this.isDimmerDevice) {
      const bulb = this.device as VeSyncBulb;
      let tempPercent: number | undefined;

      if (typeof bulb.getColorTempPercent === 'function') {
        tempPercent = bulb.getColorTempPercent();
      } else if (typeof lightDetails.colorTemp === 'number') {
        tempPercent = lightDetails.colorTemp > 100
          ? miredToPercent(lightDetails.colorTemp)
          : lightDetails.colorTemp;
      }

      if (typeof tempPercent === 'number' && !Number.isNaN(tempPercent) && tempPercent > 0) {
        const mired = percentToMired(tempPercent);
        this.updateCharacteristicValue(
          this.platform.Characteristic.ColorTemperature,
          mired
        );
      }
    }

    // Update color if supported
    if (this.capabilities.hasColor && !this.isDimmerDevice) {
      const bulb = this.device as VeSyncBulb;
      const colorModel = typeof bulb.getColorModel === 'function' ? bulb.getColorModel() : 'none';

      if (colorModel === 'rgb' && typeof bulb.getRGBValues === 'function') {
        const rgb = bulb.getRGBValues();
        const hsv = this.rgbToHsv(rgb.red, rgb.green, rgb.blue);
        this.updateCharacteristicValue(this.platform.Characteristic.Hue, hsv.hue);
        this.updateCharacteristicValue(this.platform.Characteristic.Saturation, hsv.saturation);
      } else {
        const hue = typeof bulb.getColorHue === 'function'
          ? bulb.getColorHue()
          : lightDetails.hue;
        const saturation = typeof bulb.getColorSaturation === 'function'
          ? bulb.getColorSaturation()
          : lightDetails.saturation;

        if (typeof hue === 'number') {
          this.updateCharacteristicValue(this.platform.Characteristic.Hue, hue);
        }
        if (typeof saturation === 'number') {
          this.updateCharacteristicValue(this.platform.Characteristic.Saturation, saturation);
        }
      }
    }

    if (this.isDimmerDevice && this.indicatorService) {
      const dimmer = lightDetails as VeSyncDimmerSwitch;
      const isRgbOn = dimmer.rgbLightStatus === 'on';
      this.updateIndicatorCharacteristic(
        this.platform.Characteristic.On,
        isRgbOn
      );

      const { hue, saturation } = this.rgbToHsv(
        dimmer.rgbLightValue.red,
        dimmer.rgbLightValue.green,
        dimmer.rgbLightValue.blue
      );
      this.indicatorColorState = { hue, saturation };
      this.updateIndicatorCharacteristic(this.platform.Characteristic.Hue, hue);
      this.updateIndicatorCharacteristic(this.platform.Characteristic.Saturation, saturation);
    }
  }

  protected getDeviceCapabilities(): DeviceCapabilities {
    if (this.isDimmerDevice) {
      return {
        hasBrightness: true,
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

    const model = this.device.deviceType.toUpperCase();
    const bulb = this.device as VeSyncBulb;
    const supports = typeof bulb.hasFeature === 'function'
      ? bulb.hasFeature.bind(bulb)
      : (feature: string): boolean => {
        if (feature === 'color_temp') {
          return model.includes('CW') || model.includes('MC') || model === 'XYD0001';
        }
        if (feature === 'rgb_shift') {
          return model.includes('MC') || model === 'XYD0001';
        }
        if (feature === 'dimmable') {
          return true;
        }
        return false;
      };

    return {
      hasBrightness: typeof (this.device as any).setBrightness === 'function',
      hasColorTemp: supports('color_temp'),
      hasColor: supports('rgb_shift'),
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

      if (this.isDimmerDevice) {
        const targetBrightness = isOn ? this.resolveDimmerOnBrightness() : 0;
        await this.setBrightness(targetBrightness);
        return;
      }

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
    const deviceWithGetter = this.device as VeSyncDimmerSwitch & { getBrightness?: () => number };
    if (typeof deviceWithGetter.getBrightness === 'function') {
      return deviceWithGetter.getBrightness();
    }
    return this.device.brightness;
  }

  private async setBrightness(value: CharacteristicValue): Promise<void> {
    try {
      const target = Math.round(Number(value));
      const brightness = Math.min(100, Math.max(this.isDimmerDevice ? 0 : 0, target));

      let success = await this.device.setBrightness(brightness);

      if (!success && this.isDimmerDevice && brightness === 0) {
        const fallback = await (this.device as VeSyncDimmerSwitch).turnOff();
        if (!fallback) {
          throw new Error('Failed to turn off device when setting brightness to 0');
        }
        success = true;
      }

      if (!success) {
        throw new Error(`Failed to set brightness to ${brightness}`);
      }

      await this.persistDeviceState('brightness', brightness);

      if (this.isDimmerDevice) {
        if (brightness > 0) {
          this.lastKnownDimmerBrightness = brightness;
          await this.persistDeviceState('deviceStatus', 'on');
        } else {
          await this.persistDeviceState('deviceStatus', 'off');
        }
        await this.refreshDimmerDetails();
      }
    } catch (error) {
      this.handleDeviceError('set brightness', error);
    }
  }

  private async getColorTemperature(): Promise<CharacteristicValue> {
    if (this.isDimmerDevice) {
      return DEFAULT_COLOR_TEMP;
    }

    const bulb = this.device as VeSyncBulb;
    if (typeof bulb.getColorTempPercent === 'function') {
      const percent = bulb.getColorTempPercent();
      if (percent > 0) {
        return percentToMired(percent);
      }
    }

    const stored = this.accessory.context?.device?.details?.colorTemp;
    if (typeof stored === 'number') {
      return clampMired(stored);
    }

    return DEFAULT_COLOR_TEMP;
  }

  private async setColorTemperature(value: CharacteristicValue): Promise<void> {
    try {
      if (this.isDimmerDevice) {
        throw new Error('Device does not support color temperature');
      }

      const bulb = this.device as VeSyncBulb;

      if (!bulb.setColorTemperature) {
        throw new Error('Device does not support color temperature');
      }

      const percent = miredToPercent(Number(value));
      const success = await bulb.setColorTemperature(percent);

      if (!success) {
        throw new Error(`Failed to set color temperature to ${value}`);
      }

      await this.persistDeviceState('colorTemp', value);
    } catch (error) {
      this.handleDeviceError('set color temperature', error);
    }
  }

  private async getHue(): Promise<CharacteristicValue> {
    if (this.isDimmerDevice) {
      return 0;
    }

    const bulb = this.device as VeSyncBulb;
    const colorModel = typeof bulb.getColorModel === 'function' ? bulb.getColorModel() : 'none';

    if (colorModel === 'rgb' && typeof bulb.getRGBValues === 'function') {
      const rgb = bulb.getRGBValues();
      return this.rgbToHsv(rgb.red, rgb.green, rgb.blue).hue;
    }

    if (typeof bulb.getColorHue === 'function') {
      return bulb.getColorHue();
    }

    return 0;
  }

  private async getSaturation(): Promise<CharacteristicValue> {
    if (this.isDimmerDevice) {
      return 0;
    }

    const bulb = this.device as VeSyncBulb;
    const colorModel = typeof bulb.getColorModel === 'function' ? bulb.getColorModel() : 'none';

    if (colorModel === 'rgb' && typeof bulb.getRGBValues === 'function') {
      const rgb = bulb.getRGBValues();
      return this.rgbToHsv(rgb.red, rgb.green, rgb.blue).saturation;
    }

    if (typeof bulb.getColorSaturation === 'function') {
      return bulb.getColorSaturation();
    }

    return 0;
  }

  private async setHue(value: CharacteristicValue): Promise<void> {
    try {
      if (this.isDimmerDevice) {
        throw new Error('Device does not support color');
      }

      const bulb = this.device as VeSyncBulb;

      if (!bulb.setColor) {
        throw new Error('Device does not support color');
      }

      const fallbackSaturation = this.service.getCharacteristic(this.platform.Characteristic.Saturation).value as number | undefined;
      const currentSaturation = typeof bulb.getColorSaturation === 'function'
        ? bulb.getColorSaturation()
        : (typeof fallbackSaturation === 'number' ? fallbackSaturation : 0);
      const currentValue = typeof bulb.getColorValue === 'function'
        ? bulb.getColorValue()
        : 100;

      const success = await bulb.setColor(
        Number(value),
        currentSaturation || 0,
        currentValue || 100
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
      if (this.isDimmerDevice) {
        throw new Error('Device does not support color');
      }

      const bulb = this.device as VeSyncBulb;

      if (!bulb.setColor) {
        throw new Error('Device does not support color');
      }

      const fallbackHue = this.service.getCharacteristic(this.platform.Characteristic.Hue).value as number | undefined;
      const currentHue = typeof bulb.getColorHue === 'function'
        ? bulb.getColorHue()
        : (typeof fallbackHue === 'number' ? fallbackHue : 0);
      const currentValue = typeof bulb.getColorValue === 'function'
        ? bulb.getColorValue()
        : 100;

      const success = await bulb.setColor(
        currentHue || 0,
        Number(value),
        currentValue || 100
      );

      if (!success) {
        throw new Error(`Failed to set saturation to ${value}`);
      }

      await this.persistDeviceState('saturation', value);
    } catch (error) {
      this.handleDeviceError('set saturation', error);
    }
  }

  private detectDimmer(device: VeSyncLightDevice): device is VeSyncDimmerSwitch {
    return typeof (device as VeSyncDimmerSwitch).rgbColorSet === 'function';
  }

  private setupIndicatorService(): void {
    const serviceName = `${this.device.deviceName} Indicator`;
    const existing = this.accessory.getService(serviceName);
    this.indicatorService = existing || this.accessory.addService(
      this.platform.Service.Lightbulb,
      serviceName,
      'indicator'
    );

    const indicatorService = this.indicatorService;
    if (!indicatorService) {
      return;
    }

    this.setupCharacteristicForService(
      indicatorService,
      this.platform.Characteristic.On,
      this.getIndicatorOn.bind(this),
      this.setIndicatorOn.bind(this)
    );

    this.setupCharacteristicForService(
      indicatorService,
      this.platform.Characteristic.Hue,
      this.getIndicatorHue.bind(this),
      this.setIndicatorHue.bind(this)
    );

    this.setupCharacteristicForService(
      indicatorService,
      this.platform.Characteristic.Saturation,
      this.getIndicatorSaturation.bind(this),
      this.setIndicatorSaturation.bind(this)
    );
  }

  private setupCharacteristicForService(
    service: Service,
    characteristic: any,
    onGet?: () => Promise<CharacteristicValue>,
    onSet?: (value: CharacteristicValue) => Promise<void>
  ): void {
    this.withService(service, () => {
      this.setupCharacteristic(characteristic, onGet, onSet);
    });
  }

  private updateIndicatorCharacteristic(
    characteristic: any,
    value: CharacteristicValue
  ): void {
    if (!this.indicatorService) {
      return;
    }

    this.withService(this.indicatorService, () => {
      this.updateCharacteristicValue(characteristic, value);
    });
  }

  private withService<T>(service: Service, fn: () => T): T {
    const currentService = this.service;
    this.service = service;
    try {
      return fn();
    } finally {
      this.service = currentService;
    }
  }

  private async getIndicatorOn(): Promise<CharacteristicValue> {
    if (!this.isDimmerDevice) {
      return false;
    }
    const dimmer = this.device as VeSyncDimmerSwitch;
    return dimmer.rgbLightStatus === 'on';
  }

  private async setIndicatorOn(value: CharacteristicValue): Promise<void> {
    if (!this.isDimmerDevice) {
      return;
    }

    const isOn = Boolean(value);
    const dimmer = this.device as VeSyncDimmerSwitch;
    const success = isOn ? await dimmer.rgbColorOn() : await dimmer.rgbColorOff();

    if (!success) {
      throw new Error(`Failed to turn ${isOn ? 'on' : 'off'} indicator light`);
    }

    await this.refreshDimmerDetails();
  }

  private async getIndicatorHue(): Promise<CharacteristicValue> {
    if (!this.isDimmerDevice) {
      return 0;
    }

    const { hue } = this.rgbToHsv(
      (this.device as VeSyncDimmerSwitch).rgbLightValue.red,
      (this.device as VeSyncDimmerSwitch).rgbLightValue.green,
      (this.device as VeSyncDimmerSwitch).rgbLightValue.blue
    );
    this.indicatorColorState.hue = hue;
    return hue;
  }

  private async setIndicatorHue(value: CharacteristicValue): Promise<void> {
    if (!this.isDimmerDevice) {
      return;
    }

    this.indicatorColorState.hue = Number(value);
    this.scheduleIndicatorColorUpdate();
  }

  private async getIndicatorSaturation(): Promise<CharacteristicValue> {
    if (!this.isDimmerDevice) {
      return 0;
    }

    const { saturation } = this.rgbToHsv(
      (this.device as VeSyncDimmerSwitch).rgbLightValue.red,
      (this.device as VeSyncDimmerSwitch).rgbLightValue.green,
      (this.device as VeSyncDimmerSwitch).rgbLightValue.blue
    );
    this.indicatorColorState.saturation = saturation;
    return saturation;
  }

  private async setIndicatorSaturation(value: CharacteristicValue): Promise<void> {
    if (!this.isDimmerDevice) {
      return;
    }

    this.indicatorColorState.saturation = Number(value);
    this.scheduleIndicatorColorUpdate();
  }

  private scheduleIndicatorColorUpdate(): void {
    if (this.indicatorColorUpdateTimeout) {
      clearTimeout(this.indicatorColorUpdateTimeout);
    }

    this.indicatorColorUpdateTimeout = setTimeout(() => {
      void this.pushIndicatorColor().catch(error => {
        void this.handleDeviceError('set indicator color', error);
      });
    }, 250);
  }

  private async pushIndicatorColor(): Promise<void> {
    if (!this.isDimmerDevice) {
      return;
    }

    const [red, green, blue] = this.hsvToRgb(
      this.indicatorColorState.hue,
      this.indicatorColorState.saturation,
      100
    );

    const dimmer = this.device as VeSyncDimmerSwitch;
    if (dimmer.rgbLightStatus !== 'on') {
      await dimmer.rgbColorOn();
    }
    const success = await dimmer.rgbColorSet(red, green, blue);

    if (!success) {
      throw new Error('Failed to update indicator color');
    }

    this.indicatorColorState = {
      hue: this.indicatorColorState.hue,
      saturation: this.indicatorColorState.saturation,
    };

    await this.refreshDimmerDetails();
  }

  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    let hue = h % 360;
    if (hue < 0) {
      hue += 360;
    }
    const saturation = Math.max(0, Math.min(100, s)) / 100;
    const value = Math.max(0, Math.min(100, v)) / 100;

    const c = value * saturation;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = value - c;

    let rPrime = 0;
    let gPrime = 0;
    let bPrime = 0;

    if (hue < 60) {
      rPrime = c;
      gPrime = x;
    } else if (hue < 120) {
      rPrime = x;
      gPrime = c;
    } else if (hue < 180) {
      gPrime = c;
      bPrime = x;
    } else if (hue < 240) {
      gPrime = x;
      bPrime = c;
    } else if (hue < 300) {
      rPrime = x;
      bPrime = c;
    } else {
      rPrime = c;
      bPrime = x;
    }

    const red = Math.round((rPrime + m) * 255);
    const green = Math.round((gPrime + m) * 255);
    const blue = Math.round((bPrime + m) * 255);

    return [red, green, blue];
  }

  private rgbToHsv(r: number, g: number, b: number): { hue: number; saturation: number; value: number } {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;

    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
      if (max === red) {
        hue = ((green - blue) / delta) % 6;
      } else if (max === green) {
        hue = (blue - red) / delta + 2;
      } else {
        hue = (red - green) / delta + 4;
      }
      hue *= 60;
      if (hue < 0) {
        hue += 360;
      }
    }

    const saturation = max === 0 ? 0 : (delta / max) * 100;
    const value = max * 100;

    return {
      hue: Math.round(hue),
      saturation: Math.round(saturation),
      value: Math.round(value),
    };
  }

  private async refreshDimmerDetails(): Promise<void> {
    if (!this.isDimmerDevice) {
      return;
    }

    const dimmer = this.device as VeSyncDimmerSwitch;
    try {
      const now = Date.now();
      if (
        now - this.lastDimmerRefresh >= LightAccessory.DIMMER_REFRESH_DEBOUNCE_MS &&
        typeof (dimmer as any).getDetails === 'function'
      ) {
        await (dimmer as any).getDetails();
        this.lastDimmerRefresh = now;
      }
    } catch (error) {
      this.platform.log.debug(
        `${this.device.deviceName}: failed to refresh details after state change`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private resolveDimmerOnBrightness(): number {
    const dimmer = this.device as VeSyncDimmerSwitch;
    const current = Number((dimmer as any).brightness);
    if (!Number.isNaN(current) && current > 0) {
      this.lastKnownDimmerBrightness = Math.min(100, Math.max(1, current));
      return this.lastKnownDimmerBrightness;
    }

    const persisted = Number(this.accessory.context?.device?.details?.brightness);
    if (!Number.isNaN(persisted) && persisted > 0) {
      this.lastKnownDimmerBrightness = Math.min(100, Math.max(1, persisted));
      return this.lastKnownDimmerBrightness;
    }

    return Math.min(100, Math.max(1, this.lastKnownDimmerBrightness));
  }
}
