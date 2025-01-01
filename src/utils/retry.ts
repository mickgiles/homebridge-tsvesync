import { Logger } from 'homebridge';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000,    // 10 seconds
  backoffFactor: 2,   // Double the delay each time
};

export class RetryManager {
  constructor(
    private readonly log: Logger,
    private readonly config: RetryConfig = DEFAULT_RETRY_CONFIG
  ) {}

  /**
   * Execute an operation with retry logic
   * @param operation The async operation to execute
   * @param context Context information for logging
   * @returns The result of the operation
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: { deviceName: string; operation: string }
  ): Promise<T> {
    let lastError: Error | undefined;
    let delay = this.config.initialDelay;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          // Log success after retry
          this.log.debug(
            `[${context.deviceName}] Successfully ${context.operation} after ${attempt} attempts`
          );
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === this.config.maxAttempts) {
          // Log final failure
          this.log.error(
            `[${context.deviceName}] Failed to ${context.operation} after ${attempt} attempts:`,
            lastError.message
          );
          throw lastError;
        }

        // Log retry attempt
        this.log.warn(
          `[${context.deviceName}] Attempt ${attempt} to ${context.operation} failed, retrying in ${delay}ms:`,
          lastError.message
        );

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increase delay for next attempt, but don't exceed maxDelay
        delay = Math.min(delay * this.config.backoffFactor, this.config.maxDelay);
      }
    }

    // This should never be reached due to the throw in the loop
    throw lastError;
  }
} 