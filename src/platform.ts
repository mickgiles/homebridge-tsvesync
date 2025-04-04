import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { VeSync } from 'tsvesync';
import { DeviceFactory } from './utils/device-factory';
import { BaseAccessory } from './accessories/base.accessory';
import { PluginLogger } from './utils/logger';
import { createRateLimitedVeSync } from './utils/api-proxy';
import { PlatformConfig as TSVESyncPlatformConfig } from './types/device.types';

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
  private lastLoginAttempt: Date = new Date(0);
  private loginBackoffTime = 10000; // Start with 10 seconds
  private initializationPromise: Promise<void>;
  private initializationResolver!: () => void;
  private isInitialized = false;
  private readonly logger!: PluginLogger;
  private readonly TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
  private lastTokenRefresh: Date = new Date(0);

  constructor(
    public readonly log: Logger,
    public readonly config: TSVESyncPlatformConfig,
    public readonly api: API,
  ) {
    // Create initialization promise
    this.initializationPromise = new Promise((resolve) => {
      this.initializationResolver = resolve;
    });

    // Get config values with defaults
    this.updateInterval = config.updateInterval || 30;
    this.debug = config.debug || false;

    // Initialize logger
    this.logger = new PluginLogger(this.log, this.debug);

    // Validate configuration
    if (!config.username || !config.password) {
      this.logger.error('Missing required configuration. Please check your config.json');
      return;
    }

    // Initialize VeSync client with all configuration
    this.client = createRateLimitedVeSync(
      config.username,
      config.password,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      this.debug,
      true, // redact sensitive info
      config.apiUrl,
      this.logger,
      config.exclude,
      { quotaManagement: config.quotaManagement || { enabled: true } }
    );

    this.logger.debug('Initialized platform with config:', {
      name: config.name,
      username: config.username,
      updateInterval: this.updateInterval,
      debug: this.debug,
      apiUrl: config.apiUrl,
    });

    this.logger.info('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    this.api.on('didFinishLaunching', async () => {
      this.logger.debug('Executed didFinishLaunching callback');

      try {
        // Initialize platform
        await this.initializePlatform();
        
    // Set up device update interval - default is 30 seconds, but we'll increase it to reduce API calls
    const effectiveUpdateInterval = Math.max(this.updateInterval, 120); // Minimum 2 minutes (120 seconds)
    this.deviceUpdateInterval = setInterval(() => {
      this.updateDeviceStates();
    }, effectiveUpdateInterval * 1000);
    
    if (effectiveUpdateInterval > this.updateInterval) {
      this.logger.warn(`Increased update interval from ${this.updateInterval} to ${effectiveUpdateInterval} seconds to reduce API calls and prevent quota exhaustion`);
    }
      } catch (error) {
        this.logger.error('Failed to initialize platform:', error);
        // Ensure initialization is resolved even on error
        this.isInitialized = true;
        this.initializationResolver();
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
      try {
        // Add a 30 second timeout to prevent infinite waiting
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Platform initialization timed out')), 30000);
        });

        await Promise.race([this.initializationPromise, timeoutPromise]);
      } catch (error) {
        this.logger.error('Platform initialization failed:', error);
        // Force initialization state to true to prevent further waiting
        this.isInitialized = true;
        this.initializationResolver();
        throw error;
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
        throw new Error('Failed to login to VeSync API');
      }

      // Get devices from API
      await this.client.update();

      // Discover devices
      await this.discoverDevices();

      // Mark as initialized before initializing accessories
      this.isInitialized = true;
      this.initializationResolver();

      // Initialize all accessories
      const initPromises = Array.from(this.deviceAccessories.entries()).map(([uuid, accessory]) => {
        const deviceName = this.accessories.find(acc => acc.UUID === uuid)?.displayName || uuid;
        return accessory.initialize().catch(error => {
          this.logger.error(`Failed to initialize accessory ${deviceName}:`, error);
        });
      });
      
      await Promise.all(initPromises);
    } catch (error) {
      this.logger.error('Failed to initialize platform:', error);
      // Still resolve the promise to allow retries during polling
      this.isInitialized = true;
      this.initializationResolver();
      throw error;
    }
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.logger.info('Loading accessory from cache:', accessory.displayName);
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
    // Check if token needs refresh
    const timeSinceLastRefresh = Date.now() - this.lastTokenRefresh.getTime();
    if (!forceLogin && timeSinceLastRefresh < this.TOKEN_EXPIRY) {
      return true; // Token is still valid
    }

    let isLoggedIn = false;
    while (!isLoggedIn) {  // Keep trying until successful
      try {
        // Check if we need to wait for backoff
        const timeSinceLastAttempt = Date.now() - this.lastLoginAttempt.getTime();
        if (timeSinceLastAttempt < this.loginBackoffTime) {
          const waitTime = this.loginBackoffTime - timeSinceLastAttempt;
          this.logger.debug(`Waiting ${waitTime}ms before next login attempt (backoff)`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Need to login again
        this.logger.debug(forceLogin ? 'Forcing new login to VeSync API' : 'Refreshing VeSync API token');
        
        this.lastLoginAttempt = new Date();
        const loginResult = await this.client.login();
        
        if (!loginResult) {
          this.logger.error('Login failed - invalid credentials or API error');
          this.loginBackoffTime = Math.min(this.loginBackoffTime * 2, 300000);
          continue;  // Try again after backoff
        }
        
        // Reset backoff and update token refresh time on successful login
        this.loginBackoffTime = 10000;
        this.lastTokenRefresh = new Date();
        isLoggedIn = true;
        return true;
      } catch (error) {
        // Handle specific errors
        const errorObj = error as any;
        const errorMsg = errorObj?.error?.msg || errorObj?.msg || String(error);
        
        if (errorMsg.includes('Not logged in')) {
          this.logger.debug('Session expired, forcing new login');
          this.loginBackoffTime = Math.min(this.loginBackoffTime, 5000);
          continue;  // Try again after backoff
        }
        
        // Increase backoff time exponentially, max 5 minutes
        this.loginBackoffTime = Math.min(this.loginBackoffTime * 2, 300000);
        
        this.logger.error('Login error:', error);
        continue;  // Try again after backoff
      }
    }
    return true;  // This line will never be reached but TypeScript needs it
  }

  /**
   * Update device states periodically
   */
  private async updateDeviceStates() {
    await this.discoverDevices();
  }

  /**
   * Check if a device should be excluded based on configuration
   */
  private shouldExcludeDevice(device: any): boolean {
    const exclude = this.config.exclude;
    if (!exclude) {
      return false;
    }

    // Check device type
    if (exclude.type?.includes(device.deviceType.toLowerCase())) {
      this.logger.debug(`Excluding device ${device.deviceName} by type: ${device.deviceType}`);
      return true;
    }

    // Check device model
    if (exclude.model?.some(model => device.deviceType.toUpperCase().includes(model.toUpperCase()))) {
      this.logger.debug(`Excluding device ${device.deviceName} by model: ${device.deviceType}`);
      return true;
    }

    // Check exact name match
    if (exclude.name?.includes(device.deviceName.trim())) {
      this.logger.debug(`Excluding device ${device.deviceName} by exact name match`);
      return true;
    }

    // Check name patterns
    if (exclude.namePattern) {
      for (const pattern of exclude.namePattern) {
        try {
          const regex = new RegExp(pattern);
          if (regex.test(device.deviceName.trim())) {
            this.logger.debug(`Excluding device ${device.deviceName} by name pattern: ${pattern}`);
            return true;
          }
        } catch (error) {
          this.logger.warn(`Invalid regex pattern in exclude config: ${pattern}`);
        }
      }
    }

    // Check device ID (cid or uuid)
    if (exclude.id?.includes(device.cid) || exclude.id?.includes(device.uuid)) {
      this.logger.debug(`Excluding device ${device.deviceName} by ID: ${device.cid}/${device.uuid}`);
      return true;
    }

    return false;
  }

  /**
   * This function discovers and registers your devices as accessories
   */
  async discoverDevices() {
    this.logger.debug('Discovering devices');
    try {
      // Try to login first
      if (!await this.ensureLogin()) {
        return;
      }

      let retryCount = 0;
      let success = false;

      // Keep retrying API calls
      while (!success) {
        try {
          // Update device data from API
          await this.client.update();
          success = true;
        } catch (error) {
          retryCount++;
          const backoffTime = Math.min(10000 * Math.pow(2, retryCount), 300000);
          this.logger.warn(`API call failed, retry attempt ${retryCount}. Waiting ${backoffTime/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          // Try to ensure we're still logged in before next attempt
          if (!await this.ensureLogin()) {
            continue;
          }
        }
      }

      // Get all devices
      const devices = this.getAllDevices().filter(device => !this.shouldExcludeDevice(device));

      // Update quota manager with device count
      if (typeof (this.client as any).updateQuotaDeviceCount === 'function') {
        (this.client as any).updateQuotaDeviceCount(devices.length);
        this.logger.debug(`Updated quota manager with ${devices.length} devices`);
      }

      // Track processed devices for cleanup
      const processedDeviceUUIDs = new Set<string>();

      // Loop over the discovered devices and register each one
      for (const device of devices) {
        // Generate a unique id for the accessory
        const uuid = this.generateDeviceUUID(device);
        processedDeviceUUIDs.add(uuid);

        // Check if an accessory already exists
        let accessory = this.accessories.find(acc => acc.UUID === uuid);

        if (accessory) {
          // Accessory already exists
          this.logger.debug('Restoring existing accessory from cache:', device.deviceName);
          
          // Update the accessory context
          accessory.context.device = this.createDeviceContext(device);
          
          // Update accessory
          this.api.updatePlatformAccessories([accessory]);
        } else {
          // Create a new accessory
          this.logger.info('Adding new accessory:', device.deviceName);
          
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

        // Try to update device state with retries
        let stateRetryCount = 0;
        let stateSuccess = false;
        while (!stateSuccess && stateRetryCount < 3) { // Limit retries to 3 attempts
          try {
            await deviceAccessory.syncDeviceState();
            stateSuccess = true;
          } catch (error) {
            stateRetryCount++;
            // Only retry if we haven't hit the limit
            if (stateRetryCount < 3) {
              const backoffTime = Math.min(5000 * Math.pow(2, stateRetryCount), 30000);
              this.logger.warn(`Failed to sync device state for ${device.deviceName}, retry attempt ${stateRetryCount}. Waiting ${backoffTime/1000} seconds...`);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
              
              // Try to ensure we're still logged in before next attempt
              if (!await this.ensureLogin()) {
                continue;
              }
            } else {
              this.logger.error(`Failed to sync device state for ${device.deviceName} after ${stateRetryCount} attempts. Skipping.`);
              // Continue with other devices even if this one fails
              break;
            }
          }
        }
      }

      // Remove platform accessories that no longer exist or are now excluded
      this.accessories
        .filter(accessory => !processedDeviceUUIDs.has(accessory.UUID))
        .forEach(accessory => {
          this.logger.info('Removing existing accessory:', accessory.displayName);
          try {
            // Remove from platform's accessories array first
            const index = this.accessories.indexOf(accessory);
            if (index > -1) {
              this.accessories.splice(index, 1);
            }
            // Then try to unregister from the bridge
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          } catch (error) {
            this.logger.debug(`Failed to unregister accessory ${accessory.displayName}, it may have already been removed:`, error);
          }
          // Always clean up the device accessory handler
          this.deviceAccessories.delete(accessory.UUID);
        });

    } catch (error) {
      this.logger.error('Failed to discover devices:', error);
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
