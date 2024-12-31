import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { TSVESyncAccessory } from './platformAccessory';
import { VeSync } from 'tsvesync/dist/src/lib/vesync';

export class TSVESyncPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  
  private client!: VeSync;
  private deviceUpdateInterval?: NodeJS.Timeout;
  private readonly updateInterval!: number;
  private readonly debug!: boolean;

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

    // Get config values with defaults
    this.updateInterval = config.updateInterval || 30;
    this.debug = config.debug || false;

    // Initialize VeSync client
    this.client = new VeSync(
      config.username,
      config.password,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      this.debug
    );

    if (this.debug) {
      this.log.debug('Initialized platform with config:', {
        name: config.name,
        username: config.username,
        updateInterval: this.updateInterval,
        debug: this.debug,
      });
    }

    this.log.info('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    this.api.on('didFinishLaunching', () => {
      if (this.debug) {
        this.log.debug('Executed didFinishLaunching callback');
      }
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
      
      // Set up periodic device updates
      this.deviceUpdateInterval = setInterval(() => {
        this.updateDeviceStates();
      }, this.updateInterval * 1000); // Convert to milliseconds
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
   * Get all devices from all categories
   */
  private getAllDevices() {
    return [
      ...this.client.fans,
      ...this.client.outlets,
      ...this.client.switches,
      ...this.client.bulbs,
    ];
  }

  /**
   * Discover VeSync devices and register them as accessories
   */
  async discoverDevices() {
    try {
      if (this.debug) {
        this.log.debug('Starting device discovery');
      }

      // Login and get devices
      await this.client.login();
      const success = await this.client.getDevices();

      if (!success) {
        this.log.error('Failed to get devices');
        return;
      }

      const devices = this.getAllDevices();

      if (this.debug) {
        this.log.debug('Found devices:', devices.length);
      }

      // Loop over the discovered devices and register each one
      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.cid);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          if (this.debug) {
            this.log.debug('Restoring existing accessory from cache:', existingAccessory.displayName);
          }
          existingAccessory.context.device = device;
          new TSVESyncAccessory(this, existingAccessory, device);
          
        } else {
          this.log.info('Adding new accessory:', device.deviceName);
          const accessory = new this.api.platformAccessory(device.deviceName, uuid);
          accessory.context.device = device;
          new TSVESyncAccessory(this, accessory, device);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }

      // Remove accessories that are no longer present
      this.accessories.forEach(accessory => {
        const device = devices.find(device => this.api.hap.uuid.generate(device.cid) === accessory.UUID);
        if (!device) {
          if (this.debug) {
            this.log.debug('Removing accessory no longer present:', accessory.displayName);
          }
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
      if (this.debug) {
        this.log.debug('Updating device states');
      }

      await this.client.login();
      const success = await this.client.getDevices();
      
      if (!success) {
        this.log.error('Failed to get devices');
        return;
      }

      const devices = this.getAllDevices();
      
      this.accessories.forEach(accessory => {
        const device = devices.find(d => this.api.hap.uuid.generate(d.cid) === accessory.UUID);
        if (device) {
          if (this.debug) {
            this.log.debug('Updated state for device:', accessory.displayName);
          }
          accessory.context.device = device;
        }
      });
    } catch (error) {
      this.log.error('Failed to update device states:', error);
    }
  }
} 