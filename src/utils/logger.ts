import { Logger } from 'homebridge';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface LogContext {
  deviceName: string;
  deviceType: string;
  operation?: string;
  characteristic?: string;
  value?: any;
}

export class PluginLogger {
  private currentLevel: LogLevel;

  constructor(
    private readonly log: Logger,
    private readonly debugMode: boolean = false
  ) {
    this.currentLevel = debugMode ? LogLevel.DEBUG : LogLevel.INFO;
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  getLevel(): LogLevel {
    return this.currentLevel;
  }

  debug(message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      this.log.info(message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.INFO) {
      this.log.info(message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.WARN) {
      this.log.warn(message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.ERROR) {
      this.log.error(message, ...args);
    }
  }

  operationStart(context: Partial<LogContext>): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      const { deviceName, deviceType, operation } = context;
      this.debug(`[${deviceName}] Starting ${operation}`, { deviceType });
    }
  }

  operationEnd(context: Partial<LogContext>, error?: Error): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      const { deviceName, deviceType, operation } = context;
      if (error) {
        this.debug(`[${deviceName}] Failed ${operation}:`, error, { deviceType });
      } else {
        this.debug(`[${deviceName}] Completed ${operation}`, { deviceType });
      }
    }
  }

  stateChange(context: LogContext): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      const { deviceName, characteristic, value } = context;
      this.debug(`[${deviceName}] ${characteristic} changed to ${value}`);
    }
  }
} 