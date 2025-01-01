/**
 * Device capabilities interface
 */
export interface DeviceCapabilities {
  power: boolean;
  mode: boolean;
  speed: boolean;
  timer: boolean;
  hasBrightness: boolean;
  hasColorTemp: boolean;
  hasColor: boolean;
  hasSpeed: boolean;
  hasMode: boolean;
  hasTimer: boolean;
  hasSchedule: boolean;
  hasHumidity: boolean;
  hasAirQuality: boolean;
  hasWaterLevel: boolean;
  hasChildLock: boolean;
  hasSwingMode: boolean;
} 