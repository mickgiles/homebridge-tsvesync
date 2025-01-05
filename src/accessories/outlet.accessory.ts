import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncOutlet } from '../types/device.types';

// Constants for power monitoring service
const POWER_SERVICE_NAME = 'Power Consumption';
const POWER_CHARACTERISTIC = {
  displayName: 'Power',
  UUID: '7B2B25B0-DB50-4351-9A8B-5B9F3E3E3E3E',
};
const VOLTAGE_CHARACTERISTIC = {
  displayName: 'Voltage',
  UUID: '7B2B25B1-DB50-4351-9A8B-5B9F3E3E3E3E',
};
const ENERGY_CHARACTERISTIC = {
  displayName: 'Energy',
  UUID: '7B2B25B2-DB50-4351-9A8B-5B9F3E3E3E3E',
};

export class OutletAccessory extends BaseAccessory {
  protected readonly device: VeSyncOutlet;
  private powerService?: Service;

  // Custom characteristics for power monitoring
  private readonly POWER_UUID = '7B2B25B0-DB50-4351-9A8B-5B9F3E3E3E3E';
  private readonly VOLTAGE_UUID = '7B2B25B1-DB50-4351-9A8B-5B9F3E3E3E3E';
  private readonly ENERGY_UUID = '7B2B25B2-DB50-4351-9A8B-5B9F3E3E3E3E';

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncOutlet,
  ) {
    super(platform, accessory, device);
    this.device = device;
  }

  protected setupService(): void {
    // Get or create the outlet service
    this.service = this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    // Set up required characteristics
    this.setupCharacteristic(
      this.platform.Characteristic.On,
      this.getOn.bind(this),
      this.setOn.bind(this)
    );

    // Set up outlet in use characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.OutletInUse,
      this.getOutletInUse.bind(this)
    );

    // Add power consumption characteristics if supported
    if (this.device.power !== undefined) {
      this.setupPowerMonitoringService();
    }

    // Add Name characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.Name,
      async () => this.device.deviceName
    );
  }

  private setupPowerMonitoringService(): void {
    // Create power consumption service
    this.powerService = this.accessory.getService(POWER_SERVICE_NAME) ||
      this.accessory.addService(this.platform.Service.Switch, POWER_SERVICE_NAME, 'power-consumption');

    // Add power characteristic
    const powerChar = this.powerService.getCharacteristic(POWER_CHARACTERISTIC.UUID) ||
      this.powerService.addCharacteristic(new this.platform.api.hap.Characteristic(
        POWER_CHARACTERISTIC.displayName,
        POWER_CHARACTERISTIC.UUID,
        {
          format: this.platform.Characteristic.Formats.FLOAT,
          unit: 'W',
          minValue: 0,
          maxValue: 10000,
          minStep: 0.1,
          perms: [this.platform.Characteristic.Perms.READ, this.platform.Characteristic.Perms.NOTIFY]
        }
      ));

    powerChar.onGet(this.getPower.bind(this));

    // Add voltage characteristic if available
    if (this.device.voltage !== undefined) {
      const voltageChar = this.powerService.getCharacteristic(VOLTAGE_CHARACTERISTIC.UUID) ||
        this.powerService.addCharacteristic(new this.platform.api.hap.Characteristic(
          VOLTAGE_CHARACTERISTIC.displayName,
          VOLTAGE_CHARACTERISTIC.UUID,
          {
            format: this.platform.Characteristic.Formats.FLOAT,
            unit: 'V',
            minValue: 0,
            maxValue: 250,
            minStep: 0.1,
            perms: [this.platform.Characteristic.Perms.READ, this.platform.Characteristic.Perms.NOTIFY]
          }
        ));

      voltageChar.onGet(this.getVoltage.bind(this));
    }

    // Add energy characteristic if available
    if (this.device.energy !== undefined) {
      const energyChar = this.powerService.getCharacteristic(ENERGY_CHARACTERISTIC.UUID) ||
        this.powerService.addCharacteristic(new this.platform.api.hap.Characteristic(
          ENERGY_CHARACTERISTIC.displayName,
          ENERGY_CHARACTERISTIC.UUID,
          {
            format: this.platform.Characteristic.Formats.FLOAT,
            unit: 'kWh',
            minValue: 0,
            maxValue: 100000,
            minStep: 0.001,
            perms: [this.platform.Characteristic.Perms.READ, this.platform.Characteristic.Perms.NOTIFY]
          }
        ));

      energyChar.onGet(this.getEnergy.bind(this));
    }
  }

  /**
   * Update device states based on the latest details
   */
  protected async updateDeviceSpecificStates(details: any): Promise<void> {
    const outletDetails = details as {
      deviceStatus: string;
      power?: number;
      voltage?: number;
      energy?: number;
    };

    // Update active state
    const isActive = outletDetails.deviceStatus === 'on';
    this.updateCharacteristicValue(
      this.platform.Characteristic.On,
      isActive
    );

    // Update outlet in use (always true when device is on)
    this.updateCharacteristicValue(
      this.platform.Characteristic.OutletInUse,
      isActive
    );

    // Update power monitoring characteristics if available
    const powerService = this.accessory.getService(POWER_SERVICE_NAME);
    if (powerService) {
      if (outletDetails.power !== undefined) {
        powerService.updateCharacteristic(this.POWER_UUID, outletDetails.power);
      }

      if (outletDetails.voltage !== undefined) {
        powerService.updateCharacteristic(this.VOLTAGE_UUID, outletDetails.voltage);
      }

      if (outletDetails.energy !== undefined) {
        powerService.updateCharacteristic(this.ENERGY_UUID, outletDetails.energy);
      }
    }
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

  private async getOutletInUse(): Promise<CharacteristicValue> {
    // Consider outlet in use if it's on and consuming power (if power monitoring is available)
    return this.device.deviceStatus === 'on' && 
           (this.device.power ? this.device.power > 0 : true);
  }

  private async getPower(): Promise<CharacteristicValue> {
    return this.device.power || 0;
  }

  private async getVoltage(): Promise<CharacteristicValue> {
    return this.device.voltage || 0;
  }

  private async getEnergy(): Promise<CharacteristicValue> {
    return this.device.energy || 0;
  }
} 