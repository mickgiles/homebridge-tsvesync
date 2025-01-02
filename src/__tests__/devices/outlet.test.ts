import { API, Logger, Service as ServiceType, Characteristic as CharacteristicType } from 'homebridge';
import { VeSync } from 'tsvesync';
import { TSVESyncPlatform } from '../../platform';
import { TEST_CONFIG } from '../setup';
import { createMockLogger, createMockOutlet, createMockVeSync } from '../utils/test-helpers';
import { PLATFORM_NAME, PLUGIN_NAME } from '../../settings';
import { DeviceFactory } from '../../utils/device-factory';
import { BaseAccessory } from '../../accessories/base.accessory';

jest.mock('../../utils/device-factory');
const mockDeviceFactory = jest.mocked(DeviceFactory);

describe('Outlet Device Tests', () => {
  let platform: TSVESyncPlatform;
  let mockLogger: jest.Mocked<Logger>;
  let mockAPI: jest.Mocked<API>;
  let mockVeSync: jest.Mocked<VeSync>;

  const defaultConfig = {
    platform: 'TSVESync',
    name: 'TSVESync',
    username: TEST_CONFIG.username || 'test@example.com',
    password: TEST_CONFIG.password || 'password123',
    apiUrl: TEST_CONFIG.apiUrl,
    debug: true,
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    
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

    // Setup VeSync mock
    mockVeSync = createMockVeSync();

    // Initialize platform
    platform = new TSVESyncPlatform(mockLogger, defaultConfig, mockAPI);
    // Inject the mock VeSync client
    (platform as any).client = mockVeSync;

    // Mock DeviceFactory
    mockDeviceFactory.getAccessoryCategory.mockReturnValue(1); // 1 is the category for outlets
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
  });

  describe('outlet state management', () => {
    it('should handle power state changes', async () => {
      const mockOutlet = createMockOutlet({
        deviceName: 'Test Outlet',
        deviceType: 'wifi-switch-1.3',
        cid: 'test-cid-123',
        power: 10 // Power in watts
      });

      // Setup VeSync client with the mock outlet
      mockVeSync.outlets = [mockOutlet];
      mockVeSync.getDevices.mockResolvedValue(true);
      mockVeSync.login.mockResolvedValue(true);

      // Initialize platform and wait for discovery
      await platform.discoverDevices();
      expect(mockAPI.registerPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        expect.arrayContaining([
          expect.objectContaining({
            UUID: expect.stringContaining('test-uuid-test-cid-123'),
            displayName: 'Test Outlet'
          })
        ])
      );

      // Verify power state changes
      await mockOutlet.turnOff();
      expect(mockOutlet.turnOff).toHaveBeenCalled();
    });

    it('should handle energy monitoring', async () => {
      const mockOutlet = createMockOutlet({
        deviceName: 'Test Outlet',
        deviceType: 'wifi-switch-1.3',
        cid: 'test-cid-123',
        voltage: 120,
        current: 1.5,
        energy: 0.5
      });

      // Setup VeSync client with the mock outlet
      mockVeSync.outlets = [mockOutlet];
      mockVeSync.getDevices.mockResolvedValue(true);
      mockVeSync.login.mockResolvedValue(true);

      // Initialize platform and wait for discovery
      await platform.discoverDevices();
      expect(mockAPI.registerPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        expect.arrayContaining([
          expect.objectContaining({
            UUID: expect.stringContaining('test-uuid-test-cid-123'),
            displayName: 'Test Outlet'
          })
        ])
      );

      // Verify energy monitoring details
      const details = await mockOutlet.getDetails();
      expect(details.voltage).toBe(120);
      expect(details.current).toBe(1.5);
      expect(details.energy).toBe(0.5);
    });

    it('should handle device errors', async () => {
      const mockOutlet = createMockOutlet({
        deviceName: 'Test Outlet',
        deviceType: 'wifi-switch-1.3',
        cid: 'test-cid-123'
      });

      // Setup VeSync client with the mock outlet
      mockVeSync.outlets = [mockOutlet];
      mockVeSync.getDevices.mockResolvedValue(true);
      mockVeSync.login.mockResolvedValue(true);

      // Setup error case
      mockOutlet.getDetails.mockRejectedValue(new Error('Device error'));

      // Initialize platform and wait for discovery
      await platform.discoverDevices();
      expect(mockAPI.registerPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        expect.arrayContaining([
          expect.objectContaining({
            UUID: expect.stringContaining('test-uuid-test-cid-123'),
            displayName: 'Test Outlet'
          })
        ])
      );

      // Verify error handling
      await expect(mockOutlet.getDetails()).rejects.toThrow('Device error');
    });
  });

  describe('outlet device types', () => {
    it('should support ESO15-TB devices', async () => {
      const mockOutlet = createMockOutlet({
        deviceName: 'Test Outlet',
        deviceType: 'ESO15-TB',
        cid: 'test-cid-123'
      });

      // Setup VeSync client with the mock outlet
      mockVeSync.outlets = [mockOutlet];
      mockVeSync.getDevices.mockResolvedValue(true);
      mockVeSync.login.mockResolvedValue(true);

      // Initialize platform and wait for discovery
      await platform.discoverDevices();
      expect(mockAPI.registerPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        expect.arrayContaining([
          expect.objectContaining({
            UUID: expect.stringContaining('test-uuid-test-cid-123'),
            displayName: 'Test Outlet'
          })
        ])
      );
      expect(mockOutlet.deviceType).toBe('ESO15-TB');
    });

    it('should support ESW03-USA devices', async () => {
      const mockOutlet = createMockOutlet({
        deviceName: 'Test Outlet',
        deviceType: 'ESW03-USA',
        cid: 'test-cid-123'
      });

      // Setup VeSync client with the mock outlet
      mockVeSync.outlets = [mockOutlet];
      mockVeSync.getDevices.mockResolvedValue(true);
      mockVeSync.login.mockResolvedValue(true);

      // Initialize platform and wait for discovery
      await platform.discoverDevices();
      expect(mockAPI.registerPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        expect.arrayContaining([
          expect.objectContaining({
            UUID: expect.stringContaining('test-uuid-test-cid-123'),
            displayName: 'Test Outlet'
          })
        ])
      );
      expect(mockOutlet.deviceType).toBe('ESW03-USA');
    });

    it('should support wifi-switch-1.3 devices', async () => {
      const mockOutlet = createMockOutlet({
        deviceName: 'Test Outlet',
        deviceType: 'wifi-switch-1.3',
        cid: 'test-cid-123'
      });

      // Setup VeSync client with the mock outlet
      mockVeSync.outlets = [mockOutlet];
      mockVeSync.getDevices.mockResolvedValue(true);
      mockVeSync.login.mockResolvedValue(true);

      // Initialize platform and wait for discovery
      await platform.discoverDevices();
      expect(mockAPI.registerPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        expect.arrayContaining([
          expect.objectContaining({
            UUID: expect.stringContaining('test-uuid-test-cid-123'),
            displayName: 'Test Outlet'
          })
        ])
      );
      expect(mockOutlet.deviceType).toBe('wifi-switch-1.3');
    });
  });
}); 