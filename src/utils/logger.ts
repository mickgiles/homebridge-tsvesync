import { Logger } from 'homebridge';

export interface LogContext {
  deviceName: string;
  deviceType: string;
  operation: string;
  characteristic?: string;
  value?: any;
}

export class PluginLogger {
  constructor(
    private readonly log: Logger,
    private readonly debugMode: boolean = false
  ) {
    // Log debug mode status on initialization
    if (this.debugMode) {
      this.log.info('Debug logging enabled');
    }
  }

  /**
   * Create a VeSync compatible logger
   */
  createVeSyncLogger() {
    return {
      debug: (message: string, ...args: any[]) => {
        if (this.debugMode) {
          this.log.info(`[DEBUG] [VeSync] ${message}`, ...args);
        }
      },
      info: (message: string, ...args: any[]) => {
        this.log.info(`[VeSync] ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        this.log.warn(`[VeSync] ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        this.log.error(`[VeSync] ${message}`, ...args);
      }
    };
  }

  /**
   * Log an informational message
   */
  info(message: string, context?: Partial<LogContext>): void {
    this.log.info(this.formatMessage(message, context || {}));
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Partial<LogContext>, error?: Error): void {
    const formattedMessage = this.formatMessage(message, context || {});
    if (error) {
      this.log.warn(`${formattedMessage}: ${error.message}`);
      if (this.debugMode && error.stack) {
        this.log.warn(error.stack);
      }
    } else {
      this.log.warn(formattedMessage);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Partial<LogContext>, error?: Error): void {
    const formattedMessage = this.formatMessage(message, context || {});
    if (error) {
      this.log.error(`${formattedMessage}: ${error.message}`);
      if (this.debugMode && error.stack) {
        this.log.error(error.stack);
      }
    } else {
      this.log.error(formattedMessage);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Partial<LogContext>): void {
    if (this.debugMode) {
      this.log.info(`[DEBUG] ${this.formatMessage(message, context || {})}`);
    }
  }

  /**
   * Log a state change
   */
  stateChange(context: LogContext): void {
    const message = `${context.operation}: ${context.characteristic} = ${context.value}`;
    if (this.debugMode) {
      this.debug(message, context);
    } else {
      this.info(message, context);
    }
  }

  /**
   * Log an operation start
   */
  operationStart(context: Partial<LogContext>): void {
    this.debug(`Starting operation: ${context.operation}`, context);
  }

  /**
   * Log an operation end
   */
  operationEnd(context: Partial<LogContext>, error?: Error): void {
    if (error) {
      this.error(`Operation failed: ${context.operation}`, context, error);
    } else {
      this.debug(`Operation completed: ${context.operation}`, context);
    }
  }

  /**
   * Log a polling event
   */
  pollingEvent(
    context: Partial<LogContext> & { interval: number; active: boolean }
  ): void {
    this.debug(
      `Polling: interval=${context.interval}ms, active=${context.active}`,
      context
    );
  }

  /**
   * Format a log message with context
   */
  private formatMessage(message: string, context: Partial<LogContext>): string {
    const parts: string[] = [];

    if (context.deviceName) {
      parts.push(`[${context.deviceName}]`);
    }
    if (context.deviceType) {
      parts.push(`(${context.deviceType})`);
    }
    if (context.operation && !message.includes(context.operation)) {
      parts.push(`{${context.operation}}`);
    }
    if (context.characteristic) {
      parts.push(`<${context.characteristic}>`);
    }

    parts.push(message);

    return parts.join(' ');
  }
} 