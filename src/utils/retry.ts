import { Logger } from 'homebridge';

export interface RetryConfig {
  maxRetries: number;
}

export class RetryManager {
  private retryCount = 0;
  private readonly maxRetries: number;

  constructor(
    private readonly log: Logger,
    private readonly config: RetryConfig = { maxRetries: 3 }
  ) {
    this.maxRetries = config.maxRetries;
  }

  /**
   * Get the current retry count
   */
  public getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Execute an operation with retry logic
   */
  public async execute<T>(
    operation: () => Promise<T>,
    context: { deviceName: string; operation: string }
  ): Promise<T> {
    this.retryCount = 0;
    
    while (this.retryCount < this.maxRetries) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        this.retryCount++;
        
        if (this.retryCount >= this.maxRetries) {
          this.log.error(
            `[${context.deviceName}] Failed to ${context.operation} after ${this.maxRetries} attempts:`,
            error
          );
          throw error;
        }
        
        this.log.warn(
          `[${context.deviceName}] Failed to ${context.operation}, attempt ${this.retryCount}/${this.maxRetries}`
        );
      }
    }

    throw new Error(`Failed to ${context.operation} after ${this.maxRetries} attempts`);
  }
} 