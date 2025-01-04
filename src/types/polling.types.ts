export interface PollingConfig {
  // Base polling interval in milliseconds
  baseInterval: number;
  // Maximum interval between polls in milliseconds
  maxInterval: number;
  // Minimum interval between polls in milliseconds
  minInterval: number;
  // Whether to increase polling frequency when any device is active
  dynamicPolling: boolean;
  // Factor to multiply polling interval by when no devices are active
  inactiveMultiplier: number;
}

export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  baseInterval: 300000,  // 5 minutes
  maxInterval: 900000,   // 15 minutes
  minInterval: 60000,    // 1 minute
  dynamicPolling: true,
  inactiveMultiplier: 3,
}; 