import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TSVESyncPlatform } from './platform';
import { VeSyncBaseDevice } from 'tsvesync/dist/src/lib/vesyncBaseDevice';

interface VeSyncDeviceWithPower extends VeSyncBaseDevice {
  deviceStatus: string;
  turnOn(): Promise<boolean>;
  turnOff(): Promise<boolean>;
}

interface VeSyncDeviceWithBrightness extends VeSyncDeviceWithPower {
  brightness: number;
  setBrightness(value: number): Promise<boolean>;
}

interface VeSyncDeviceWithSpeed extends VeSyncDeviceWithPower {
  speed: number;
  maxSpeed: number;
  setSpeed(value: number): Promise<boolean>;
}

export class TSVESyncAccessory {
  private service!: Service;

  constructor(
    private readonly platform: TSVESyncPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: VeSyncBaseDevice,
  ) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'VeSync')
      .setCharacteristic(this.platform.Characteristic.Model, device.deviceType)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, device.cid);

    // Set up the appropriate service based on device type
    this.setupService();
  }

  private setupService() {
    const deviceType = this.device.deviceType;
    
    if (deviceType.includes('BULB')) {
      this.setupBulb();
    } else if (deviceType.includes('FAN') || deviceType.includes('AIR')) {
      this.setupFan();
    } else {
      this.setupSwitch();
    }
  }

  private setupBulb() {
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) 
      || this.accessory.addService(this.platform.Service.Lightbulb);

    // Add brightness characteristic if device supports it
    const bulb = this.device as VeSyncDeviceWithBrightness;
    if ('setBrightness' in bulb) {
      this.service.getCharacteristic(this.platform.Characteristic.Brightness)
        .onSet(this.setBrightness.bind(this))
        .onGet(this.getBrightness.bind(this));
    }

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));
  }

  private setupFan() {
    this.service = this.accessory.getService(this.platform.Service.Fan)
      || this.accessory.addService(this.platform.Service.Fan);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    const fan = this.device as VeSyncDeviceWithSpeed;
    if ('setSpeed' in fan) {
      this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .onSet(this.setFanSpeed.bind(this))
        .onGet(this.getFanSpeed.bind(this));
    }
  }

  private setupSwitch() {
    this.service = this.accessory.getService(this.platform.Service.Switch)
      || this.accessory.addService(this.platform.Service.Switch);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));
  }

  async setOn(value: CharacteristicValue) {
    try {
      const device = this.device as VeSyncDeviceWithPower;
      const newState = value as boolean;
      if (newState) {
        await device.turnOn();
      } else {
        await device.turnOff();
      }
      this.platform.log.debug('Set power state ->', value);
    } catch (error) {
      this.platform.log.error('Failed to set power state:', error);
      throw error;
    }
  }

  async getOn(): Promise<CharacteristicValue> {
    try {
      const device = this.device as VeSyncDeviceWithPower;
      const deviceContext = this.accessory.context.device;
      return deviceContext.deviceStatus === 'on';
    } catch (error) {
      this.platform.log.error('Failed to get power state:', error);
      throw error;
    }
  }

  async setBrightness(value: CharacteristicValue) {
    try {
      const device = this.device as VeSyncDeviceWithBrightness;
      await device.setBrightness(value as number);
      this.platform.log.debug('Set brightness ->', value);
    } catch (error) {
      this.platform.log.error('Failed to set brightness:', error);
      throw error;
    }
  }

  async getBrightness(): Promise<CharacteristicValue> {
    try {
      const deviceContext = this.accessory.context.device;
      return deviceContext.details.brightness || 100;
    } catch (error) {
      this.platform.log.error('Failed to get brightness:', error);
      throw error;
    }
  }

  async setFanSpeed(value: CharacteristicValue) {
    try {
      const device = this.device as VeSyncDeviceWithSpeed;
      // Convert HomeKit 0-100 to device speed levels
      const speed = Math.ceil((value as number) / (100 / device.maxSpeed));
      await device.setSpeed(speed);
      this.platform.log.debug('Set fan speed ->', speed);
    } catch (error) {
      this.platform.log.error('Failed to set fan speed:', error);
      throw error;
    }
  }

  async getFanSpeed(): Promise<CharacteristicValue> {
    try {
      const deviceContext = this.accessory.context.device;
      const maxSpeed = (this.device as VeSyncDeviceWithSpeed).maxSpeed;
      // Convert device speed levels to HomeKit 0-100
      return (deviceContext.details.speed || 0) * (100 / maxSpeed);
    } catch (error) {
      this.platform.log.error('Failed to get fan speed:', error);
      throw error;
    }
  }
} 