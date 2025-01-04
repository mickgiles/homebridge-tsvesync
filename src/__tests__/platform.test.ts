// Set up mocks before imports
jest.mock('../utils/device-factory');
jest.mock('tsvesync');

import { API, Logger, PlatformAccessory, Service as ServiceType, Characteristic as CharacteristicType } from 'homebridge';
import { VeSync } from 'tsvesync';
import { TSVESyncPlatform } from '../platform';
import { TEST_CONFIG, canRunIntegrationTests } from './setup';
import { createMockLogger, createMockOutlet, createMockVeSync } from './utils/test-helpers';
import { PLATFORM_NAME, PLUGIN_NAME } from '../settings';
import { DeviceFactory } from '../utils/device-factory';
import { BaseAccessory } from '../accessories/base.accessory';

// Import the real VeSync module for integration tests
const RealVeSync = jest.requireActual('tsvesync').VeSync;
const mockDeviceFactory = jest.mocked(DeviceFactory);

describe('TSVESyncPlatform', () => {
  let platform: TSVESyncPlatform;
  let mockAPI: jest.Mocked<API>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  describe('mock tests', () => {
    let mockVeSync: jest.Mocked<VeSync>;

    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: true });

      // Setup VeSync mock
      mockVeSync = createMockVeSync();

      // Setup API mock
      mockAPI = {
        version: 2.0,
        serverVersion: '1.0.0',
        user: {
          configPath: jest.fn(),
          storagePath: jest.fn(),
          persistPath: jest.fn(),
        },
        hapLegacyTypes: {},
        platformAccessory: jest.fn().mockImplementation((name, uuid) => ({
          UUID: uuid,
          displayName: name,
          context: {},
          services: new Map(),
          addService: jest.fn(),
          removeService: jest.fn(),
          getService: jest.fn(),
          getServiceById: jest.fn(),
        })),
        versionGreaterOrEqual: jest.fn(),
        registerAccessory: jest.fn(),
        registerPlatform: jest.fn(),
        publishCameraAccessories: jest.fn(),
        registerPlatformAccessories: jest.fn(),
        unregisterPlatformAccessories: jest.fn(),
        publishExternalAccessories: jest.fn(),
        updatePlatformAccessories: jest.fn(),
        registerPlatformAccessory: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
        hap: {
          Service: {
            AccessoryInformation: jest.fn(),
            Outlet: jest.fn().mockImplementation(() => ({
              getCharacteristic: jest.fn().mockReturnValue({
                onSet: jest.fn(),
                onGet: jest.fn(),
                updateValue: jest.fn(),
              }),
              setCharacteristic: jest.fn().mockReturnThis(),
            })),
            AirPurifier: jest.fn(),
            HumiditySensor: jest.fn(),
            Fan: jest.fn(),
          } as unknown as typeof ServiceType,
          Characteristic: {
            On: 'On',
            Active: 'Active',
            Name: 'Name',
            Model: 'Model',
            Manufacturer: 'Manufacturer',
            SerialNumber: 'SerialNumber',
            FirmwareRevision: 'FirmwareRevision',
            OutletInUse: 'OutletInUse',
            Voltage: 'Voltage',
            ElectricCurrent: 'ElectricCurrent',
            PowerMeterVisible: 'PowerMeterVisible',
          } as unknown as typeof CharacteristicType,
          uuid: {
            generate: jest.fn().mockImplementation((id) => `test-uuid-${id}`),
          },
        },
      } as unknown as jest.Mocked<API>;

      // Setup logger mock
      mockLogger = createMockLogger();

      // Create platform instance
      platform = new TSVESyncPlatform(
        mockLogger,
        {
          name: 'Test Platform',
          username: 'test@example.com',
          password: 'test-password',
          platform: PLATFORM_NAME,
        },
        mockAPI
      );

      // Replace VeSync client
      (platform as any).client = mockVeSync;
    });

    describe('ensureLogin', () => {
      it('should handle successful login', async () => {
        mockVeSync.login.mockResolvedValueOnce(true);
        const result = await (platform as any).ensureLogin();
        expect(result).toBe(true);
        expect(mockVeSync.login).toHaveBeenCalledTimes(1);
        expect((platform as any).loginBackoffTime).toBe(1000); // Reset to base backoff
      });

      it('should handle login failure', async () => {
        mockVeSync.login.mockResolvedValueOnce(false);
        const result = await (platform as any).ensureLogin();
        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith('Login failed - invalid credentials or API error');
        expect((platform as any).loginBackoffTime).toBeGreaterThan(1000); // Increased backoff
      });

      it('should respect backoff timing', async () => {
        // Set a backoff time
        (platform as any).loginBackoffTime = 5000;
        (platform as any).lastLoginAttempt = new Date();

        const loginPromise = (platform as any).ensureLogin();
        await jest.advanceTimersByTimeAsync(2500); // Advance halfway through backoff
        
        expect(mockVeSync.login).not.toHaveBeenCalled();
        
        await jest.advanceTimersByTimeAsync(2500); // Complete backoff
        await loginPromise;
        
        expect(mockVeSync.login).toHaveBeenCalled();
      });

      it('should use shorter backoff for auth errors', async () => {
        mockVeSync.login.mockRejectedValueOnce(new Error('auth failed'));
        await (platform as any).ensureLogin();
        expect((platform as any).loginBackoffTime).toBeLessThanOrEqual(5000);
      });

      it('should use longer backoff for other errors', async () => {
        mockVeSync.login.mockRejectedValueOnce(new Error('network error'));
        await (platform as any).ensureLogin();
        expect((platform as any).loginBackoffTime).toBe(2000); // Initial 1000ms doubled
      });
    });

    describe('withTokenRefresh', () => {
      it('should execute operation successfully without refresh', async () => {
        const operation = jest.fn().mockResolvedValue('success');
        const result = await platform.withTokenRefresh(operation);
        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(1);
        expect(mockVeSync.login).not.toHaveBeenCalled();
      });

      it('should retry operation once after login refresh', async () => {
        const operation = jest.fn()
          .mockRejectedValueOnce(new Error('operation failed'))
          .mockResolvedValueOnce('success');
        
        mockVeSync.login.mockResolvedValueOnce(true);
        
        const result = await platform.withTokenRefresh(operation);
        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(2);
        expect(mockVeSync.login).toHaveBeenCalledTimes(1);
      });

      it('should throw if operation fails after refresh', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('operation failed'));
        mockVeSync.login.mockResolvedValueOnce(true);
        
        await expect(platform.withTokenRefresh(operation)).rejects.toThrow('operation failed');
        expect(operation).toHaveBeenCalledTimes(2);
        expect(mockVeSync.login).toHaveBeenCalledTimes(1);
      });

      it('should throw if refresh login fails', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('operation failed'));
        mockVeSync.login.mockResolvedValueOnce(false);
        
        await expect(platform.withTokenRefresh(operation)).rejects.toThrow('operation failed');
        expect(operation).toHaveBeenCalledTimes(1);
        expect(mockVeSync.login).toHaveBeenCalledTimes(1);
      });
    });

    describe('updateDeviceStatesFromAPI', () => {
      beforeEach(() => {
        // Ensure login is fresh to avoid login attempts during tests
        (platform as any).lastLogin = new Date();
      });

      it('should update device states successfully', async () => {
        // Create a mock outlet
        const mockOutlet = createMockOutlet({
          deviceName: 'Test Outlet',
          deviceType: 'wifi-switch-1.3',
          cid: '123',
          uuid: '123',
        });

        // Setup mock VeSync client to return the outlet
        mockVeSync.outlets = [mockOutlet];
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
        
        // First login attempt fails
        mockVeSync.login.mockResolvedValueOnce(false);
        // Second login attempt (forced) succeeds
        mockVeSync.login.mockResolvedValueOnce(true);
        // First getDevices call fails with session expiry
        mockVeSync.getDevices.mockRejectedValueOnce({ error: { msg: 'Not logged in' } });
        // Third login attempt succeeds
        mockVeSync.login.mockResolvedValueOnce(true);
        // Second getDevices call fails
        mockVeSync.getDevices.mockResolvedValueOnce(false);
        // Third getDevices call fails
        mockVeSync.getDevices.mockResolvedValueOnce(false);
        // Fourth getDevices call fails
        mockVeSync.getDevices.mockResolvedValueOnce(false);
        // Fourth login attempt after all retries
        mockVeSync.login.mockResolvedValueOnce(true);
        // Final getDevices call succeeds
        mockVeSync.getDevices.mockResolvedValueOnce(true);
        
        const updatePromise = platform.updateDeviceStatesFromAPI();
        await jest.runAllTimersAsync();
        await updatePromise;
        
        expect(mockVeSync.login).toHaveBeenCalledTimes(4);
        expect(mockVeSync.getDevices).toHaveBeenCalledTimes(5);
      });
    });

    it('should handle device initialization', async () => {
      // Create a mock outlet
      const mockOutlet = createMockOutlet({
        deviceName: 'Test Outlet',
        deviceType: 'wifi-switch-1.3',
        cid: '123',
        uuid: '123',
      });

      // Setup mock VeSync client to return the outlet
      mockVeSync.outlets = [mockOutlet];
      mockVeSync.getDevices.mockResolvedValue(true);

      // Mock the DeviceFactory.createAccessory implementation
      mockDeviceFactory.createAccessory.mockImplementation((platform, accessory, device) => {
        const baseAccessory = {
          service: new mockAPI.hap.Service.Outlet(),
          platform,
          accessory,
          device,
          initialize: jest.fn().mockResolvedValue(undefined),
          updateCharacteristicValue: jest.fn(),
        } as unknown as BaseAccessory;
        return baseAccessory;
      });

      // Initialize platform and discover devices
      await platform.discoverDevices();

      // Should register new accessories during discovery
      expect(mockAPI.registerPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        expect.arrayContaining([
          expect.objectContaining({
            UUID: expect.stringContaining('test-uuid-123'),
            displayName: 'Test Outlet'
          })
        ])
      );

      // Should not register the same accessory twice
      mockAPI.registerPlatformAccessories.mockClear();
      await platform.discoverDevices();
      expect(mockAPI.registerPlatformAccessories).not.toHaveBeenCalled();
    });

    it('should handle device removal', async () => {
      // Create a mock outlet
      const mockOutlet = createMockOutlet({
        deviceName: 'Test Outlet',
        deviceType: 'wifi-switch-1.3',
        cid: '123',
        uuid: '123',
      });

      // Setup mock VeSync client to return the outlet
      mockVeSync.outlets = [mockOutlet];
      mockVeSync.getDevices.mockResolvedValue(true);

      // Initialize platform and discover devices
      await platform.discoverDevices();

      // Should register the accessory
      expect(mockAPI.registerPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        expect.arrayContaining([
          expect.objectContaining({
            UUID: expect.stringContaining('test-uuid-123'),
            displayName: 'Test Outlet'
          })
        ])
      );

      // Second update with no devices
      mockVeSync.outlets = [];
      mockVeSync.getDevices.mockResolvedValue(true);

      // Discover devices again
      await platform.discoverDevices();

      // Should unregister the accessory
      expect(mockAPI.unregisterPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        expect.arrayContaining([
          expect.objectContaining({
            UUID: expect.stringContaining('test-uuid-123'),
            displayName: 'Test Outlet'
          })
        ])
      );
    });
  });

  // Run integration tests if credentials are available
  if (canRunIntegrationTests()) {
    describe('integration tests', () => {
      let realPlatform: TSVESyncPlatform;
      
      beforeEach(() => {
        // Use real implementations for integration tests
        const VeSyncMock = jest.mocked(VeSync);
        VeSyncMock.mockImplementation((username, password, timezone, debug, redact, apiUrl, logger) => {
          return new RealVeSync(username, password, timezone, debug, redact, apiUrl, logger);
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

        if (process.env.DEBUG) {
          console.log('Integration test config:', {
            username: config.username,
            debug: config.debug,
            hasPassword: !!config.password,
          });
        }

        // Create the platform with real VeSync implementation
        realPlatform = new TSVESyncPlatform(mockLogger, config, mockAPI);

        // Reset login state and backoff for tests
        (realPlatform as any).lastLogin = new Date(0);
        (realPlatform as any).lastLoginAttempt = new Date(0);
        (realPlatform as any).loginBackoffTime = 0;

        // Access the VeSync client directly to verify it's configured correctly
        const platformClient = (realPlatform as any).client;
        if (platformClient && process.env.DEBUG) {
          console.log('VeSync client:', {
            isInitialized: true,
            hasLogin: typeof platformClient.login === 'function',
            hasGetDevices: typeof platformClient.getDevices === 'function',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            username: platformClient.username,
            hasPassword: !!platformClient.password,
            apiUrl: platformClient.apiUrl,
          });
        }
      });

      afterEach(() => {
        // Reset the mock implementations
        jest.resetAllMocks();
      });

      it('should connect to VeSync API', async () => {
        try {
          const result = await (realPlatform as any).ensureLogin(true); // Force new login
          if (process.env.DEBUG) {
            console.log('Login result:', result);
          }
          if (!result) {
            // Try to get client state
            const client = (realPlatform as any).client;
            if (client && process.env.DEBUG) {
              console.log('Client state:', {
                lastLogin: (realPlatform as any).lastLogin,
                lastLoginAttempt: (realPlatform as any).lastLoginAttempt,
                loginBackoffTime: (realPlatform as any).loginBackoffTime,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              });
            }
          }
          expect(result).toBe(true);
        } catch (error) {
          if (process.env.DEBUG) {
            console.log('Login attempt error:', error);
          }
          throw error;
        }
      }, 10000);

      it('should fetch devices', async () => {
        try {
          // First login
          const loginResult = await (realPlatform as any).ensureLogin(true); // Force new login
          if (process.env.DEBUG) {
            console.log('Login result:', loginResult);
          }
          expect(loginResult).toBe(true);
          
          // Then fetch devices
          await realPlatform.updateDeviceStatesFromAPI();
          if (process.env.DEBUG) {
            console.log('Device update completed');
          }
          
          // Log found devices
          const client = (realPlatform as any).client;
          if (client && process.env.DEBUG) {
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
          }
        } catch (error) {
          if (process.env.DEBUG) {
            console.log('Device fetch error:', error);
          }
          throw error;
        }
      }, 10000);
    });
  }
}); 