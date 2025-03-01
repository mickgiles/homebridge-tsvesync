import { PluginLogger } from './logger';

/**
 * Manages API call quotas to prevent exceeding VeSync's daily limits
 * Based on the formula: 3200 + 1500 * (number of devices)
 */
export class QuotaManager {
  private apiCallCount = 0;
  private lastResetDate: string;
  private dailyQuota = 0;
  private readonly BASE_QUOTA = 3200;
  private readonly DEVICE_QUOTA_MULTIPLIER = 1500;
  private readonly QUOTA_BUFFER: number;
  private readonly HIGH_PRIORITY_METHODS: string[];
  private lastQuotaLogTime = 0;
  private readonly QUOTA_LOG_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor(
    private readonly logger: PluginLogger,
    private deviceCount: number = 0,
    config?: {
      bufferPercentage?: number;
      priorityMethods?: string[];
    }
  ) {
    // Set default buffer percentage (95% of quota)
    this.QUOTA_BUFFER = (config?.bufferPercentage ?? 95) / 100;
    
    // Set default high priority methods
    this.HIGH_PRIORITY_METHODS = config?.priorityMethods ?? [
      'turnOn', 
      'turnOff', 
      'setMode', 
      'setTargetHumidity', 
      'setBrightness',
      'setColorTemperature',
      'setColor',
      'changeFanSpeed',
      'setOscillation',
      'setChildLock'
    ];
    // Initialize with today's date
    this.lastResetDate = this.getCurrentDate();
    this.calculateDailyQuota();
    this.logger.info(`Initialized QuotaManager with ${this.deviceCount} devices. Daily quota: ${this.dailyQuota} API calls`);
  }

  /**
   * Calculate the daily quota based on the number of devices
   */
  private calculateDailyQuota(): void {
    this.dailyQuota = Math.floor((this.BASE_QUOTA + (this.DEVICE_QUOTA_MULTIPLIER * this.deviceCount)) * this.QUOTA_BUFFER);
  }

  /**
   * Get the current date in YYYY-MM-DD format
   */
  private getCurrentDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * Check if the quota should be reset (new day)
   */
  private checkAndResetQuota(): void {
    const currentDate = this.getCurrentDate();
    if (currentDate !== this.lastResetDate) {
      this.logger.info(`Resetting API call quota. Previous: ${this.apiCallCount}/${this.dailyQuota}`);
      this.apiCallCount = 0;
      this.lastResetDate = currentDate;
    }
  }

  /**
   * Update the device count and recalculate the quota
   */
  public updateDeviceCount(count: number): void {
    if (this.deviceCount !== count) {
      this.deviceCount = count;
      this.calculateDailyQuota();
      this.logger.info(`Updated device count to ${count}. New daily quota: ${this.dailyQuota} API calls`);
    }
  }

  /**
   * Check if an API call can be made based on the current quota
   */
  public canMakeApiCall(methodName: string): boolean {
    this.checkAndResetQuota();

    // If we're under the quota, allow the call
    if (this.apiCallCount < this.dailyQuota) {
      return true;
    }

    // If we're at or over the quota, only allow high priority methods
    const isHighPriority = this.HIGH_PRIORITY_METHODS.includes(methodName);
    
    if (isHighPriority) {
      this.logger.warn(`Quota exceeded (${this.apiCallCount}/${this.dailyQuota}) but allowing high priority method: ${methodName}`);
      return true;
    }

    // Log at WARN level as requested by user
    this.logger.warn(`Quota exceeded (${this.apiCallCount}/${this.dailyQuota}). Blocking API call: ${methodName}`, { skippedMethod: methodName });
    return false;
  }

  /**
   * Record an API call
   */
  public recordApiCall(methodName: string): void {
    this.checkAndResetQuota();
    this.apiCallCount++;

    // Log when approaching quota limits
    const quotaPercentage = (this.apiCallCount / this.dailyQuota) * 100;
    
    if (quotaPercentage >= 90 && quotaPercentage < 95) {
      this.logger.warn(`API call quota at 90%: ${this.apiCallCount}/${this.dailyQuota}`);
    } else if (quotaPercentage >= 95 && quotaPercentage < 100) {
      this.logger.warn(`API call quota at 95%: ${this.apiCallCount}/${this.dailyQuota}`);
    } else if (quotaPercentage >= 100) {
      this.logger.error(`API call quota exceeded: ${this.apiCallCount}/${this.dailyQuota}`);
    } else if (this.apiCallCount % 100 === 0) {
      // Log every 100 calls for monitoring
      this.logger.debug(`API call count: ${this.apiCallCount}/${this.dailyQuota} (${quotaPercentage.toFixed(1)}%)`);
    }
    
    // Log remaining quota every 5 minutes
    this.logRemainingQuota();
  }
  
  /**
   * Log the remaining quota every 5 minutes
   */
  private logRemainingQuota(): void {
    const now = Date.now();
    if (now - this.lastQuotaLogTime >= this.QUOTA_LOG_INTERVAL) {
      const remaining = this.getRemainingQuota();
      const percentage = this.getQuotaUsagePercentage();
      this.logger.warn(`Daily quota status: ${this.apiCallCount}/${this.dailyQuota} calls used (${percentage.toFixed(1)}%). Remaining: ${remaining} calls.`);
      this.lastQuotaLogTime = now;
    }
  }

  /**
   * Get the current API call count
   */
  public getApiCallCount(): number {
    return this.apiCallCount;
  }

  /**
   * Get the daily quota
   */
  public getDailyQuota(): number {
    return this.dailyQuota;
  }

  /**
   * Get the remaining quota
   */
  public getRemainingQuota(): number {
    return Math.max(0, this.dailyQuota - this.apiCallCount);
  }

  /**
   * Get the quota usage percentage
   */
  public getQuotaUsagePercentage(): number {
    return (this.apiCallCount / this.dailyQuota) * 100;
  }
}
