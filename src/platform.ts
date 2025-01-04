import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { VeSync } from 'tsvesync';
import { DeviceFactory } from './utils/device-factory';
import { BaseAccessory } from './accessories/base.accessory';
import { PollingManager } from './utils/polling-manager';
import { PluginLogger } from './utils/logger';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class TSVESyncPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  private readonly deviceAccessories: Map<string, BaseAccessory> = new Map();
  
  private client!: VeSync;
  private deviceUpdateInterval?: NodeJS.Timeout;
  private readonly updateInterval!: number;
  public readonly debug!: boolean;
  private lastLogin: Date = new Date(0); // Track last successful login
  private lastLoginAttempt: Date = new Date(0);
  private loginBackoffTime = 1000; // Start with 1 second
  private initializationPromise: Promise<void>;
  private initializationResolver!: () => void;
  private isInitialized = false;
  private pollingManager!: PollingManager;
  private readonly logger!: PluginLogger;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    // Create initialization promise
    this.initializationPromise = new Promise((resolve) => {
      this.initializationResolver = resolve;
    });

    // Validate configuration
    if (!config.username || !config.password) {
      log.error('Missing required configuration. Please check your config.json');
      return;
    }

    // Get config values with defaults
    this.updateInterval = config.updateInterval || 300; // Default to 5 minutes
    this.debug = config.debug || false;

    // Initialize logger
    this.logger = new PluginLogger(log, this.debug);

    // Initialize polling manager
    this.pollingManager = new PollingManager(this.log, config.polling);

    // Initialize VeSync client with all configuration
    this.client = new VeSync(
      config.username,
      config.password,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      this.debug,
      true, // redact sensitive info
      config.apiUrl,
      this.logger.createVeSyncLogger()
    );

    if (this.debug) {
      this.log.debug('Initialized platform with config:', {
        name: config.name,
        username: config.username,
        updateInterval: this.updateInterval,
        debug: this.debug,
        apiUrl: config.apiUrl,
      });
    }

    this.log.info('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    this.api.on('didFinishLaunching', async () => {
      if (this.debug) {
        this.log.debug('Executed didFinishLaunching callback');
      }

      try {
        // Initialize platform
        await this.initializePlatform();
        
        // Start polling for device updates
        this.pollingManager.startPolling(() => this.updateDeviceStates());
      } catch (error) {
        this.log.error('Failed to initialize platform:', error);
      }
    });

    // Clean up when shutting down
    this.api.on('shutdown', () => {
      this.pollingManager.stopPolling();
    });
  }

  /**
   * Check if platform is ready
   */
  public async isReady(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializationPromise;
    }
  }

  /**
   * Initialize the platform
   */
  private async initializePlatform(): Promise<void> {
    try {
      // Login to VeSync
      await this.ensureLogin();

      // Get devices from VeSync
      const success = await this.client.getDevices();
      if (!success) {
        throw new Error('Failed to get devices from VeSync');
      }

      const devices = [
        ...this.client.fans,
        ...this.client.outlets,
        ...this.client.switches,
        ...this.client.bulbs,
        ...this.client.humidifiers,
        ...this.client.purifiers,
      ];
      this.logger.debug('Retrieved devices from VeSync', { operation: 'initializePlatform', value: devices.length });

      // Create accessories for each device
      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.uuid);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          this.logger.debug('Restoring existing accessory from cache', {
            operation: 'initializePlatform',
            deviceName: existingAccessory.displayName,
            deviceType: device.deviceType,
          });
          existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);
          const accessory = DeviceFactory.createAccessory(this, existingAccessory, device);
          if (accessory) {
            this.logger.debug('Successfully restored accessory', {
              operation: 'initializePlatform',
              deviceName: existingAccessory.displayName,
              deviceType: device.deviceType,
            });
          }
        } else {
          this.logger.debug('Adding new accessory', {
            operation: 'initializePlatform',
            deviceName: device.deviceName,
            deviceType: device.deviceType,
          });
          const accessory = new this.api.platformAccessory(device.deviceName, uuid);
          accessory.context.device = device;
          const createdAccessory = DeviceFactory.createAccessory(this, accessory, device);
          if (createdAccessory) {
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            this.logger.debug('Successfully added new accessory', {
              operation: 'initializePlatform',
              deviceName: device.deviceName,
              deviceType: device.deviceType,
            });
          }
        }
      }

      // Remove platform accessories that no longer exist
      for (const accessory of this.accessories) {
        const device = devices.find(device => this.api.hap.uuid.generate(device.uuid) === accessory.UUID);
        if (!device) {
          this.logger.debug('Removing accessory no longer in VeSync', {
            operation: 'initializePlatform',
            deviceName: accessory.displayName,
            deviceType: accessory.context.device?.deviceType || 'unknown',
          });
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }

      // Start device update interval
      this.startDeviceUpdateInterval();

      // Mark platform as initialized
      this.isInitialized = true;
      this.initializationResolver();
      this.logger.debug('Platform initialization complete', { operation: 'initializePlatform' });
    } catch (error) {
      this.logger.error('Failed to initialize platform', { operation: 'initializePlatform' }, error as Error);
      throw error;
    }
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
   * Create a serializable device context
   */
  private createDeviceContext(device: any) {
    return {
      cid: device.cid,
      deviceName: device.deviceName.trim(),
      deviceStatus: device.deviceStatus,
      deviceType: device.deviceType,
      deviceRegion: device.deviceRegion,
      uuid: device.uuid,
      configModule: device.configModule,
      macId: device.macId,
      deviceCategory: device.deviceCategory,
      connectionStatus: device.connectionStatus,
      details: device.details || {},
      config: device.config || {}
    };
  }

  /**
   * Ensure client is logged in
   */
  private async ensureLogin(): Promise<void> {
    const now = new Date();
    const timeSinceLastLogin = now.getTime() - this.lastLogin.getTime();
    const timeSinceLastAttempt = now.getTime() - this.lastLoginAttempt.getTime();

    // Check if we need to login
    if (timeSinceLastLogin < 3600000) {
      this.logger.debug('Using existing login session', { operation: 'ensureLogin' });
      return;
    }

    // Implement backoff for login attempts
    if (timeSinceLastAttempt < this.loginBackoffTime) {
      this.logger.debug('Waiting for login backoff time', { operation: 'ensureLogin' });
      await new Promise(resolve => setTimeout(resolve, this.loginBackoffTime - timeSinceLastAttempt));
    }

    try {
      this.logger.debug('Logging in to VeSync', { operation: 'ensureLogin' });
      this.lastLoginAttempt = now;
      const success = await this.client.login();
      if (!success) {
        throw new Error('Failed to login to VeSync');
      }
      this.lastLogin = now;
      this.loginBackoffTime = 1000; // Reset backoff time on successful login
      this.logger.debug('Successfully logged in to VeSync', { operation: 'ensureLogin' });
    } catch (error) {
      this.loginBackoffTime = Math.min(this.loginBackoffTime * 2, 300000); // Max 5 minutes
      this.logger.error('Failed to log in to VeSync', { operation: 'ensureLogin' }, error as Error);
      throw error;
    }
  }

  /**
   * Update device states from the API
   */
  public async updateDeviceStatesFromAPI(): Promise<void> {
    if (!this.isInitialized) {
      this.logger.debug('Platform not initialized, skipping device update', { operation: 'updateDeviceStates' });
      return;
    }

    try {
      this.logger.debug('Updating device states from API', { operation: 'updateDeviceStates' });
      await this.ensureLogin();
      const success = await this.client.getDevices();
      if (!success) {
        throw new Error('Failed to get devices from VeSync');
      }

      const devices = [
        ...this.client.fans,
        ...this.client.outlets,
        ...this.client.switches,
        ...this.client.bulbs,
        ...this.client.humidifiers,
        ...this.client.purifiers,
      ];
      this.logger.debug('Retrieved device states', { operation: 'updateDeviceStates', value: devices.length });

      // Update each accessory with its corresponding device state
      for (const accessory of this.accessories) {
        const device = devices.find(d => this.api.hap.uuid.generate(d.uuid) === accessory.UUID);
        if (device) {
          const baseAccessory = DeviceFactory.createAccessory(this, accessory, device);
          if (baseAccessory) {
            accessory.context.device = device;
            await baseAccessory.updateFromPlatform(device);
            this.logger.debug('Updated device state', {
              operation: 'updateDeviceStates',
              deviceName: accessory.displayName,
              deviceType: device.deviceType,
            });
          }
        } else {
          this.logger.warn('Device no longer exists', {
            operation: 'updateDeviceStates',
            deviceName: accessory.displayName,
            deviceType: accessory.context.device?.deviceType || 'unknown',
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to update device states', { operation: 'updateDeviceStates' }, error as Error);
    }
  }

  /**
   * Update device states periodically
   */
  private async updateDeviceStates(): Promise<void> {
    try {
      await this.updateDeviceStatesFromAPI();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log.error('=== UPDATE STATES: Periodic update failed ===', err);
    }
  }

  /**
   * This function discovers and registers your devices as accessories
   */
  async discoverDevices(): Promise<void> {
    try {
      // Try to login first
      try {
        await this.ensureLogin();
      } catch (error) {
        this.log.error('Failed to login during device discovery:', error);
        return;
      }

      // Get devices from API
      const success = await this.client.getDevices();
      if (!success) {
        this.log.error('Failed to get devices from API');
        return;
      }

      // Get all devices
      const devices = this.getAllDevices();

      // Loop over the discovered devices and register each one
      for (const device of devices) {
        // Generate a unique id for the accessory
        const uuid = this.generateDeviceUUID(device);

        // Check if an accessory already exists
        let accessory = this.accessories.find(acc => acc.UUID === uuid);

        if (accessory) {
          // Accessory already exists
          this.log.info('Restoring existing accessory from cache:', device.deviceName);
          
          // Update the accessory context
          accessory.context.device = this.createDeviceContext(device);
          
          // Update accessory
          this.api.updatePlatformAccessories([accessory]);
        } else {
          // Create a new accessory
          this.log.info('Adding new accessory:', device.deviceName);
          
          // Create the accessory
          accessory = new this.api.platformAccessory(
            device.deviceName,
            uuid,
            DeviceFactory.getAccessoryCategory(device.deviceType)
          );

          // Store device information in context
          accessory.context.device = this.createDeviceContext(device);
        }

        // Create the accessory handler
        const deviceAccessory = DeviceFactory.createAccessory(this, accessory, device);
        this.deviceAccessories.set(uuid, deviceAccessory);

        // Register new accessories
        if (!this.accessories.find(acc => acc.UUID === uuid)) {
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
        }
      }

      // Remove platform accessories that no longer exist
      this.accessories
        .filter(accessory => !devices.find(device => this.generateDeviceUUID(device) === accessory.UUID))
        .forEach(accessory => {
          this.log.info('Removing existing accessory:', accessory.displayName);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.deviceAccessories.delete(accessory.UUID);
        });

    } catch (error) {
      this.log.error('Failed to discover devices:', error);
    }
  }

  /**
   * Generate a consistent UUID for a device
   * @param device The device to generate a UUID for
   * @returns The generated UUID string
   */
  private generateDeviceUUID(device: { cid: string; isSubDevice?: boolean; subDeviceNo?: number }): string {
    let id = device.cid;
    if (device.isSubDevice && device.subDeviceNo !== undefined) {
      id = `${device.cid}_${device.subDeviceNo}`;
    }
    return this.api.hap.uuid.generate(id);
  }

  private startDeviceUpdateInterval(): void {
    if (this.deviceUpdateInterval) {
      clearInterval(this.deviceUpdateInterval);
    }

    this.logger.debug('Starting device update interval', {
      operation: 'startDeviceUpdateInterval',
      value: `${this.updateInterval} seconds`,
    });
    this.deviceUpdateInterval = setInterval(
      () => {
        this.updateDeviceStatesFromAPI().catch(error => {
          this.logger.error('Failed to update device states', { operation: 'updateDeviceStates' }, error as Error);
        });
      },
      this.updateInterval * 1000,
    );
  }
} 