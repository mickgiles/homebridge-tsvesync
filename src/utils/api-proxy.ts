import { VeSync } from 'tsvesync';
import { PluginLogger } from './logger';
import { DeviceExclusion } from '../types/device.types';
import { QuotaManager } from './quota-manager';

const RATE_LIMIT_DELAY = 500; // 500ms between API calls
const DEBOUNCE_DELAY = 5000; // 5 second debounce for rapid changes

class RateLimiter {
  private lastCallTime = 0;
  private lastMethodName = '';
  private debounceTimers: Map<string, {
    timer: NodeJS.Timeout;
    lastValue: any;
    inProgress: boolean;
  }> = new Map();
  private quotaManager: QuotaManager;
  private methodCallCounts: Map<string, number> = new Map();
  private lastMethodLogTime = 0;
  private readonly METHOD_LOG_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

  constructor(
    private readonly logger: PluginLogger,
    deviceCount: number = 0,
    quotaConfig?: {
      bufferPercentage?: number;
      priorityMethods?: string[];
    }
  ) {
    this.quotaManager = new QuotaManager(logger, deviceCount, quotaConfig);
  }

  /**
   * Update the device count for quota calculation
   */
  updateDeviceCount(count: number): void {
    this.quotaManager.updateDeviceCount(count);
  }

  async rateLimit(methodName: string): Promise<boolean> {
    // First check if we can make this API call based on quota
    if (!this.quotaManager.canMakeApiCall(methodName)) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < RATE_LIMIT_DELAY) {
      const waitTime = RATE_LIMIT_DELAY - timeSinceLastCall;
      this.logger.debug(`Rate limiting '${methodName}' - waiting ${waitTime}ms before next API call (previous call was '${this.lastMethodName}' ${timeSinceLastCall}ms ago)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastMethodName = methodName;
    this.lastCallTime = Date.now();
    this.logger.debug(`Executing API call '${methodName}'`);
    
    // Track method call counts for diagnostics
    this.trackMethodCall(methodName);
    
    // Record this API call in the quota manager
    this.quotaManager.recordApiCall(methodName);
    return true;
  }
  
  /**
   * Track method call counts for diagnostics
   */
  private trackMethodCall(methodName: string): void {
    // Increment the call count for this method
    const currentCount = this.methodCallCounts.get(methodName) || 0;
    this.methodCallCounts.set(methodName, currentCount + 1);
    
    // Log method call statistics periodically
    const now = Date.now();
    if (now - this.lastMethodLogTime >= this.METHOD_LOG_INTERVAL) {
      this.logMethodCallStatistics();
      this.lastMethodLogTime = now;
    }
  }
  
  /**
   * Log method call statistics to help identify frequent API calls
   */
  private logMethodCallStatistics(): void {
    // Sort methods by call count (descending)
    const sortedMethods = Array.from(this.methodCallCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    if (sortedMethods.length === 0) {
      return;
    }
    
    // Log the top 10 most frequently called methods
    this.logger.debug('Top API methods by call frequency:');
    sortedMethods.slice(0, 10).forEach(([method, count], index) => {
      this.logger.debug(`${index + 1}. ${method}: ${count} calls`);
    });
    
    // Calculate total calls
    const totalCalls = sortedMethods.reduce((sum, [_, count]) => sum + count, 0);
    this.logger.debug(`Total API calls: ${totalCalls}`);
    
    // Reset counters after logging
    this.methodCallCounts.clear();
  }

  private getDebounceKey(methodName: string, deviceId: string | undefined, args: any[]): string {
    const paramsKey = args.length > 0 ? `-${JSON.stringify(args)}` : '';
    return deviceId ? `${methodName}-${deviceId}${paramsKey}` : `${methodName}${paramsKey}`;
  }

  debounce<T>(methodName: string, deviceId: string | undefined, fn: () => Promise<T>, args: any[]): Promise<T | null> {
    // First check if we can make this API call based on quota
    if (!this.quotaManager.canMakeApiCall(methodName)) {
      // Log at WARN level as requested by user
      this.logger.warn(`Quota exceeded. Skipping API call: ${methodName}${deviceId ? ` for device ${deviceId}` : ''}${args.length > 0 ? ` with args ${JSON.stringify(args)}` : ''}`);
      return Promise.resolve(null);
    }

    const key = this.getDebounceKey(methodName, deviceId, args);
    const pending = this.debounceTimers.get(key);
    
    // If there's an active debounce timer and a call is in progress, skip this call
    if (pending?.inProgress) {
      this.logger.debug(`Skipping '${methodName}'${deviceId ? ` for device ${deviceId}` : ''} with args ${JSON.stringify(args)} - call already in progress`);
      return Promise.resolve(pending.lastValue);
    }

    // If we're within the debounce window but no call is in progress, return the last value
    if (pending && !pending.inProgress) {
      this.logger.debug(`Reusing last value for '${methodName}'${deviceId ? ` for device ${deviceId}` : ''} with args ${JSON.stringify(args)}`);
      return Promise.resolve(pending.lastValue);
    }

    // Execute the call
    return (async () => {
      try {
        // Mark call as in progress
        if (pending) {
          pending.inProgress = true;
        }

        this.logger.debug(`Executing '${methodName}'${deviceId ? ` for device ${deviceId}` : ''} with args ${JSON.stringify(args)}`);
        const canProceed = await this.rateLimit(methodName);
        
        if (!canProceed) {
          // Log at WARN level as requested by user
          this.logger.warn(`Quota check failed during execution. Skipping API call: ${methodName}${deviceId ? ` for device ${deviceId}` : ''}${args.length > 0 ? ` with args ${JSON.stringify(args)}` : ''}`);
          return null;
        }
        
        const result = await fn();

        // Store the result and set the debounce timer
        const timer = setTimeout(() => {
          this.debounceTimers.delete(key);
        }, DEBOUNCE_DELAY);

        this.debounceTimers.set(key, {
          timer,
          lastValue: result,
          inProgress: false
        });

        return result;
      } catch (error) {
        // If there was an error, clear the debounce timer
        if (pending) {
          clearTimeout(pending.timer);
          this.debounceTimers.delete(key);
        }
        this.logger.error(`Error in '${methodName}' call:`, error);
        throw error;
      }
    })();
  }
}

// Create a proxy handler that adds rate limiting to API calls
const createRateLimitedProxy = (target: any, rateLimiter: RateLimiter, deviceId?: string): any => {
  return new Proxy(target, {
    get(target, prop) {
      const value = target[prop];
      
      // If it's not a function or it's a getter, return as is
      if (typeof value !== 'function' || prop === 'get') {
        // If it's an array of devices, wrap each device in a proxy
        if (Array.isArray(value) && ['fans', 'outlets', 'switches', 'bulbs', 'humidifiers', 'purifiers'].includes(prop.toString())) {
          return value.map(device => createRateLimitedProxy(device, rateLimiter, device.cid));
        }
        // If it's a device object (has deviceType and cid), wrap it in a proxy
        if (value && typeof value === 'object' && 'deviceType' in value && 'cid' in value) {
          return createRateLimitedProxy(value, rateLimiter, value.cid);
        }
        return value;
      }

      // Methods that bypass all rate limiting and debouncing
      const bypassMethods = [
        // Getters and internal methods
        'get', 'getService', 'getCharacteristic', 'hydrateSession',
        // State accessors
        'deviceStatus', 'speed', 'brightness', 'colorTemp',
        'mode', 'filterLife', 'airQuality', 'airQualityValue', 'screenStatus',
        'childLock', 'pm1', 'pm10', 'humidity', 'mistLevel',
        // Event handlers
        'onSet', 'onGet', 'addListener', 'removeListener',
        // Controlled interval methods
        'update',
        // Feature detection and configuration methods (don't make API calls)
        'hasFeature', 'getMaxFanSpeed', 'isFeatureSupportedInCurrentMode'
      ];
      
      const methodName = prop.toString();
      
      // For bypass methods, return a simple wrapper that calls the original synchronously
      if (bypassMethods.includes(methodName)) {
        return function(...args: any[]) {
          return value.apply(target, args);
        };
      }
      
      // Return a proxied async function that applies rate limiting
      return async function(...args: any[]) {
        // Methods that should only be rate limited (no debouncing)
        const noDebounceAPIMethods = [
          'ignored'
        ];

        if (noDebounceAPIMethods.includes(methodName)) {
          await rateLimiter.rateLimit(methodName);
          return value.apply(target, args);
        }

        // Everything else gets both rate limited and debounced
        return rateLimiter.debounce(methodName, deviceId, () => value.apply(target, args), args);
      };
    }
  });
};

// Export a factory function that creates rate-limited VeSync instances
export const createRateLimitedVeSync = (
  username: string,
  password: string,
  timeZone: string,
  debug?: boolean,
  redact?: boolean,
  apiUrl?: string,
  customLogger?: PluginLogger,
  exclusions?: DeviceExclusion,
  config?: {
    countryCode?: string;
    quotaManagement?: {
      enabled: boolean;
      bufferPercentage?: number;
      priorityMethods?: string[];
    }
  },
  session?: {
    store?: any;
    onTokenChange?: (s: any) => void;
  }
): VeSync => {
  // Use the new options object pattern for VeSync constructor
  const client = new (VeSync as any)(username, password, timeZone, {
    debug: debug,
    redact: redact,
    apiUrl: apiUrl,
    customLogger: customLogger,
    excludeConfig: exclusions,
    countryCode: config?.countryCode || 'US',  // Default to US
    sessionStore: session?.store,
    onTokenChange: session?.onTokenChange
  });
  const logger = customLogger || new PluginLogger(console as any, debug || false);
  
  // Create rate limiter with quota management if enabled
  const quotaConfig = config?.quotaManagement?.enabled ? {
    bufferPercentage: config.quotaManagement.bufferPercentage,
    priorityMethods: config.quotaManagement.priorityMethods
  } : undefined;
  
  const rateLimiter = new RateLimiter(logger, 0, quotaConfig);
  
  // Create the proxy
  const proxy = createRateLimitedProxy(client, rateLimiter);
  
  // Add a method to update device count for quota calculation
  (proxy as any).updateQuotaDeviceCount = (count: number) => {
    rateLimiter.updateDeviceCount(count);
  };
  
  return proxy;
};
