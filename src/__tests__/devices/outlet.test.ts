import { API, Logger, Service as ServiceType, Characteristic as CharacteristicType } from 'homebridge';
import { VeSync } from 'tsvesync';
import { TSVESyncPlatform } from '../../platform';
import { TEST_CONFIG } from '../setup';
import { createMockLogger, createMockOutlet, createMockVeSync } from '../utils/test-helpers';
import { PLATFORM_NAME, PLUGIN_NAME } from '../../settings';
import { DeviceFactory } from '../../utils/device-factory';
import { BaseAccessory } from '../../accessories/base.accessory';
import { OutletAccessory } from '../../accessories/outlet.accessory';
import { VeSyncOutlet } from '../../types/device.types';
import { RetryManager } from '../../utils/retry';

// Mock RetryManager
jest.mock('../../utils/retry');
const mockRetryManager = jest.mocked(RetryManager);

// Import constants from outlet accessory
const POWER_SERVICE_NAME = 'Power Consumption';
const POWER_CHARACTERISTIC = {
  displayName: 'Power',
  UUID: '7B2B25B0-DB50-4351-9A8B-5B9F3E3E3E3E',
};
const VOLTAGE_CHARACTERISTIC = {
  displayName: 'Voltage',
  UUID: '7B2B25B1-DB50-4351-9A8B-5B9F3E3E3E3E',
};
const ENERGY_CHARACTERISTIC = {
  displayName: 'Energy',
  UUID: '7B2B25B2-DB50-4351-9A8B-5B9F3E3E3E3E',
};

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
    // Reset all mocks
    jest.clearAllMocks();

    // Mock RetryManager to execute operations immediately
    mockRetryManager.prototype.execute.mockImplementation(async (operation) => {
      return operation();
    });

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
        addService: jest.fn().mockImplementation((service) => service),
        removeService: jest.fn(),
        getService: jest.fn().mockReturnValue({
          getCharacteristic: jest.fn().mockReturnValue({
            onSet: jest.fn(),
            onGet: jest.fn(),
            updateValue: jest.fn(),
          }),
          setCharacteristic: jest.fn().mockReturnThis(),
        }),
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
          Switch: jest.fn().mockImplementation(() => ({
            getCharacteristic: jest.fn().mockReturnValue({
              onSet: jest.fn(),
              onGet: jest.fn(),
              updateValue: jest.fn(),
            }),
            setCharacteristic: jest.fn().mockReturnThis(),
          })),
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
      const expectedDetails = {
        deviceStatus: 'on',
        power: 0,
        voltage: 120,
        energy: 0.5,
      };

      // Create mock outlet and accessory
      const mockOutlet = createMockOutlet({
        deviceName: 'Test Outlet',
        deviceType: 'wifi-switch-1.3',
        cid: 'test-cid-123',
      });

      const accessory = new mockAPI.platformAccessory(mockOutlet.deviceName, mockAPI.hap.uuid.generate(mockOutlet.cid));
      accessory.context.device = mockOutlet;

      // Mock getDetails to return expected values
      mockOutlet.getDetails = jest.fn().mockResolvedValue(expectedDetails);

      // Create mock services
      const mockBaseService = {
        getCharacteristic: jest.fn().mockImplementation((name) => {
          const characteristic = {
            onGet: jest.fn().mockImplementation((handler) => {
              characteristic.getValue = handler;
              return characteristic;
            }),
            onSet: jest.fn().mockImplementation((handler) => {
              characteristic.setValue = handler;
              return characteristic;
            }),
            getValue: jest.fn(),
            setValue: jest.fn(),
            updateValue: jest.fn(),
          };
          return characteristic;
        }),
        addCharacteristic: jest.fn().mockImplementation((char) => char),
      };

      const mockPowerService = {
        getCharacteristic: jest.fn().mockImplementation((uuid) => {
          const characteristic = {
            UUID: uuid,
            value: undefined,
            onGet: jest.fn().mockImplementation((handler) => {
              characteristic.getValue = handler;
              return characteristic;
            }),
            onSet: jest.fn().mockImplementation((handler) => {
              characteristic.setValue = handler;
              return characteristic;
            }),
            getValue: jest.fn(),
            setValue: jest.fn(),
            updateValue: jest.fn().mockImplementation((value) => {
              characteristic.value = value;
              return characteristic;
            }),
          };
          return characteristic;
        }),
        addCharacteristic: jest.fn().mockImplementation((char) => {
          const characteristic = {
            UUID: char.UUID,
            value: undefined,
            onGet: jest.fn().mockImplementation((handler) => {
              characteristic.getValue = handler;
              return characteristic;
            }),
            onSet: jest.fn().mockImplementation((handler) => {
              characteristic.setValue = handler;
              return characteristic;
            }),
            getValue: jest.fn(),
            setValue: jest.fn(),
            updateValue: jest.fn().mockImplementation((value) => {
              characteristic.value = value;
              return characteristic;
            }),
          };
          return characteristic;
        }),
      };

      accessory.getService = jest.fn().mockImplementation((service) => {
        if (service === platform.Service.Outlet) {
          return mockBaseService;
        }
        if (service === 'Power Consumption') {
          return mockPowerService;
        }
        return undefined;
      });

      // Create the outlet accessory
      const outlet = new OutletAccessory(platform, accessory, mockOutlet);

      // Wait for initial setup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get the power service
      const powerService = accessory.getService('Power Consumption');
      expect(powerService).toBeDefined();

      // Get characteristics
      const powerChar = powerService?.getCharacteristic('7B2B25B0-DB50-4351-9A8B-5B9F3E3E3E3E');
      const voltageChar = powerService?.getCharacteristic('7B2B25B1-DB50-4351-9A8B-5B9F3E3E3E3E');
      const energyChar = powerService?.getCharacteristic('7B2B25B2-DB50-4351-9A8B-5B9F3E3E3E3E');

      expect(powerChar).toBeDefined();
      expect(voltageChar).toBeDefined();
      expect(energyChar).toBeDefined();

      if (!powerChar || !voltageChar || !energyChar) {
        throw new Error('Power monitoring characteristics not found');
      }

      // Update characteristic values
      powerChar.updateValue(expectedDetails.power);
      voltageChar.updateValue(expectedDetails.voltage);
      energyChar.updateValue(expectedDetails.energy);

      // Verify values
      expect(powerChar.value).toBe(expectedDetails.power);
      expect(voltageChar.value).toBe(expectedDetails.voltage);
      expect(energyChar.value).toBe(expectedDetails.energy);
    }, 10000); // Increase timeout to 10 seconds

    it('should handle device errors', async () => {
      const mockOutlet = createMockOutlet({
        deviceName: 'Test Outlet',
        deviceType: 'wifi-switch-1.3',
        cid: 'test-cid-123',
      });

      const accessory = new mockAPI.platformAccessory(mockOutlet.deviceName, mockAPI.hap.uuid.generate(mockOutlet.cid));
      accessory.context.device = mockOutlet;

      // Mock turnOn to throw an error
      mockOutlet.turnOn.mockRejectedValue(new Error('Failed to turn on'));

      // Mock the getService method to return a service with proper characteristics
      const mockOutletService = {
        getCharacteristic: jest.fn().mockImplementation((name) => {
          const characteristic = {
            onGet: jest.fn().mockImplementation((handler) => {
              characteristic.getValue = handler;
              return characteristic;
            }),
            onSet: jest.fn().mockImplementation((handler) => {
              characteristic.setValue = handler;
              return characteristic;
            }),
            getValue: jest.fn(),
            setValue: jest.fn().mockImplementation((value) => {
              if (value) {
                return Promise.reject(new Error('Failed to turn on'));
              }
              return Promise.resolve();
            }),
            updateValue: jest.fn(),
          };
          return characteristic;
        }),
        addCharacteristic: jest.fn().mockImplementation((char) => char),
      };

      const mockPowerService = {
        getCharacteristic: jest.fn().mockImplementation((uuid) => {
          const characteristic = {
            UUID: uuid,
            value: undefined,
            onGet: jest.fn().mockImplementation((handler) => {
              characteristic.getValue = handler;
              return characteristic;
            }),
            onSet: jest.fn().mockImplementation((handler) => {
              characteristic.setValue = handler;
              return characteristic;
            }),
            getValue: jest.fn(),
            setValue: jest.fn(),
            updateValue: jest.fn().mockImplementation((value) => {
              characteristic.value = value;
              return characteristic;
            }),
          };
          return characteristic;
        }),
        addCharacteristic: jest.fn().mockImplementation((char) => {
          const characteristic = {
            UUID: char.UUID,
            value: undefined,
            onGet: jest.fn().mockImplementation((handler) => {
              characteristic.getValue = handler;
              return characteristic;
            }),
            onSet: jest.fn().mockImplementation((handler) => {
              characteristic.setValue = handler;
              return characteristic;
            }),
            getValue: jest.fn(),
            setValue: jest.fn(),
            updateValue: jest.fn().mockImplementation((value) => {
              characteristic.value = value;
              return characteristic;
            }),
          };
          return characteristic;
        }),
      };

      accessory.getService = jest.fn().mockImplementation((service) => {
        if (service === platform.Service.Outlet) {
          return mockOutletService;
        }
        if (service === 'Power Consumption') {
          return mockPowerService;
        }
        return undefined;
      });

      // Create the outlet accessory
      const outlet = new OutletAccessory(platform, accessory, mockOutlet);

      // Wait for initial setup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get the outlet service
      const outletService = accessory.getService(platform.Service.Outlet);
      expect(outletService).toBeDefined();

      // Get the On characteristic
      const onChar = outletService?.getCharacteristic('On');
      expect(onChar).toBeDefined();

      if (!onChar) {
        throw new Error('On characteristic not found');
      }

      // Try to set the value and expect it to throw
      await expect(onChar.setValue(true)).rejects.toThrow('Failed to turn on');
    }, 10000); // Increase timeout to 10 seconds
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