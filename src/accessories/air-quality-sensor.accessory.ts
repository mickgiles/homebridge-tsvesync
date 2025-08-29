import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TSVESyncPlatform } from '../platform';
import { VeSyncBaseDevice } from 'tsvesync';
import { BaseAccessory } from './base.accessory';

/**
 * Air Quality Sensor Accessory
 * This is a separate accessory that only provides air quality monitoring
 * Used for Core300S, Core400S, Core600S and other devices with AQ sensors
 */
export class AirQualitySensorAccessory extends BaseAccessory {
  protected service: Service;
  private parentDevice: VeSyncBaseDevice;

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncBaseDevice,
  ) {
    super(platform, accessory, device);
    
    this.parentDevice = device;
    
    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'VeSync')
      .setCharacteristic(this.platform.Characteristic.Model, `${device.deviceType || 'Unknown'} AQ Sensor`)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, `${device.cid || device.uuid}-AQ`);

    // Get or create the Air Quality Sensor service
    this.service = this.accessory.getService(this.platform.Service.AirQualitySensor) ||
      this.accessory.addService(this.platform.Service.AirQualitySensor);

    // Set the service name
    this.service.setCharacteristic(this.platform.Characteristic.Name, `${device.deviceName} Air Quality`);

    // Configure the Air Quality characteristic
    this.service.getCharacteristic(this.platform.Characteristic.AirQuality)
      .setProps({
        validValues: [
          this.platform.Characteristic.AirQuality.UNKNOWN,
          this.platform.Characteristic.AirQuality.EXCELLENT,
          this.platform.Characteristic.AirQuality.GOOD,
          this.platform.Characteristic.AirQuality.FAIR,
          this.platform.Characteristic.AirQuality.INFERIOR,
          this.platform.Characteristic.AirQuality.POOR,
        ],
      })
      .onGet(this.getAirQuality.bind(this));

    // Add PM2.5 Density characteristic if device supports it
    if (this.deviceSupportsPM25()) {
      this.service.getCharacteristic(this.platform.Characteristic.PM2_5Density)
        .onGet(this.getPM25Density.bind(this));
    }

    // Add PM10 Density characteristic if device supports it
    if (this.deviceSupportsPM10()) {
      this.service.getCharacteristic(this.platform.Characteristic.PM10Density)
        .onGet(this.getPM10Density.bind(this));
    }

    // Polling is handled by BaseAccessory
  }

  /**
   * Check if device supports PM2.5 readings
   */
  private deviceSupportsPM25(): boolean {
    // Core300S, Core400S, Core600S all support PM2.5
    const deviceType = this.parentDevice.deviceType || '';
    return deviceType.includes('Core300S') || 
           deviceType.includes('Core400S') || 
           deviceType.includes('Core600S') ||
           deviceType.includes('LAP-') ||
           deviceType.includes('LV-PUR');
  }

  /**
   * Check if device supports PM10 readings
   */
  private deviceSupportsPM10(): boolean {
    // Some newer devices support PM10
    const deviceType = this.parentDevice.deviceType || '';
    return deviceType.includes('Core600S') ||
           deviceType.includes('LAP-V');
  }

  /**
   * Get the current air quality level
   */
  async getAirQuality(): Promise<CharacteristicValue> {
    try {
      // Use the device's native getter for air quality value (PM2.5)
      const extendedDevice = this.parentDevice as any;
      const pm25 = extendedDevice.airQualityValue || 0;
      
      this.platform.log.debug(`${this.device.deviceName} AQ: PM2.5 value = ${pm25}`);
      
      return this.convertPM25ToAirQuality(pm25);
    } catch (error) {
      this.platform.log.error(`${this.device.deviceName} AQ: Failed to get air quality:`, error);
      return this.platform.Characteristic.AirQuality.UNKNOWN;
    }
  }

  /**
   * Get the current PM2.5 density
   */
  async getPM25Density(): Promise<CharacteristicValue> {
    try {
      // Use the device's native getter for air quality value (PM2.5)
      const extendedDevice = this.parentDevice as any;
      const pm25 = extendedDevice.airQualityValue || 0;
      
      // HomeKit expects PM2.5 in μg/m³, range 0-1000
      return Math.min(1000, Math.max(0, pm25));
    } catch (error) {
      this.platform.log.error(`${this.device.deviceName} AQ: Failed to get PM2.5:`, error);
      return 0;
    }
  }

  /**
   * Get the current PM10 density
   */
  async getPM10Density(): Promise<CharacteristicValue> {
    try {
      const extendedDevice = this.parentDevice as any;
      const pm10 = extendedDevice.details?.pm10 || 0;
      
      // HomeKit expects PM10 in μg/m³, range 0-1000
      return Math.min(1000, Math.max(0, pm10));
    } catch (error) {
      this.platform.log.error(`${this.device.deviceName} AQ: Failed to get PM10:`, error);
      return 0;
    }
  }

  /**
   * Convert PM2.5 value to HomeKit AirQuality level
   * Based on EPA Air Quality Index (AQI) standards
   */
  private convertPM25ToAirQuality(pm25: number): CharacteristicValue {
    if (pm25 <= 12) {
      return this.platform.Characteristic.AirQuality.EXCELLENT; // Good (0-12 μg/m³)
    } else if (pm25 <= 35) {
      return this.platform.Characteristic.AirQuality.GOOD; // Moderate (12.1-35.4 μg/m³)
    } else if (pm25 <= 55) {
      return this.platform.Characteristic.AirQuality.FAIR; // Unhealthy for Sensitive (35.5-55.4 μg/m³)
    } else if (pm25 <= 150) {
      return this.platform.Characteristic.AirQuality.INFERIOR; // Unhealthy (55.5-150.4 μg/m³)
    } else {
      return this.platform.Characteristic.AirQuality.POOR; // Very Unhealthy (>150.5 μg/m³)
    }
  }

  /**
   * Update characteristics from device state
   */
  protected async updateCharacteristics(): Promise<void> {
    try {
      // Make sure device data is current
      const extendedDevice = this.parentDevice as any;
      if (typeof extendedDevice.getDetails === 'function') {
        await extendedDevice.getDetails();
      }
      
      // Update air quality
      const airQuality = await this.getAirQuality();
      this.service.updateCharacteristic(
        this.platform.Characteristic.AirQuality,
        airQuality,
      );

      // Update PM2.5 if supported
      if (this.deviceSupportsPM25()) {
        const pm25 = await this.getPM25Density();
        this.service.updateCharacteristic(
          this.platform.Characteristic.PM2_5Density,
          pm25,
        );
      }

      // Update PM10 if supported
      if (this.deviceSupportsPM10()) {
        const pm10 = await this.getPM10Density();
        this.service.updateCharacteristic(
          this.platform.Characteristic.PM10Density,
          pm10,
        );
      }

      this.platform.log.debug(`${this.device.deviceName} AQ: Updated air quality characteristics`);
    } catch (error) {
      this.platform.log.error(`${this.device.deviceName} AQ: Failed to update characteristics:`, error);
    }
  }

  /**
   * Get device capabilities (required by BaseAccessory)
   */
  protected getDeviceCapabilities() {
    return {
      hasSpeed: false,
      hasAirQuality: true,
      hasChildLock: false,
      hasBrightness: false,
      hasHumidity: false,
      hasWaterLevel: false,
      hasSwingMode: false,
      hasColorTemp: false,
      hasColor: false,
    };
  }

  /**
   * Setup the service (required by BaseAccessory)
   */
  protected setupService(): void {
    // Service is already set up in constructor
  }

  /**
   * Update device specific states (required by BaseAccessory)
   */
  protected async updateDeviceSpecificStates(): Promise<void> {
    await this.updateCharacteristics();
  }

  /**
   * Identify this accessory
   */
  identify(): void {
    this.platform.log.info(`${this.device.deviceName} AQ Sensor: Identify!`);
  }
}