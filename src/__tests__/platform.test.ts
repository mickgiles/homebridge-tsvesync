// Set up mocks before imports
const mockVeSyncModule = jest.fn();

jest.mock('tsvesync', () => ({
  VeSync: mockVeSyncModule
}));

import { API, Logger, Service as ServiceType, Characteristic as CharacteristicType } from 'homebridge';
import { VeSync } from 'tsvesync';
import { TSVESyncPlatform } from '../platform';
import { TEST_CONFIG } from './setup';

// Import the real VeSync module for integration tests
const RealVeSync = jest.requireActual('tsvesync').VeSync;

// Mock classes for testing
class MockService {
  constructor(public readonly UUID: string) {}

  getCharacteristic() {
    return {
      on: jest.fn().mockReturnThis(),
      updateValue: jest.fn(),
    };
  }

  setCharacteristic() {
    return this;
  }
}

class MockCharacteristic {
  static readonly On = 'On';
  static readonly Active = 'Active';
  static readonly Name = 'Name';
  static readonly Model = 'Model';
  static readonly Manufacturer = 'Manufacturer';
  static readonly SerialNumber = 'SerialNumber';
  static readonly FirmwareRevision = 'FirmwareRevision';
  static readonly RotationSpeed = 'RotationSpeed';
  static readonly CurrentAirPurifierState = 'CurrentAirPurifierState';
  static readonly TargetAirPurifierState = 'TargetAirPurifierState';
  static readonly CurrentFanState = 'CurrentFanState';
  static readonly TargetFanState = 'TargetFanState';
  static readonly FilterChangeIndication = 'FilterChangeIndication';
  static readonly FilterLifeLevel = 'FilterLifeLevel';
  static readonly AirQuality = 'AirQuality';
  static readonly PM2_5Density = 'PM2_5Density';
  static readonly CurrentRelativeHumidity = 'CurrentRelativeHumidity';
  static readonly TargetRelativeHumidity = 'TargetRelativeHumidity';
  static readonly WaterLevel = 'WaterLevel';
  static readonly LockPhysicalControls = 'LockPhysicalControls';
  static readonly SwingMode = 'SwingMode';
  static readonly Brightness = 'Brightness';
  static readonly ColorTemperature = 'ColorTemperature';
  static readonly Hue = 'Hue';
  static readonly Saturation = 'Saturation';
  static readonly OutletInUse = 'OutletInUse';
  static readonly Voltage = 'Voltage';
  static readonly ElectricCurrent = 'ElectricCurrent';
  static readonly PowerMeterVisible = 'PowerMeterVisible';
}

describe('TSVESyncPlatform', () => {
  let platform: TSVESyncPlatform;
  let mockLogger: jest.Mocked<Logger>;
  let mockAPI: jest.Mocked<API>;

  const defaultConfig = {
    platform: 'TSVESync',
    name: 'TSVESync',
    username: TEST_CONFIG.username || 'test@example.com',
    password: TEST_CONFIG.password || 'password123',
    apiUrl: TEST_CONFIG.apiUrl,
    debug: true,
  };

  beforeAll(() => {
    jest.setTimeout(30000);
  });

  beforeEach(() => {
    // Setup logger mock
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      prefix: undefined
    } as jest.Mocked<Logger>;

    // Setup API mock
    mockAPI = {
      registerPlatformAccessories: jest.fn(),
      unregisterPlatformAccessories: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      hap: {
        Service: MockService as unknown as typeof ServiceType,
        Characteristic: MockCharacteristic as unknown as typeof CharacteristicType,
        uuid: {
          generate: jest.fn().mockReturnValue('test-uuid'),
        },
      },
    } as unknown as jest.Mocked<API>;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('mock tests', () => {
    let mockVeSync: jest.Mocked<VeSync>;

    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: true });

      // Setup VeSync mock
      mockVeSync = {
        login: jest.fn(),
        getDevices: jest.fn(),
        fans: [],
        outlets: [],
        switches: [],
        bulbs: [],
        humidifiers: [],
        purifiers: []
      } as unknown as jest.Mocked<VeSync>;

      // Set up the mock implementation for this test
      (VeSync as jest.MockedClass<typeof VeSync>).mockImplementation(() => mockVeSync);

      platform = new TSVESyncPlatform(mockLogger, defaultConfig, mockAPI);
      // Reset the lastLogin time to force new login attempts
      (platform as any).lastLogin = new Date(0);
      // Reset the loginBackoffTime to avoid delays in tests
      (platform as any).loginBackoffTime = 0;
    });

    describe('ensureLogin', () => {
      it('should use existing session if login is recent', async () => {
        // Set last login to be recent
        (platform as any).lastLogin = new Date();
        await (platform as any).ensureLogin();
        expect(mockVeSync.login).not.toHaveBeenCalled();
      });

      it('should attempt new login if session is old', async () => {
        mockVeSync.login.mockResolvedValueOnce(true);
        await (platform as any).ensureLogin();
        expect(mockVeSync.login).toHaveBeenCalledTimes(1);
        
        // Set last login to be old and reset mock
        (platform as any).lastLogin = new Date(0);
        mockVeSync.login.mockClear();
        mockVeSync.login.mockResolvedValueOnce(true);
        
        await (platform as any).ensureLogin();
        expect(mockVeSync.login).toHaveBeenCalledTimes(1);
      }, 10000);

      it('should handle login failure', async () => {
        mockVeSync.login.mockResolvedValueOnce(false);
        await (platform as any).ensureLogin();
        expect(mockLogger.error).toHaveBeenCalledWith('Login failed - invalid credentials or API error');
      });

      it('should handle "Not logged in" error', async () => {
        const error = { error: { msg: 'Not logged in' } };
        mockVeSync.login.mockRejectedValueOnce(error);
        (platform as any).debug = true;
        await (platform as any).ensureLogin();
        expect(mockLogger.debug).toHaveBeenCalledWith('Session expired, forcing new login');
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    describe('updateDeviceStatesFromAPI', () => {
      beforeEach(() => {
        // Ensure login is fresh to avoid login attempts during tests
        (platform as any).lastLogin = new Date();
      });

      it('should update device states successfully', async () => {
        mockVeSync.login.mockResolvedValueOnce(true);
        mockVeSync.getDevices.mockResolvedValueOnce(true);
        
        const updatePromise = platform.updateDeviceStatesFromAPI();
        await jest.runAllTimersAsync();
        await updatePromise;
        
        expect(mockVeSync.getDevices).toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle device update failure', async () => {
        mockVeSync.login.mockResolvedValueOnce(true);
        mockVeSync.getDevices.mockResolvedValueOnce(false);
        
        const updatePromise = platform.updateDeviceStatesFromAPI();
        await jest.runAllTimersAsync();
        await updatePromise;
        
        expect(mockVeSync.getDevices).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to get devices after all retries');
      });

      it('should retry on session expiry', async () => {
        // Reset lastLogin to force a new login
        (platform as any).lastLogin = new Date(0);
        mockVeSync.login.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
        mockVeSync.getDevices
          .mockRejectedValueOnce({ error: { msg: 'Not logged in' } })
          .mockResolvedValueOnce(true);
        
        const updatePromise = platform.updateDeviceStatesFromAPI();
        await jest.runAllTimersAsync();
        await updatePromise;
        
        expect(mockVeSync.login).toHaveBeenCalledTimes(2);
        expect(mockVeSync.getDevices).toHaveBeenCalledTimes(2);
      });
    });
  });

  // Run integration tests if credentials are available
  if (TEST_CONFIG.username && TEST_CONFIG.password) {
    describe('integration tests', () => {
      let realPlatform: TSVESyncPlatform;
      
      beforeEach(() => {
        // Use real implementations for integration tests
        mockVeSyncModule.mockImplementation((username, password, timezone, debug, redact, apiUrl, logger) => {
          const client = new RealVeSync(username, password, timezone, debug, redact, apiUrl, logger);
          return client;
        });
        
        // Create platform with real credentials
        const config = {
          platform: 'TSVESync',
          name: 'TSVESync',
          username: TEST_CONFIG.username!,
          password: TEST_CONFIG.password!,
          debug: true,
          apiUrl: TEST_CONFIG.apiUrl,
        };

        console.log('Integration test config:', {
          username: config.username,
          debug: config.debug,
          hasPassword: !!config.password,
        });

        // Create the platform with real VeSync implementation
        realPlatform = new TSVESyncPlatform(mockLogger, config, mockAPI);

        // Reset login state and backoff for tests
        (realPlatform as any).lastLogin = new Date(0);
        (realPlatform as any).lastLoginAttempt = new Date(0);
        (realPlatform as any).loginBackoffTime = 0;

        // Access the VeSync client directly to verify it's configured correctly
        const platformClient = (realPlatform as any).client;
        if (platformClient) {
          console.log('VeSync client:', {
            isInitialized: true,
            hasLogin: typeof platformClient.login === 'function',
            hasGetDevices: typeof platformClient.getDevices === 'function',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            username: platformClient.username,
            hasPassword: !!platformClient.password,
            apiUrl: platformClient.apiUrl,
          });
        } else {
          console.log('VeSync client not initialized');
        }
      });

      afterEach(() => {
        // Reset the mock implementations
        mockVeSyncModule.mockReset();
      });

      it('should connect to VeSync API', async () => {
        try {
          const result = await (realPlatform as any).ensureLogin(true); // Force new login
          console.log('Login result:', result);
          if (!result) {
            // Try to get client state
            const client = (realPlatform as any).client;
            if (client) {
              console.log('Client state:', {
                lastLogin: (realPlatform as any).lastLogin,
                lastLoginAttempt: (realPlatform as any).lastLoginAttempt,
                loginBackoffTime: (realPlatform as any).loginBackoffTime,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              });
            } else {
              console.log('Client not initialized');
            }
          }
          expect(result).toBe(true);
        } catch (error) {
          console.log('Login attempt error:', error);
          throw error;
        }
      }, 10000);

      it('should fetch devices', async () => {
        try {
          // First login
          const loginResult = await (realPlatform as any).ensureLogin(true); // Force new login
          console.log('Login result:', loginResult);
          expect(loginResult).toBe(true);
          
          // Then fetch devices
          await realPlatform.updateDeviceStatesFromAPI();
          console.log('Device update completed');
          // Log found devices
          const client = (realPlatform as any).client;
          if (client) {
            const devices = [
              ...(client.fans || []),
              ...(client.outlets || []),
              ...(client.switches || []),
              ...(client.bulbs || []),
              ...(client.humidifiers || []),
              ...(client.purifiers || []),
            ];
            console.log('Found devices:', devices.length);
            devices.forEach(device => {
              console.log(`- ${device.deviceName} (${device.deviceType})`);
            });
          } else {
            console.log('Client not initialized');
          }
        } catch (error) {
          console.log('Device fetch error:', error);
          throw error;
        }
      }, 10000);
    });
  }
}); 