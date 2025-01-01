import { PlatformAccessory, Service, Characteristic, Logger } from 'homebridge';
import { mock, mockDeep } from 'jest-mock-extended';
import { BaseAccessory } from '../accessories/base.accessory';
import { TSVESyncPlatform } from '../platform';
import { VeSync } from 'tsvesync';
import { DeviceCapabilities } from '../types';
import { PollingManager } from '../utils/polling-manager';
import { PluginLogger } from '../utils/logger';
import { RetryManager } from '../utils/retry';

jest.mock('../utils/logger');
jest.mock('../utils/retry');

// Create a concrete test class since BaseAccessory is abstract
class TestAccessory extends BaseAccessory {
  protected setupService(): void {
    this.service = new this.platform.Service.Switch(this.accessory.displayName);
  }
  
  protected async updateDeviceSpecificStates(): Promise<void> {
    // Test implementation
  }
  
  protected getDeviceCapabilities(): DeviceCapabilities {
    return {
      power: true,
      mode: false,
      speed: false,
      timer: false,
      hasBrightness: false,
      hasColorTemp: false,
      hasColor: false,
      hasSpeed: false,
      hasMode: false,
      hasTimer: false,
      hasSchedule: false,
      hasHumidity: false,
      hasAirQuality: false,
      hasWaterLevel: false,
      hasChildLock: false,
      hasSwingMode: false,
    };
  }

  // Expose protected methods for testing
  public testStartPolling(): void {
    this.startPolling();
  }

  public testStopPolling(): void {
    this.stopPolling();
  }

  // Expose private properties for testing
  public getPollingManager(): PollingManager {
    return (this as any).pollingManager;
  }

  // Expose handleDeviceError for testing
  public async testHandleDeviceError(message: string, error: Error | any): Promise<void> {
    return (this as any).handleDeviceError(message, error);
  }
}

describe('BaseAccessory', () => {
  let mockPlatform: jest.Mocked<TSVESyncPlatform>;
  let mockAccessory: jest.Mocked<PlatformAccessory>;
  let mockDevice: any;
  let mockService: jest.Mock;
  let mockInfoService: jest.Mock;
  let accessory: TestAccessory;
  let mockLogger: jest.Mocked<Logger>;
  let mockPluginLogger: jest.Mocked<PluginLogger>;
  let mockRetryManager: jest.Mocked<RetryManager>;

  beforeAll(() => {
    jest.setTimeout(30000);
  });

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });

    // Setup logger mock
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      prefix: undefined
    } as jest.Mocked<Logger>;

    // Setup PluginLogger mock
    const MockPluginLogger = jest.mocked(PluginLogger);
    mockPluginLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      stateChange: jest.fn(),
      operationStart: jest.fn(),
      operationEnd: jest.fn(),
      pollingEvent: jest.fn(),
      log: mockLogger,
      debugMode: true,
      formatMessage: jest.fn((message: string) => message),
    } as unknown as jest.Mocked<PluginLogger>;

    MockPluginLogger.mockImplementation(() => mockPluginLogger);

    // Setup RetryManager mock
    mockRetryManager = {
      execute: jest.fn(),
      getRetryCount: jest.fn().mockReturnValue(0),
    } as unknown as jest.Mocked<RetryManager>;

    const MockRetryManager = jest.mocked(RetryManager);
    MockRetryManager.mockImplementation(() => mockRetryManager);

    // Setup service mocks
    mockService = jest.fn().mockImplementation(() => ({
      getCharacteristic: jest.fn().mockReturnValue({
        onSet: jest.fn(),
        onGet: jest.fn(),
        updateValue: jest.fn(),
      }),
      setCharacteristic: jest.fn().mockReturnThis(),
    }));

    mockInfoService = jest.fn().mockImplementation(() => ({
      setCharacteristic: jest.fn().mockReturnThis(),
    }));

    // Setup platform mock
    mockPlatform = {
      log: mockLogger,
      Service: {
        Switch: mockService,
        AccessoryInformation: mockInfoService,
      },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        FirmwareRevision: 'FirmwareRevision',
      },
      api: {
        updatePlatformAccessories: jest.fn(),
      },
      config: {
        platform: 'TSVESync',
        name: 'TSVESync',
        username: 'test@example.com',
        password: 'password123',
        debug: true,
        retry: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 10000,
        },
      },
    } as unknown as jest.Mocked<TSVESyncPlatform>;

    // Setup accessory mock
    const mockGetService = jest.fn().mockImplementation((service) => {
      if (service === mockInfoService) {
        return {
          setCharacteristic: jest.fn().mockReturnThis(),
        };
      }
      return null;
    });

    mockAccessory = {
      displayName: 'Test Device',
      context: { device: { details: {} } },
      getService: mockGetService,
      addService: jest.fn(),
    } as unknown as jest.Mocked<PlatformAccessory>;

    // Setup device mock
    mockDevice = {
      deviceName: 'Test Device',
      uuid: '12345',
      deviceType: 'outlet',
      getDetails: jest.fn(),
    };

    // Create accessory instance
    accessory = new TestAccessory(mockPlatform, mockAccessory, mockDevice);

    // Mock PollingManager
    const mockPollingManager = {
      startPolling: jest.fn(),
      stopPolling: jest.fn(),
    };
    (accessory as any).pollingManager = mockPollingManager;

    // Mock RetryManager
    (accessory as any).retryManager = mockRetryManager;

    // Mock PluginLogger
    (accessory as any).logger = mockPluginLogger;
  });

  afterEach(() => {
    if (accessory) {
      accessory.testStopPolling();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('error handling', () => {
    it('should handle device not found error', async () => {
      const error = {
        error: {
          code: 4041008,
          msg: 'Device not found',
        },
      };

      await accessory.testHandleDeviceError('test operation', error);
      expect(mockPluginLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Device not found'),
        expect.any(Object),
        expect.any(Error)
      );
    });

    it('should handle rate limit error', async () => {
      const error = new Error('API rate limit exceeded');
      mockRetryManager.getRetryCount.mockReturnValue(1);

      await accessory.testHandleDeviceError('test operation', error);
      expect(mockPluginLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Hit API rate limit'),
        expect.any(Object),
        error
      );
    });

    it('should handle network errors', async () => {
      const error = {
        code: 'ECONNRESET',
        message: 'Connection reset',
      };

      await accessory.testHandleDeviceError('test operation', error);
      expect(mockPluginLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Network error'),
        expect.any(Object),
        expect.any(Error)
      );
    });
  });

  describe('device state management', () => {
    it('should sync device state successfully', async () => {
      const mockDetails = { power: true };
      mockDevice.getDetails.mockResolvedValueOnce(mockDetails);
      mockRetryManager.execute.mockImplementation((fn) => fn());

      await (accessory as any).syncDeviceState();
      expect(mockDevice.getDetails).toHaveBeenCalled();
    });

    it('should handle sync failure', async () => {
      const error = new Error('Sync failed');
      mockDevice.getDetails.mockRejectedValueOnce(error);
      mockRetryManager.execute.mockRejectedValueOnce(error);

      await (accessory as any).syncDeviceState();
      expect(mockPluginLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sync device state'),
        expect.any(Object),
        error
      );
    });

    it('should retry failed operations', async () => {
      (accessory as any).needsRetry = true;
      mockDevice.getDetails.mockResolvedValueOnce({ power: true });
      mockRetryManager.execute.mockImplementation((fn) => fn());

      await (accessory as any).syncDeviceState();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Retrying previous failed operation'));
    });
  });

  describe('polling management', () => {
    it('should start polling', () => {
      const pollingManager = accessory.getPollingManager();
      accessory.testStartPolling();
      expect(pollingManager.startPolling).toHaveBeenCalled();
    });

    it('should stop polling', () => {
      const pollingManager = accessory.getPollingManager();
      accessory.testStopPolling();
      expect(pollingManager.stopPolling).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should convert air quality values correctly', () => {
      expect((accessory as any).convertAirQualityToHomeKit(10)).toBe(1);  // EXCELLENT
      expect((accessory as any).convertAirQualityToHomeKit(30)).toBe(2);  // GOOD
      expect((accessory as any).convertAirQualityToHomeKit(50)).toBe(3);  // FAIR
      expect((accessory as any).convertAirQualityToHomeKit(100)).toBe(4); // INFERIOR
      expect((accessory as any).convertAirQualityToHomeKit(200)).toBe(5); // POOR
    });

    it('should persist device state', async () => {
      await (accessory as any).persistDeviceState('testKey', 'testValue');

      expect(mockPlatform.api.updatePlatformAccessories).toHaveBeenCalledWith([mockAccessory]);
      expect(mockAccessory.context.device.details.testKey).toBe('testValue');
    });
  });
}); 