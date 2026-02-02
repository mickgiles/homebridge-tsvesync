import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { VeSync } from 'tsvesync';
import { DeviceFactory } from './utils/device-factory';
import { BaseAccessory } from './accessories/base.accessory';
import { PluginLogger } from './utils/logger';
import { createRateLimitedVeSync } from './utils/api-proxy';
import { PlatformConfig as TSVESyncPlatformConfig } from './types/device.types';
import { FileSessionStore, decodeJwtTimestampsLocal } from './utils/session-store';

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
  // Track AQ sensor accessories separately
  private readonly aqSensorAccessories: Map<string, PlatformAccessory> = new Map();
  /**
   * Track cached accessories that temporarily disappear from the VeSync device list.
   *
   * Some devices stop reporting to the VeSync cloud when powered off/unplugged. If we
   * unregister the HomeKit accessory in those moments, HomeKit treats it as removed and
   * users lose automations. Instead we keep the accessory cached and let it come back.
   */
  private readonly missingAccessories: Set<string> = new Set();
  
  private client!: VeSync;
  private deviceUpdateInterval?: NodeJS.Timeout;
  private refreshTimer?: NodeJS.Timeout;
  private refreshInProgress = false;
  private scheduledExpMs: number | null = null;
  private refreshRemainingMs: number | null = null;
  private readonly updateInterval!: number;
  private readonly debug!: boolean;
  private lastLoginAttempt: Date = new Date(0);
  private loginBackoffTime = 10000; // Start with 10 seconds
  private initializationPromise: Promise<void>;
  private initializationResolver!: () => void;
  private isInitialized = false;
  private readonly logger!: PluginLogger;
  private readonly sessionStore!: FileSessionStore;
  // VeSync JWT tokens are valid for 30 days (verified by decoding the JWT)
  // We'll refresh at 25 days to ensure we never hit expiration
  private readonly TOKEN_EXPIRY = 25 * 24 * 60 * 60 * 1000; // 25 days in milliseconds
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

    // Prepare session store
    this.sessionStore = new FileSessionStore(this.api.user.storagePath(), this.logger);

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
      { 
        countryCode: config.countryCode,
        quotaManagement: config.quotaManagement || { enabled: true } 
      },
      {
        store: this.sessionStore,
        onTokenChange: (s) => this.onTokenChange(s)
      }
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
        // Try to hydrate session from disk before any login
        const session = await this.sessionStore.load();
        if (session) {
          try {
            if ((session as any).username && (session as any).username !== this.config.username) {
              this.logger.info('Found persisted session for a different account; ignoring persisted session.');
            } else {
              this.hydrateSessionCompat(session);
              const ts = decodeJwtTimestampsLocal(session.token);
              // Use actual token issuance time if available to avoid overextending lifetime
              this.lastTokenRefresh = ts?.iat ? new Date(ts.iat * 1000) : new Date();
              const expStr = ts?.exp ? new Date(ts.exp * 1000).toISOString() : 'unknown';
              this.logger.info(`Reusing persisted VeSync session. Token exp: ${expStr}`);
              // Schedule a proactive refresh before expiry
              this.scheduleProactiveRefreshFromToken(session.token);
            }
          } catch (e: any) {
            this.logger.debug(`Failed to hydrate persisted session, will login fresh: ${e?.message || e}`);
          }
        } else {
          this.logger.debug('No persisted VeSync session available; will authenticate.');
        }

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
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
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
      // If we don't have a token/account yet, perform a login once. Otherwise,
      // trust the persisted token and let the library re-login only if the API rejects it.
      if (!(this.client as any).token || !(this.client as any).accountId) {
        if (!await this.ensureLogin()) {
          throw new Error('Failed to login to VeSync API');
        }
      }

      // Discover devices (includes a client.update() with retry)
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
        // Best-effort: persist the fresh session immediately in case callbacks fail
        try {
          const token = (this.client as any).token as string | null;
          const accountId = (this.client as any).accountId as string | null;
          const region = (this.client as any).region as string | null;
          const apiBaseUrl = (this.client as any).apiBaseUrl as string | null;
          if (token && accountId && region && apiBaseUrl) {
            const ts = decodeJwtTimestampsLocal(token);
            await this.sessionStore.save({
              token,
              accountId,
              region,
              apiBaseUrl,
              issuedAt: ts?.iat ?? null,
              expiresAt: ts?.exp ?? null,
              lastValidatedAt: Date.now(),
              username: this.config.username,
            } as any);
          }
        } catch {/* ignore */}
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
    if (this.refreshInProgress) {
      return;
    }

    this.refreshInProgress = true;

    try {
      await this.discoverDevices();

      const syncTasks = Array.from(this.deviceAccessories.values()).map(async accessory => {
        try {
          await accessory.syncDeviceState();
        } catch (error) {
          this.logger.warn('Failed to sync device state during scheduled refresh', error as Error);
        }
      });

      await Promise.all(syncTasks);
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Handle token updates from the library
   */
  private onTokenChange(session: { token: string } | undefined) {
    if (!session?.token) return;
    this.scheduleProactiveRefreshFromToken(session.token);
    // NOTE: The library already saved the session via sessionStore.save()
    // We should NOT save again here as it creates a race condition and corrupts the file
    // The username field is added during initial login in onSuccessfulLogin()
  }

  /**
   * Backward-compatible session hydration when using older tsvesync versions
   */
  private hydrateSessionCompat(session: { token: string; accountId: string; countryCode?: string | null; apiBaseUrl?: string; region?: string }) {
    const client: any = this.client as any;
    if (typeof client.hydrateSession === 'function') {
      client.hydrateSession(session);
      return;
    }
    // Fallback: set core fields directly
    client.token = session.token;
    client.accountId = session.accountId;
    client.countryCode = session.countryCode ?? null;
    if (session.apiBaseUrl) {
      client.apiBaseUrl = session.apiBaseUrl;
    }
    if (session.region) {
      try { client.region = session.region; } catch { /* ignore */ }
    }
    client.enabled = true;
  }

  /**
   * Schedule a proactive token refresh before JWT expiry
   */
  private scheduleProactiveRefreshFromToken(token: string) {
    try {
      const ts = decodeJwtTimestampsLocal(token);
      if (!ts?.exp) {
        return; // Cannot schedule without exp
      }
      const now = Date.now();
      const expMs = ts.exp * 1000;
      const msToExpiry = expMs - now;
      
      // If we already have a timer for this exact token expiration, skip
      if (this.scheduledExpMs === expMs && this.refreshTimer) {
        return;
      }
      if (msToExpiry <= 0) {
        // Already expired; trigger immediate login in background
        void this.ensureLogin(true);
        return;
      }

      // Schedule policy to prevent thrash and avoid frequent logins:
      // - If >7d left: refresh 5d before expiry
      // - If 1–7d left: refresh 12h before expiry
      // - If 1–24h left: refresh 1h before expiry
      // - If <1h left: do not proactively refresh; rely on library's 401-triggered re-login
      const ONE_HOUR = 60 * 60 * 1000;
      const TWELVE_HOURS = 12 * ONE_HOUR;
      const FIVE_DAYS = 5 * 24 * ONE_HOUR;
      const SEVEN_DAYS = 7 * 24 * ONE_HOUR;

      let refreshIn: number;
      if (msToExpiry > SEVEN_DAYS) {
        refreshIn = msToExpiry - FIVE_DAYS;
      } else if (msToExpiry > 24 * ONE_HOUR) {
        refreshIn = msToExpiry - TWELVE_HOURS;
      } else if (msToExpiry > ONE_HOUR) {
        refreshIn = msToExpiry - ONE_HOUR;
      } else {
        // Too close to expiry; avoid hammering login — let 401 path handle it
        this.logger.debug('Token near expiry (<1h). Skipping proactive refresh; relying on auto re-login.');
        return;
      }

      // Safety floor: never schedule earlier than 30 minutes from now
      refreshIn = Math.max(refreshIn, 30 * 60 * 1000);

      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
      }
      this.scheduledExpMs = expMs;
      // Handle Node.js setTimeout max delay (~24.8 days). Chain timers when needed.
      const MAX_DELAY = 0x7fffffff; // 2,147,483,647 ms
      if (refreshIn > MAX_DELAY) {
        this.refreshRemainingMs = refreshIn - MAX_DELAY;
        this.logger.debug('Proactive refresh scheduled beyond setTimeout max; chaining timers.');
        this.refreshTimer = setTimeout(() => this.chainRefreshTimer(), MAX_DELAY);
      } else {
        this.refreshRemainingMs = 0;
        this.refreshTimer = setTimeout(async () => {
          if (this.refreshInProgress) {
            this.logger.debug('Proactive refresh already in progress; skipping.');
            return;
          }
          this.refreshInProgress = true;
          this.logger.debug('Proactively refreshing VeSync session before token expiry');
          try {
            await this.ensureLogin(true);
          } finally {
            this.refreshInProgress = false;
          }
        }, refreshIn);
      }

      const hours = Math.round(refreshIn / (60 * 60 * 1000));
      this.logger.debug(`Scheduled proactive token refresh in ~${hours}h`);
    } catch (e) {
      // Best-effort scheduling; ignore errors
    }
  }

  private chainRefreshTimer() {
    if (!this.refreshRemainingMs || this.refreshRemainingMs <= 0) {
      // Final hop: trigger refresh now
      if (this.refreshInProgress) {
        this.logger.debug('Proactive refresh already in progress; skipping.');
        return;
      }
      this.refreshInProgress = true;
      this.logger.debug('Proactively refreshing VeSync session before token expiry');
      void this.ensureLogin(true).finally(() => { this.refreshInProgress = false; });
      return;
    }
    const MAX_DELAY = 0x7fffffff;
    const hop = Math.min(this.refreshRemainingMs, MAX_DELAY);
    this.refreshRemainingMs -= hop;
    this.refreshTimer = setTimeout(() => this.chainRefreshTimer(), hop);
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
      // Do not force login; rely on library to re-login only if needed

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

        // Create or reuse the accessory handler (do not recreate on every poll)
        let deviceAccessory = this.deviceAccessories.get(uuid);
        if (deviceAccessory) {
          // tsvesync recreates device instances on each update(); merge latest state into the existing instance
          deviceAccessory.applyUpdatedDeviceState(device as any);
        } else {
          deviceAccessory = DeviceFactory.createAccessory(this, accessory, device);
          deviceAccessory.applyUpdatedDeviceState(device as any);
          this.deviceAccessories.set(uuid, deviceAccessory);
        }

        // Check if device needs a separate AQ sensor accessory
        if (this.deviceHasAirQuality(device) && DeviceFactory.isAirPurifier(device.deviceType)) {
          const aqUuid = this.generateDeviceUUID(device, '-AQ');
          processedDeviceUUIDs.add(aqUuid);
          
          // Check if AQ sensor accessory already exists
          let aqAccessory = this.accessories.find(acc => acc.UUID === aqUuid);
          
          if (aqAccessory) {
            // AQ sensor accessory already exists
            this.logger.debug('Restoring existing AQ sensor from cache:', device.deviceName + ' AQ');
            
            // Update the accessory context
            aqAccessory.context.device = this.createDeviceContext(device);
            aqAccessory.context.isAQSensor = true;
            aqAccessory.context.parentUUID = uuid; // Store parent relationship
            
            // Update accessory
            this.api.updatePlatformAccessories([aqAccessory]);
          } else {
            // Create a new AQ sensor accessory
            this.logger.debug('Adding new AQ sensor accessory:', device.deviceName + ' AQ');
            
            // Create the AQ sensor accessory with SENSOR category
            aqAccessory = new this.api.platformAccessory(
              device.deviceName + ' Air Quality',
              aqUuid,
              this.api.hap.Categories.SENSOR
            );
            
            // Store device information in context
            aqAccessory.context.device = this.createDeviceContext(device);
            aqAccessory.context.isAQSensor = true;
            aqAccessory.context.parentUUID = uuid; // Store parent relationship
          }
          
          // Store the AQ sensor accessory
          this.aqSensorAccessories.set(aqUuid, aqAccessory);
          
          // Create or reuse the AQ sensor accessory handler
          const existingAqSensorAccessory = this.deviceAccessories.get(aqUuid);
          if (existingAqSensorAccessory) {
            existingAqSensorAccessory.applyUpdatedDeviceState(device as any);
          } else {
            const createdAqSensorAccessory = DeviceFactory.createAQSensorAccessory(this, aqAccessory, device);
            if (createdAqSensorAccessory) {
              createdAqSensorAccessory.applyUpdatedDeviceState(device as any);
              this.deviceAccessories.set(aqUuid, createdAqSensorAccessory);
            
              // Register new AQ sensor accessory
              if (!this.accessories.find(acc => acc.UUID === aqUuid)) {
                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [aqAccessory]);
                this.accessories.push(aqAccessory);
              }
            } else {
              this.logger.warn(`${device.deviceName}: Failed to create AQ sensor accessory handler - DeviceFactory.createAQSensorAccessory returned null`);
            }
          }
        }

        // Register new accessories
        if (!this.accessories.find(acc => acc.UUID === uuid)) {
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
        }
      }

      // Remove platform accessories that no longer exist or are now excluded
      // If any previously-missing accessories reappear, clear the missing marker
      for (const uuid of processedDeviceUUIDs) {
        if (this.missingAccessories.delete(uuid)) {
          const accessory = this.accessories.find(acc => acc.UUID === uuid);
          if (accessory) {
            this.logger.info('Accessory is back online:', accessory.displayName);
          }
        }
      }

      // Do NOT automatically unregister accessories just because they weren't returned by the API.
      // VeSync devices can disappear from the cloud list when offline (e.g., powered off to clean
      // a filter), and unregistering causes HomeKit automations to be removed/broken.
      //
      // We only remove accessories when they are explicitly excluded by config.
      const orphanedAccessories = this.accessories.filter(accessory => !processedDeviceUUIDs.has(accessory.UUID));
      for (const accessory of orphanedAccessories) {
        if (this.isAccessoryExcluded(accessory)) {
          this.unregisterAccessory(accessory, 'excluded by configuration');
          continue;
        }

        if (!this.missingAccessories.has(accessory.UUID)) {
          this.missingAccessories.add(accessory.UUID);
          this.logger.warn(
            `Accessory "${accessory.displayName}" is missing from the VeSync device list. Keeping it cached to preserve HomeKit automations; it should recover automatically when the device comes back online.`
          );
        }
      }

    } catch (error) {
      this.logger.error('Failed to discover devices:', error);
    }
  }

  private isAccessoryExcluded(accessory: PlatformAccessory): boolean {
    const device = (accessory.context as any)?.device;
    if (!device) {
      return false;
    }
    try {
      return this.shouldExcludeDevice(device);
    } catch {
      return false;
    }
  }

  private unregisterAccessory(accessory: PlatformAccessory, reason: string) {
    this.logger.info(`Removing existing accessory (${reason}):`, accessory.displayName);

    // Remove from platform's accessories array first
    const index = this.accessories.indexOf(accessory);
    if (index > -1) {
      this.accessories.splice(index, 1);
    }

    // Remove from tracking maps
    this.deviceAccessories.delete(accessory.UUID);
    this.aqSensorAccessories.delete(accessory.UUID);
    this.missingAccessories.delete(accessory.UUID);

    // Then try to unregister from the bridge
    try {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    } catch (error) {
      this.logger.debug(`Failed to unregister accessory ${accessory.displayName}, it may have already been removed:`, error);
    }
  }

  /**
   * Generate a consistent UUID for a device
   * @param device The device to generate a UUID for
   * @param suffix Optional suffix for accessory type (e.g., '-AQ' for air quality sensor)
   * @returns The generated UUID string
   */
  private generateDeviceUUID(device: { cid: string; isSubDevice?: boolean; subDeviceNo?: number }, suffix = ''): string {
    let id = device.cid;
    if (device.isSubDevice && device.subDeviceNo !== undefined) {
      id = `${device.cid}_${device.subDeviceNo}`;
    }
    return this.api.hap.uuid.generate(id + suffix);
  }

  /**
   * Check if a device has air quality sensor
   * @param device The device to check
   * @returns true if device has AQ sensor
   */
  private deviceHasAirQuality(device: any): boolean {
    // Use the device's native feature detection if available
    if (typeof device.hasFeature === 'function') {
      return device.hasFeature('air_quality');
    }
    
    // Fallback to device type checking for older devices
    const deviceType = device.deviceType || '';
    // Core300S, Core400S, Core600S have AQ sensors
    // Core200S does NOT have AQ sensor
    return (deviceType.includes('Core300S') || 
            deviceType.includes('Core400S') || 
            deviceType.includes('Core600S') ||
            (deviceType.includes('LAP-') && !deviceType.includes('LAP-EL')) ||
            deviceType.includes('LV-PUR131S'));
  }
}
