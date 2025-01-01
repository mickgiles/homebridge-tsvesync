import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { VeSync } from 'tsvesync';
import { setApiBaseUrl } from 'tsvesync/src/lib/helpers';
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
      // If not forcing login and last login was less than 23 hours ago, try using existing session
      const loginAge = Date.now() - this.lastLogin.getTime();
      if (!forceLogin && loginAge < 23 * 60 * 60 * 1000) { // 23 hours in milliseconds
        if (this.debug) {
          this.log.debug('Using existing login session');
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
      
      // Reset backoff on successful login
      this.loginBackoffTime = 1000;
      return true;
    } catch (error) {
      // Handle specific "Not logged in" error
      const errorObj = error as any;
      const errorMsg = errorObj?.error?.msg || errorObj?.msg || String(error);
      
      if (errorMsg.includes('Not logged in')) {
        if (this.debug) {
          this.log.debug('Session expired, forcing new login');
        }
        // Clear last login time to force a new login on next attempt
        this.lastLogin = new Date(0);
        // Use minimal backoff for session expiry
        this.loginBackoffTime = Math.min(this.loginBackoffTime, 5000);
        return false;
      }
      
      // Increase backoff time exponentially, max 5 minutes
      this.loginBackoffTime = Math.min(this.loginBackoffTime * 2, 300000);
      
      const errorCode = errorObj?.error?.code || errorObj?.code;
      
      if (errorCode === 'ECONNRESET' || errorCode === 'ETIMEDOUT' || errorMsg.includes('timeout')) {
        this.log.warn('Network error during login, will retry with backoff:', errorMsg);
      } else if (errorMsg.includes('rate limit')) {
        this.log.warn('Hit API rate limit, will retry with longer backoff');
        this.loginBackoffTime = Math.max(this.loginBackoffTime, 60000); // At least 1 minute for rate limits
      } else {
        this.log.error('Failed to login:', errorMsg);
      }
      return false;
    }
  }

  /**
   * Update device states from the API
   * @param isPolledUpdate Whether this update is from the polling interval
   */
  public async updateDeviceStatesFromAPI(isPolledUpdate = false) {
    try {
      if (this.debug) {
        this.log.debug(isPolledUpdate ? 'Polling device states' : 'Updating device states on demand');
      }

      // Try using cached login first
      let loginSuccess = await this.ensureLogin();
      if (!loginSuccess) {
        // If first login fails, try one more time with force login
        this.log.debug('Initial login failed, attempting forced login...');
        loginSuccess = await this.ensureLogin(true);
        if (!loginSuccess) {
          this.log.error('Failed to login after retry, will attempt again later');
          return;
        }
      }

      // Get fresh device list with retries
      let success = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!success && retryCount < maxRetries) {
        try {
          success = await this.client.getDevices();
          if (!success) {
            if (retryCount < maxRetries - 1) {
              this.log.debug(`Failed to get devices (attempt ${retryCount + 1}/${maxRetries}), retrying...`);
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            } else {
              this.log.error('Failed to get devices after all retries');
            }
          }
        } catch (error) {
          const errorObj = error as any;
          const errorMsg = errorObj?.error?.msg || errorObj?.msg || String(error);
          
          if (errorMsg.includes('Not logged in')) {
            this.log.debug('Session expired while getting devices, attempting re-login...');
            if (await this.ensureLogin(true)) {
              // Reset retry count if we successfully logged in again
              retryCount = 0;
              continue;
            }
          }
          
          if (retryCount < maxRetries - 1) {
            this.log.warn(`Error getting devices (attempt ${retryCount + 1}/${maxRetries}): ${errorMsg}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          } else {
            throw error;
          }
        }
        retryCount++;
      }
      
      // If getting devices failed after retries, try forcing a new login
      if (!success) {
        this.log.debug('Failed to get devices after retries, trying to re-login...');
        if (!await this.ensureLogin(true)) {
          this.log.error('Failed to re-login');
          return;
        }
        success = await this.client.getDevices();
        if (!success) {
          this.log.error('Failed to get devices even after re-login');
          return;
        }
      }

      // Get all devices with fresh states
      const devices = this.getAllDevices();
      
      if (this.debug) {
        this.log.debug(`Found ${devices.length} devices to update`);
      }
      
      // Update each accessory's context with fresh state
      for (const accessory of this.accessories) {
        const device = devices.find(d => this.api.hap.uuid.generate(d.cid) === accessory.UUID);
        if (device) {
          try {
            // Create fresh device context
            const context = this.createDeviceContext(device);
            
            // Only update if there are actual changes
            if (JSON.stringify(accessory.context.device) !== JSON.stringify(context)) {
              accessory.context.device = context;
              
              // Update platform accessories to persist changes
              this.api.updatePlatformAccessories([accessory]);
              
              if (this.debug) {
                this.log.debug(`Updated state for device: ${device.deviceName}`);
              }
            }
          } catch (error) {
            this.log.error(`Failed to update device state for ${device.deviceName}:`, error);
          }
        }
      }
    } catch (error) {
      const errorObj = error as any;
      const errorMsg = errorObj?.error?.msg || errorObj?.msg || String(error);
      this.log.error('Failed to update device states:', errorMsg);
      
      // If this was a polled update, we'll let the next poll try again
      if (!isPolledUpdate) {
        throw error; // Re-throw for non-polled updates to handle at caller
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
        const uuid = this.api.hap.uuid.generate(device.cid);

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
        .filter(accessory => !devices.find(device => this.api.hap.uuid.generate(device.cid) === accessory.UUID))
        .forEach(accessory => {
          this.log.info('Removing existing accessory:', accessory.displayName);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.deviceAccessories.delete(accessory.UUID);
        });

    } catch (error) {
      this.log.error('Failed to discover devices:', error);
    }
  }
} 