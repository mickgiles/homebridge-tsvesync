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
  ) {}

  /**
   * Log an informational message
   */
  info(message: string, context: Partial<LogContext>): void {
    this.log.info(this.formatMessage(message, context));
  }

  /**
   * Log a warning message
   */
  warn(message: string, context: Partial<LogContext>, error?: Error): void {
    const formattedMessage = this.formatMessage(message, context);
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
  error(message: string, context: Partial<LogContext>, error?: Error): void {
    const formattedMessage = this.formatMessage(message, context);
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
   * Log a debug message (only if debug mode is enabled)
   */
  debug(message: string, context: Partial<LogContext>): void {
    if (this.debugMode) {
      this.log.debug(this.formatMessage(message, context));
    }
  }

  /**
   * Log a state change
   */
  stateChange(context: LogContext): void {
    const valueStr = typeof context.value === 'object' 
      ? JSON.stringify(context.value)
      : context.value;

    this.debug(
      `State change: ${context.characteristic} = ${valueStr}`,
      context
    );
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