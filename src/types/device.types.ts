import { VeSyncBaseDevice } from 'tsvesync';

export interface FanConfig {
  module: 'VeSyncAirBypass' | 'VeSyncHumidifier' | 'VeSyncWarmHumidifier' | 'VeSyncTowerFan' | 'VeSyncAirBaseV2';
  features: string[];
  levels?: number[];
}

export interface DeviceCapabilities {
  hasBrightness: boolean;
  hasColorTemp: boolean;
  hasColor: boolean;
  hasSpeed: boolean;
  hasHumidity: boolean;
  hasAirQuality: boolean;
  hasWaterLevel: boolean;
  hasChildLock: boolean;
  hasSwingMode: boolean;
}

export interface VeSyncDeviceWithPower extends VeSyncBaseDevice {
  deviceStatus: string;
  turnOn(): Promise<boolean>;
  turnOff(): Promise<boolean>;
  getDetails?: (...args: any[]) => any;
}

export interface VeSyncDeviceWithBrightness extends VeSyncDeviceWithPower {
  brightness: number;
  setBrightness(value: number): Promise<boolean>;
  getBrightness?(): number;
}

export interface VeSyncDeviceWithColor extends VeSyncDeviceWithBrightness {
  colorTemp?: number;
  hue?: number;
  saturation?: number;
  getColorTempPercent?(): number;
  getColorTempKelvin?(): number;
  getColorHue?(): number;
  getColorSaturation?(): number;
  getColorValue?(): number;
  getRGBValues?(): { red: number; green: number; blue: number };
  hasFeature?(feature: string): boolean;
  getColorModel?(): string;
  setColorTemperature?(value: number): Promise<boolean>;
  setColor?(hue: number, saturation: number, value?: number): Promise<boolean>;
}

export interface VeSyncDeviceWithSpeed extends VeSyncDeviceWithPower {
  speed: number;
  maxSpeed: number;
  changeFanSpeed(value: number): Promise<boolean>;
}

export interface VeSyncDeviceWithRotation extends VeSyncDeviceWithPower {
  rotationDirection: 'clockwise' | 'counterclockwise';
  setRotationDirection(direction: 'clockwise' | 'counterclockwise'): Promise<boolean>;
}

export interface VeSyncDeviceWithHumidity extends VeSyncDeviceWithPower {
  humidity: number;
  targetHumidity: number;
  waterLevel?: number;
  setTargetHumidity(value: number): Promise<boolean>;
}

export interface VeSyncDeviceWithAirQuality extends VeSyncDeviceWithPower {
  airQuality: number;
  airQualityLevel?: number;
  airQualityLabel?: string;
  pm25?: number;
  filterLife: number;
  mode: string;
  setMode(mode: string): Promise<boolean>;
  getNormalizedAirQuality?(): { level: number; label: string };
}

export interface VeSyncDeviceWithControls extends VeSyncDeviceWithPower {
  childLock?: boolean;
  swingMode?: boolean;
  setChildLock?(enabled: boolean): Promise<boolean>;
  setSwingMode?(enabled: boolean): Promise<boolean>;
}

// Combined device types for specific device categories
export interface VeSyncAirPurifier extends VeSyncDeviceWithPower, VeSyncDeviceWithSpeed, VeSyncDeviceWithAirQuality, VeSyncDeviceWithControls {}

export interface VeSyncHumidifier extends VeSyncDeviceWithPower, VeSyncDeviceWithSpeed, VeSyncDeviceWithHumidity, VeSyncDeviceWithControls {}

export interface VeSyncFan extends VeSyncDeviceWithPower, VeSyncDeviceWithSpeed, VeSyncDeviceWithRotation {
  oscillationState: boolean;
  childLock: boolean;
  mode: 'normal' | 'auto' | 'sleep' | 'turbo';
  setOscillation(enabled: boolean): Promise<boolean>;
  setChildLock(enabled: boolean): Promise<boolean>;
  setMode(mode: 'normal' | 'auto' | 'sleep' | 'turbo'): Promise<boolean>;
}

export interface VeSyncDimmerSwitch extends VeSyncDeviceWithBrightness {
  rgbLightStatus: string;
  indicatorLightStatus: string;
  rgbLightValue: {
    red: number;
    green: number;
    blue: number;
  };
  rgbColorSet(red: number, green: number, blue: number): Promise<boolean>;
  rgbColorOn(): Promise<boolean>;
  rgbColorOff(): Promise<boolean>;
  indicatorLightOn(): Promise<boolean>;
  indicatorLightOff(): Promise<boolean>;
}

export interface VeSyncBulb extends VeSyncDeviceWithPower, VeSyncDeviceWithBrightness, VeSyncDeviceWithColor {}

export type VeSyncLightDevice = VeSyncBulb | VeSyncDimmerSwitch;

export interface VeSyncOutlet extends VeSyncDeviceWithPower {
  power?: number;
  voltage?: number;
  energy?: number;
}

export interface VeSyncSwitch extends VeSyncDeviceWithPower {
  power?: boolean;
}

export interface DeviceExclusion {
  type?: string[];       // Device types to exclude (e.g., "fan", "outlet")
  model?: string[];      // Device models to exclude (e.g., "Core300S", "LV600S")
  name?: string[];       // Device names to exclude (exact match)
  namePattern?: string[]; // Device names to exclude (regex patterns)
  id?: string[];         // Device IDs to exclude (cid/uuid)
}

export interface PlatformConfig {
  platform: string;
  name: string;
  username: string;
  password: string;
  updateInterval?: number;
  debug?: boolean;
  apiUrl?: string;
  countryCode?: string;  // Optional country code for non-US/EU regions (e.g., 'AU', 'JP', 'NZ')
  exclude?: DeviceExclusion;
  retry?: {
    maxRetries: number;
    initialDelay?: number;
    maxDelay?: number;
  };
  quotaManagement?: {
    enabled: boolean;
    bufferPercentage?: number;
    priorityMethods?: string[];
  };
}
