export interface PollingConfig {
  // Base polling interval in milliseconds
  baseInterval: number;
  // Maximum interval between polls in milliseconds
  maxInterval: number;
  // Minimum interval between polls in milliseconds
  minInterval: number;
  // Whether to increase polling frequency when device is active
  dynamicPolling: boolean;
  // Factor to multiply polling interval by when device is inactive
  inactiveMultiplier: number;
}

export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  baseInterval: 30000, // 30 seconds
  maxInterval: 300000, // 5 minutes
  minInterval: 10000,  // 10 seconds
  dynamicPolling: true,
  inactiveMultiplier: 2,
};

// Device-specific polling configurations
export const DEVICE_POLLING_CONFIGS: Record<string, PollingConfig> = {
  airPurifier: {
    baseInterval: 15000,  // 15 seconds - more frequent for air quality updates
    maxInterval: 60000,   // 1 minute
    minInterval: 10000,   // 10 seconds
    dynamicPolling: true,
    inactiveMultiplier: 2,
  },
  humidifier: {
    baseInterval: 20000,  // 20 seconds - moderate frequency for humidity updates
    maxInterval: 120000,  // 2 minutes
    minInterval: 10000,   // 10 seconds
    dynamicPolling: true,
    inactiveMultiplier: 2,
  },
  fan: {
    baseInterval: 30000,  // 30 seconds - less frequent updates needed
    maxInterval: 180000,  // 3 minutes
    minInterval: 15000,   // 15 seconds
    dynamicPolling: true,
    inactiveMultiplier: 3,
  },
  light: {
    baseInterval: 30000,  // 30 seconds - less frequent updates needed
    maxInterval: 300000,  // 5 minutes
    minInterval: 15000,   // 15 seconds
    dynamicPolling: false,
    inactiveMultiplier: 2,
  },
  outlet: {
    baseInterval: 20000,  // 20 seconds - moderate frequency for power monitoring
    maxInterval: 120000,  // 2 minutes
    minInterval: 10000,   // 10 seconds
    dynamicPolling: true,
    inactiveMultiplier: 2,
  },
}; 