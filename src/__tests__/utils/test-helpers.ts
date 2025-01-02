import { Logger } from 'homebridge';
import { PluginLogger } from '../../utils/logger';
import { RetryManager } from '../../utils/retry';
import { VeSyncOutlet } from '../../types/device.types';
import { VeSync } from 'tsvesync';

/**
 * Creates a mock Logger instance for testing
 */
export const createMockLogger = (): jest.Mocked<Logger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  prefix: undefined
});

/**
 * Creates a mock PluginLogger instance for testing
 */
export const createMockPluginLogger = (log: Logger = createMockLogger()): jest.Mocked<PluginLogger> => {
  const logger = new PluginLogger(log, true);
  return {
    ...logger,
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    stateChange: jest.fn(),
    operationStart: jest.fn(),
    operationEnd: jest.fn(),
    pollingEvent: jest.fn(),
    formatMessage: jest.fn((message: string) => message),
  } as unknown as jest.Mocked<PluginLogger>;
};

/**
 * Creates a mock RetryManager instance for testing
 */
export const createMockRetryManager = (): jest.Mocked<RetryManager> => {
  const manager = new RetryManager(createMockLogger(), {
    maxRetries: 3,
  });
  return {
    ...manager,
    execute: jest.fn(),
    getRetryCount: jest.fn().mockReturnValue(0),
  } as unknown as jest.Mocked<RetryManager>;
};

/**
 * Creates a mock service instance for testing
 */
export const createMockService = () => ({
  getCharacteristic: jest.fn().mockReturnValue({
    onSet: jest.fn(),
    onGet: jest.fn(),
    updateValue: jest.fn(),
  }),
  setCharacteristic: jest.fn().mockReturnThis(),
});

/**
 * Creates a mock info service instance for testing
 */
export const createMockInfoService = () => ({
  setCharacteristic: jest.fn().mockReturnThis(),
});

/**
 * Type for mock device configuration
 */
export interface MockDeviceConfig {
  deviceName?: string;
  uuid?: string;
  deviceType?: string;
  getDetails?: jest.Mock;
}

/**
 * Creates a mock device instance for testing
 */
export const createMockDevice = (config: MockDeviceConfig = {}) => ({
  deviceName: config.deviceName || 'Test Device',
  uuid: config.uuid || '12345',
  deviceType: config.deviceType || 'outlet',
  getDetails: config.getDetails || jest.fn(),
});

/**
 * Waits for all promises in the queue to resolve
 */
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

/**
 * Helper to run async tests with proper timeout and error handling
 */
export const runAsyncTest = async (
  testFn: () => Promise<void>,
  timeout: number = 5000
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Test timed out after ${timeout}ms`));
    }, timeout);

    testFn()
      .then(() => {
        clearTimeout(timeoutId);
        resolve();
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

/**
 * Simulates a network delay
 */
export const simulateNetworkDelay = (ms: number = 100): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Type for mock outlet configuration
 */
export interface MockOutletConfig {
  deviceName?: string;
  deviceType?: string;
  cid?: string;
  uuid?: string;
  power?: number;
  voltage?: number;
  energy?: number;
  current?: number;
}

/**
 * Creates a mock outlet instance for testing
 */
export const createMockOutlet = (config: MockOutletConfig = {}): jest.Mocked<VeSyncOutlet> => {
  const details = {
    power: config.power || 0,
    voltage: config.voltage || 120,
    energy: config.energy || 0,
    current: config.current || 0,
  };

  return {
    deviceName: config.deviceName || 'Test Outlet',
    deviceType: config.deviceType || 'wifi-switch-1.3',
    cid: config.cid || 'test-cid',
    uuid: config.uuid || 'test-uuid',
    deviceStatus: 'on',
    subDeviceNo: 0,
    isSubDevice: false,
    deviceRegion: 'US',
    configModule: 'Outlet',
    macId: '00:11:22:33:44:55',
    deviceCategory: 'outlet',
    connectionStatus: 'online',
    getDetails: jest.fn().mockResolvedValue(details),
    setApiBaseUrl: jest.fn(),
    turnOn: jest.fn().mockResolvedValue(true),
    turnOff: jest.fn().mockResolvedValue(true),
    ...details,
  } as unknown as jest.Mocked<VeSyncOutlet>;
};

/**
 * Creates a mock VeSync client for testing
 */
export const createMockVeSync = (): jest.Mocked<VeSync> => {
  return {
    login: jest.fn().mockResolvedValue(true),
    getDevices: jest.fn().mockResolvedValue(true),
    fans: [],
    outlets: [],
    switches: [],
    bulbs: [],
    humidifiers: [],
    purifiers: [],
    _debug: false,
    _redact: false,
    _energyUpdateInterval: 0,
    _energyCheck: false,
    username: 'test@example.com',
    password: 'test-password',
    token: 'test-token',
    accountID: 'test-account',
    apiKey: 'test-key',
    apiBase: 'test-base',
    timezone: 'UTC',
    debug: false,
    redact: false,
    traceSocket: false,
    apiUrl: 'test-url',
    initialized: true,
    setToken: jest.fn(),
    setAccountID: jest.fn(),
    setAPIKey: jest.fn(),
    setAPIBase: jest.fn(),
    setInitialized: jest.fn(),
    setDevices: jest.fn(),
    getDevicesByType: jest.fn(),
    getDeviceByUUID: jest.fn(),
    getDeviceByCid: jest.fn(),
    getDeviceByName: jest.fn(),
    getDevicesByCategory: jest.fn(),
    getDevicesByMacID: jest.fn(),
    getDevicesByDeviceType: jest.fn(),
    getDevicesByConfigModule: jest.fn(),
    getDevicesByDeviceRegion: jest.fn(),
    getDevicesByConnectionStatus: jest.fn(),
  } as unknown as jest.Mocked<VeSync>;
}; 