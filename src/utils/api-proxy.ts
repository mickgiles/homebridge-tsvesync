import { VeSync } from 'tsvesync';
import { PluginLogger } from './logger';
import { DeviceExclusion } from '../types/device.types';

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

  constructor(private readonly logger: PluginLogger) {}

  async rateLimit(methodName: string): Promise<void> {
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
  }

  private getDebounceKey(methodName: string, deviceId: string | undefined, args: any[]): string {
    const paramsKey = args.length > 0 ? `-${JSON.stringify(args)}` : '';
    return deviceId ? `${methodName}-${deviceId}${paramsKey}` : `${methodName}${paramsKey}`;
  }

  debounce<T>(methodName: string, deviceId: string | undefined, fn: () => Promise<T>, args: any[]): Promise<T> {
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
        await this.rateLimit(methodName);
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

      // Return a proxied function that applies rate limiting
      return async function(...args: any[]) {
        const methodName = prop.toString();

        // Methods that bypass all rate limiting and debouncing
        const bypassMethods = [
          // Getters and internal methods
          'get', 'getService', 'getCharacteristic',
          // State accessors
          'deviceStatus', 'speed', 'brightness', 'colorTemp',
          // Event handlers
          'onSet', 'onGet', 'addListener', 'removeListener',
          // Controlled interval methods
          'update'
        ];

        // Methods that should only be rate limited (no debouncing)
        const noDebounceAPIMethods = [
          'ignored'
        ];

        if (bypassMethods.includes(methodName)) {
          return value.apply(target, args);
        }

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
  exclusions?: DeviceExclusion
): VeSync => {
  const client = new VeSync(username, password, timeZone, debug, redact, apiUrl, customLogger, exclusions);
  const rateLimiter = new RateLimiter(customLogger || new PluginLogger(console as any, debug || false));
  return createRateLimitedProxy(client, rateLimiter);
}; 