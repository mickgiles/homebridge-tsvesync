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
        
        // If result is null and we have retries left, try again
        if (result === null && this.retryCount < this.maxRetries - 1) {
          this.retryCount++;
          const delay = Math.min(2000 * Math.pow(2, this.retryCount - 1), 10000);
          this.log.debug(`[${context.deviceName}] === RETRY MANAGER: Attempt ${this.retryCount}/${this.maxRetries}, waiting ${delay}ms ===`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If this is our last try and result is null, throw error
        if (result === null && this.retryCount >= this.maxRetries - 1) {
          throw new Error(`Failed to ${context.operation} - got null result after ${this.maxRetries} attempts`);
        }
        
        return result;
      } catch (error) {
        this.retryCount++;
        
        if (this.retryCount >= this.maxRetries) {
          throw error;
        }
        
        // Calculate delay based on attempt number
        const delay = Math.min(2000 * Math.pow(2, this.retryCount - 1), 10000);
        this.log.debug(`[${context.deviceName}] === RETRY MANAGER: Attempt ${this.retryCount}/${this.maxRetries}, waiting ${delay}ms ===`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Failed to ${context.operation} after ${this.maxRetries} attempts`);
  }
} 