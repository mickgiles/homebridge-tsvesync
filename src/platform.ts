import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { TSVESyncAccessory } from './platformAccessory';
import { TSVESync, Device } from 'tsvesync';

export class TSVESyncPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  
  private readonly client: TSVESync;
  private deviceUpdateInterval?: NodeJS.Timeout;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    // Validate configuration
    if (!config.username || !config.password) {
      log.error('Missing required configuration. Please check your config.json');
      return;
    }

    // Initialize TSVESync client
    this.client = new TSVESync({
      username: config.username,
      password: config.password,
    });

    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
      
      // Set up periodic device updates (every 30 seconds)
      this.deviceUpdateInterval = setInterval(() => {
        this.updateDeviceStates();
      }, 30000);
    });

    // Clean up when shutting down
    this.api.on('shutdown', () => {
      if (this.deviceUpdateInterval) {
        clearInterval(this.deviceUpdateInterval);
      }
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  /**
   * Discover TSVESync devices and register them as accessories
   */
  async discoverDevices() {
    try {
      // Login and get devices
      await this.client.login();
      const devices = await this.client.getDevices();

      // Loop over the discovered devices and register each one
      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.id);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          existingAccessory.context.device = device;
          new TSVESyncAccessory(this, existingAccessory, this.client);
          
        } else {
          this.log.info('Adding new accessory:', device.name);
          const accessory = new this.api.platformAccessory(device.name, uuid);
          accessory.context.device = device;
          new TSVESyncAccessory(this, accessory, this.client);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }

      // Remove accessories that are no longer present
      this.accessories.forEach(accessory => {
        const device = devices.find(device => this.api.hap.uuid.generate(device.id) === accessory.UUID);
        if (!device) {
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      });

    } catch (error) {
      this.log.error('Failed to discover devices:', error);
    }
  }

  /**
   * Update all device states
   */
  private async updateDeviceStates() {
    try {
      await this.client.login();
      const devices = await this.client.getDevices();
      
      this.accessories.forEach(accessory => {
        const device = devices.find(d => this.api.hap.uuid.generate(d.id) === accessory.UUID);
        if (device) {
          accessory.context.device = device;
        }
      });
    } catch (error) {
      this.log.error('Failed to update device states:', error);
    }
  }
} 