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
  private tokenRefreshInterval?: NodeJS.Timeout;
  private readonly updateInterval!: number;
  private readonly debug!: boolean;
  private lastLogin: Date = new Date(0); // Track last successful login
  private lastLoginAttempt: Date = new Date(0);
  private loginBackoffTime = 1000; // Start with 1 second
  private tokenExpiryTime?: Date; // Track when the token will expire
  private readonly TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiry
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
          this.updateDeviceStates();
        }, this.updateInterval * 1000); // Convert to milliseconds
      } catch (error) {
        this.log.error('Failed to initialize platform:', error);
      }
    });

    // Set up token refresh interval
    this.tokenRefreshInterval = setInterval(() => {
      this.checkAndRefreshToken();
    }, 60 * 1000); // Check token every minute

    // Clean up when shutting down
    this.api.on('shutdown', () => {
      if (this.deviceUpdateInterval) {
        clearInterval(this.deviceUpdateInterval);
      }
      if (this.tokenRefreshInterval) {
        clearInterval(this.tokenRefreshInterval);
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
   * Initialize the platform
   */
  private async initializePlatform(): Promise<void> {
    try {
      // Try to login first
      if (!await this.ensureLogin()) {
        throw new Error('Failed to login to VeSync API');
      }

      // Get devices from API
      const success = await this.client.getDevices();
      if (!success) {
        throw new Error('Failed to get devices from API');
      }

      // Discover devices
      await this.discoverDevices();

      // Initialize all accessories
      const initPromises = Array.from(this.deviceAccessories.entries()).map(([uuid, accessory]) => {
        const deviceName = this.accessories.find(acc => acc.UUID === uuid)?.displayName || uuid;
        return accessory.initialize().catch(error => {
          this.log.error(`Failed to initialize accessory ${deviceName}:`, error);
        });
      });
      
      await Promise.all(initPromises);

      this.isInitialized = true;
      this.initializationResolver();
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
   * Ensure client is logged in, but avoid unnecessary logins
   */
  private async ensureLogin(forceLogin = false): Promise<boolean> {
    try {
      // If not forcing login and we have a valid token, use it
      if (!forceLogin && this.tokenExpiryTime && Date.now() < this.tokenExpiryTime.getTime() - this.TOKEN_REFRESH_BUFFER) {
        if (this.debug) {
          this.log.debug('Using existing valid token');
        }
        return true;
      }

      // Check if we need to wait due to backoff
      const timeSinceLastAttempt = Date.now() - this.lastLoginAttempt.getTime();
      if (timeSinceLastAttempt < this.loginBackoffTime) {
        const waitTime = this.loginBackoffTime - timeSinceLastAttempt;
        if (this.debug) {
          this.log.debug(`Waiting ${waitTime}ms before next login attempt`);
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Need to login again
      if (this.debug) {
        this.log.debug(forceLogin ? 'Forcing new login to VeSync API' : 'Logging in to VeSync API');
      }
      
      this.lastLoginAttempt = new Date();
      const loginResult = await this.client.login();
      
      if (!loginResult) {
        this.log.error('Login failed - invalid credentials or API error');
        this.loginBackoffTime = Math.min(this.loginBackoffTime * 2, 300000);
        return false;
      }
      
      this.lastLogin = new Date();
      
      // Set token expiry time - default to 23 hours if not provided by API
      const tokenTTL = (loginResult as any)?.tokenTTL || 23 * 60 * 60;
      this.tokenExpiryTime = new Date(Date.now() + tokenTTL * 1000);
      
      if (this.debug) {
        this.log.debug(`Token will expire at ${this.tokenExpiryTime.toISOString()}`);
      }
      
      // Reset backoff on successful login
      this.loginBackoffTime = 1000;
      return true;
    } catch (error) {
      // Handle specific errors
      const errorObj = error as any;
      const errorMsg = errorObj?.error?.msg || errorObj?.msg || String(error);
      const errorCode = errorObj?.code || errorObj?.error?.code;
      
      // Handle token expiry specifically
      if (errorCode === 4001004 || errorMsg.includes('token expired')) {
        if (this.debug) {
          this.log.debug('Token expired, forcing new login');
        }
        // Clear token expiry time to force a new login
        this.tokenExpiryTime = undefined;
        // Use minimal backoff for token expiry
        this.loginBackoffTime = 1000;
        // Try immediate relogin
        return this.ensureLogin(true);
      }
      
      if (errorMsg.includes('Not logged in')) {
        if (this.debug) {
          this.log.debug('Session expired, forcing new login');
        }
        this.tokenExpiryTime = undefined;
        this.loginBackoffTime = Math.min(this.loginBackoffTime, 5000);
        return false;
      }
      
      // Increase backoff time exponentially, max 5 minutes
      this.loginBackoffTime = Math.min(this.loginBackoffTime * 2, 300000);
      
      this.log.error('Login error:', error);
      return false;
    }
  }

  /**
   * Handle operation retry with token refresh
   */
  public async withTokenRefresh<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const errorObj = error as any;
      const errorCode = errorObj?.code || errorObj?.error?.code;
      
      // If token expired, try to refresh and retry once
      if (errorCode === 4001004 || (errorObj?.msg || '').includes('token expired')) {
        if (this.debug) {
          this.log.debug('Operation failed due to token expiry, attempting refresh and retry');
        }
        
        // Force new login
        const loginSuccess = await this.ensureLogin(true);
        if (loginSuccess) {
          // Retry the operation
          return await operation();
        }
      }
      
      throw error;
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
      await this.withTokenRefresh(async () => {
        // Ensure we're logged in
        const loginSuccess = await this.ensureLogin();
        if (!loginSuccess) {
          throw new Error('Failed to login for device state update');
        }

        // Get all devices
        const devices = await this.getAllDevices();
        if (!devices || !devices.length) {
          if (!isPolledUpdate) {
            this.log.warn('No devices found during state update');
          }
          return;
        }

        if (this.debug) {
          this.log.debug(`Updating states for ${devices.length} devices`);
        }

        // Update each device
        for (const device of devices) {
          const accessory = this.deviceAccessories.get(this.generateDeviceUUID(device));
          if (accessory) {
            try {
              await accessory.syncDeviceState();
            } catch (error) {
              this.log.error(`Failed to update state for device ${device.deviceName}:`, error);
            }
          }
        }
      });
    } catch (error) {
      const errorObj = error as any;
      const errorMsg = errorObj?.msg || String(error);
      
      if (!isPolledUpdate || this.debug) {
        this.log.error('Failed to update device states:', errorMsg);
      }
    }
  }

  /**
   * Update device states periodically
   */
  private async updateDeviceStates() {
    await this.updateDeviceStatesFromAPI(true);
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

  /**
   * Check if token needs refresh and refresh if needed
   */
  private async checkAndRefreshToken(): Promise<void> {
    if (!this.tokenExpiryTime) {
      // If we don't have an expiry time, force a new login
      if (this.debug) {
        this.log.debug('No token expiry time, forcing new login');
      }
      await this.ensureLogin(true);
      return;
    }

    const timeUntilExpiry = this.tokenExpiryTime.getTime() - Date.now();
    if (timeUntilExpiry <= this.TOKEN_REFRESH_BUFFER) {
      if (this.debug) {
        this.log.debug(`Token expires in ${Math.floor(timeUntilExpiry / 1000)}s, refreshing`);
      }
      await this.ensureLogin(true);
    }
  }
} 