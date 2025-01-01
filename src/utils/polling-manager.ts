import { Logger } from 'homebridge';
import { DEFAULT_POLLING_CONFIG, DEVICE_POLLING_CONFIGS, PollingConfig } from '../types/polling.types';

export class PollingManager {
  private currentInterval: number;
  private timer: NodeJS.Timeout | null = null;
  private lastPollTime: number = 0;
  private isDeviceActive: boolean = false;
  private readonly config: PollingConfig;
  private readonly deviceType: string;
  private readonly log: Logger;

  constructor(
    deviceType: string,
    log: Logger,
    customConfig?: Partial<PollingConfig>
  ) {
    this.deviceType = deviceType;
    this.log = log;
    
    // Get device-specific config or default
    const baseConfig = DEVICE_POLLING_CONFIGS[deviceType] || DEFAULT_POLLING_CONFIG;
    
    // Merge with custom config if provided
    this.config = {
      ...baseConfig,
      ...customConfig,
    };

    this.currentInterval = this.config.baseInterval;
  }

  /**
   * Start polling with the configured interval
   * @param callback Function to call on each poll
   */
  public startPolling(callback: () => Promise<void>): void {
    this.stopPolling();
    this.lastPollTime = Date.now();
    
    const poll = async () => {
      try {
        await callback();
        this.lastPollTime = Date.now();
        this.scheduleNextPoll(callback);
      } catch (error) {
        this.log.error(`[${this.deviceType}] Polling error:`, error);
        // On error, schedule next poll but maybe with a longer interval
        this.scheduleNextPoll(callback, true);
      }
    };

    // Initial poll
    poll();
  }

  /**
   * Stop the current polling
   */
  public stopPolling(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Update the device's active state, which may affect polling frequency
   * @param isActive Whether the device is currently active
   */
  public updateDeviceState(isActive: boolean): void {
    if (this.isDeviceActive === isActive) {
      return;
    }

    this.isDeviceActive = isActive;
    this.adjustPollingInterval();
  }

  /**
   * Schedule the next poll based on current conditions
   * @param callback Function to call on next poll
   * @param wasError Whether the last poll resulted in an error
   */
  private scheduleNextPoll(callback: () => Promise<void>, wasError: boolean = false): void {
    this.adjustPollingInterval(wasError);
    
    this.timer = setTimeout(
      () => this.startPolling(callback),
      this.currentInterval
    );
  }

  /**
   * Adjust the polling interval based on device state and conditions
   * @param wasError Whether the last poll resulted in an error
   */
  private adjustPollingInterval(wasError: boolean = false): void {
    let interval = this.config.baseInterval;

    // If dynamic polling is enabled, adjust based on device state
    if (this.config.dynamicPolling) {
      if (!this.isDeviceActive) {
        interval *= this.config.inactiveMultiplier;
      }
    }

    // If there was an error, increase interval to reduce load
    if (wasError) {
      interval *= 1.5;
    }

    // Ensure interval stays within configured bounds
    this.currentInterval = Math.min(
      Math.max(interval, this.config.minInterval),
      this.config.maxInterval
    );

    this.log.debug(
      `[${this.deviceType}] Adjusted polling interval: ${this.currentInterval}ms ` +
      `(Active: ${this.isDeviceActive}, Error: ${wasError})`
    );
  }

  /**
   * Get the time since the last successful poll
   */
  public getTimeSinceLastPoll(): number {
    return Date.now() - this.lastPollTime;
  }

  /**
   * Get the current polling interval
   */
  public getCurrentInterval(): number {
    return this.currentInterval;
  }
} 