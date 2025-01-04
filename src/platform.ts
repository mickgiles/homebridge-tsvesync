import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { VeSync } from 'tsvesync';
import { DeviceFactory } from './utils/device-factory';
import { BaseAccessory } from './accessories/base.accessory';

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
  private readonly debug!: boolean;
  private lastLogin: Date = new Date(0); // Track last successful login
  private lastLoginAttempt: Date = new Date(0);
  private loginBackoffTime = 1000; // Start with 1 second
  private initializationPromise: Promise<void>;
  private initializationResolver!: () => void;
  private isInitialized = false;

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
    this.updateInterval = config.updateInterval || 30;
    this.debug = config.debug || false;

    // Initialize VeSync client with all configuration
    this.client = new VeSync(
      config.username,
      config.password,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      this.debug,
      true, // redact sensitive info
      config.apiUrl,
      this.log
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
        
        // Set up periodic device updates
        this.deviceUpdateInterval = setInterval(() => {
          this.updateDeviceStates().catch(error => {
            const err = error instanceof Error ? error : new Error(String(error));
            this.log.error('=== UPDATE INTERVAL: Failed to update device states ===', err);
          });
        }, this.updateInterval * 1000);
      } catch (error) {
        this.log.error('Failed to initialize platform:', error);
      }
    });

    // Clean up when shutting down
    this.api.on('shutdown', () => {
      if (this.deviceUpdateInterval) {
        clearInterval(this.deviceUpdateInterval);
      }
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
   * Initialize all accessories
   */
  private async initializeAccessories(): Promise<void> {
    
    // Initialize accessories in batches to avoid overwhelming the API
    const batchSize = 2;
    const delay = 5000; // 5 second delay between batches
    const accessories = Array.from(this.deviceAccessories.entries());
    
    for (let i = 0; i < accessories.length; i += batchSize) {
      const batch = accessories.slice(i, i + batchSize);
      
      const batchPromises = batch.map(([uuid, accessory]) => {
        const deviceName = this.accessories.find(acc => acc.UUID === uuid)?.displayName || uuid;
        return accessory.initialize().catch(error => {
          this.log.error(`=== INIT: Failed to initialize accessory ${deviceName} ===`, error);
        });
      });
      
      await Promise.all(batchPromises);
      
      if (i + batchSize < accessories.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Initialize the platform
   */
  private async initializePlatform(): Promise<void> {
    try {
      // Try to login first
      if (!await this.ensureLogin()) {
        this.log.error('=== INIT: Initial login failed ===');
        throw new Error('Failed to login to VeSync API');
      }

      // Get devices from API
      const success = await this.client.getDevices();
      if (!success) {
        this.log.error('=== INIT: Failed to get devices from API ===');
        throw new Error('Failed to get devices from API');
      }

      // Discover devices
      await this.discoverDevices();

      // Mark platform as initialized before accessory initialization
      this.isInitialized = true;
      this.initializationResolver();

      // Initialize all accessories with staggered approach
      await this.initializeAccessories();
      
    } catch (error) {
      this.log.error('Failed to initialize platform:', error);
      // Still resolve the promise to allow retries during polling
      this.initializationResolver();
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
  private async ensureLogin(): Promise<boolean> {
    try {
      // Check if we need to wait due to backoff
      const timeSinceLastAttempt = Date.now() - this.lastLoginAttempt.getTime();
      if (timeSinceLastAttempt < this.loginBackoffTime) {
        const waitTime = this.loginBackoffTime - timeSinceLastAttempt;
        if (this.debug) {
          this.log.debug(`Waiting ${waitTime}ms before next login attempt`);
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      this.lastLoginAttempt = new Date();
      const loginResult = await this.client.login();
      
      if (!loginResult) {
        this.log.error('Login failed - invalid credentials or API error');
        this.loginBackoffTime = Math.min(this.loginBackoffTime * 2, 300000);
        return false;
      }
      
      this.lastLogin = new Date();
      this.loginBackoffTime = 1000; // Reset backoff on successful login
      return true;
    } catch (error) {
      // Use minimal backoff for auth errors to allow quick retry
      if (error instanceof Error && error.message.includes('auth')) {
        this.loginBackoffTime = Math.min(this.loginBackoffTime, 5000);
      } else {
        // Increase backoff time exponentially for other errors, max 5 minutes
        this.loginBackoffTime = Math.min(this.loginBackoffTime * 2, 300000);
      }
      
      this.log.error('Login error:', error);
      return false;
    }
  }

  /**
   * Update device states from the API
   */
  public async updateDeviceStatesFromAPI(isPolledUpdate = false) {
    if (!this.isInitialized) {
      if (this.debug) {
        this.log.debug('Skipping device state update - platform not initialized');
      }
      return;
    }

    try {
      // Ensure we're logged in
      const loginSuccess = await this.ensureLogin();
      if (!loginSuccess) {
        throw new Error('Failed to login for device state update');
      }

      // Get devices from API
      const success = await this.client.getDevices();
      if (!success) {
        throw new Error('Failed to get devices from API');
      }

      // Get all devices
      const devices = this.getAllDevices();
      if (!devices || !devices.length) {
        if (!isPolledUpdate) {
          this.log.warn('=== UPDATE API: No devices found during state update ===');
        }
        return;
      }

      // Update each device
      for (const device of devices) {
        const accessory = this.deviceAccessories.get(this.generateDeviceUUID(device));
        if (accessory) {
          try {
            await accessory.syncDeviceState();
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.log.error(`=== UPDATE API: Failed to update state for device ${device.deviceName} ===`, err);
          }
        }
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      if (!isPolledUpdate || this.debug) {
        this.log.error('=== UPDATE API: Failed to update device states ===', err);
      }
      throw err;
    }
  }

  /**
   * Update device states periodically
   */
  private async updateDeviceStates() {
    try {
      await this.updateDeviceStatesFromAPI(true);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log.error('=== UPDATE STATES: Periodic update failed ===', err);
    }
  }

  /**
   * This function discovers and registers your devices as accessories
   */
  async discoverDevices() {
    try {
      // Try to login first
      if (!await this.ensureLogin()) {
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
} 