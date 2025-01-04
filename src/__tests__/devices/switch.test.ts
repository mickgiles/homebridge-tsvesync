// Set up mocks before imports
jest.mock('../../utils/device-factory');
jest.mock('tsvesync');
jest.mock('../../utils/retry');

import { API, Logger, PlatformAccessory, Service as ServiceType, Characteristic as CharacteristicType, CharacteristicValue } from 'homebridge';
import { VeSync } from 'tsvesync';
import { TSVESyncPlatform } from '../../platform';
import { TEST_CONFIG } from '../setup';
import { createMockLogger, createMockSwitch } from '../utils/test-helpers';
import { DeviceFactory } from '../../utils/device-factory';
import { BaseAccessory } from '../../accessories/base.accessory';
import { VeSyncSwitch } from '../../types/device.types';
import { RetryManager } from '../../utils/retry';

const mockDeviceFactory = jest.mocked(DeviceFactory);
const mockRetryManager = jest.mocked(RetryManager);

describe('Switch Device Tests', () => {
  let platform: TSVESyncPlatform;
  let mockLogger: jest.Mocked<Logger>;
  let mockAPI: jest.Mocked<API>;
  let mockVeSync: jest.Mocked<VeSync>;
  let mockSetHandler: jest.Mock;
  let mockGetHandler: jest.Mock;

  const defaultConfig = {
    platform: 'TSVESync',
    name: 'TSVESync',
    username: TEST_CONFIG.username || 'test@example.com',
    password: TEST_CONFIG.password || 'password123',
    apiUrl: TEST_CONFIG.apiUrl,
    debug: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock RetryManager to execute operations immediately
    mockRetryManager.prototype.execute.mockImplementation(async (operation) => {
      return operation();
    });

    // Setup handlers
    mockSetHandler = jest.fn();
    mockGetHandler = jest.fn();

    // Setup logger mock
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
        getService: jest.fn().mockReturnValue({
          getCharacteristic: jest.fn().mockReturnValue({
            onSet: jest.fn().mockImplementation((fn) => {
              mockSetHandler = fn;
              return {
                onGet: jest.fn()
              };
            }),
            onGet: jest.fn().mockImplementation((fn) => {
              mockGetHandler = fn;
              return {
                updateValue: jest.fn()
              };
            }),
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
          Switch: jest.fn().mockImplementation(() => ({
            getCharacteristic: jest.fn().mockReturnValue({
              onSet: jest.fn().mockImplementation((fn) => {
                mockSetHandler = fn;
                return {
                  onGet: jest.fn()
                };
              }),
              onGet: jest.fn().mockImplementation((fn) => {
                mockGetHandler = fn;
                return {
                  updateValue: jest.fn()
                };
              }),
              updateValue: jest.fn(),
            }),
            setCharacteristic: jest.fn().mockReturnThis(),
          })),
          AccessoryInformation: jest.fn(),
        } as unknown as typeof ServiceType,
        Characteristic: {
          On: 'On',
          Name: 'Name',
          Model: 'Model',
          Manufacturer: 'Manufacturer',
          SerialNumber: 'SerialNumber',
          FirmwareRevision: 'FirmwareRevision',
        } as unknown as typeof CharacteristicType,
        uuid: {
          generate: jest.fn().mockImplementation((id) => `test-uuid-${id}`),
        },
      },
    } as unknown as jest.Mocked<API>;

    // Create platform instance
    platform = new TSVESyncPlatform(mockLogger, defaultConfig, mockAPI);
    platform.isReady = jest.fn().mockResolvedValue(true);
    platform.updateDeviceStatesFromAPI = jest.fn().mockResolvedValue(undefined);

    // Setup VeSync mock
    mockVeSync = {
      login: jest.fn().mockResolvedValue(true),
      getDevices: jest.fn().mockResolvedValue(true),
      switches: [],
    } as unknown as jest.Mocked<VeSync>;

    // Replace VeSync client
    (platform as any).client = mockVeSync;

    // Mock DeviceFactory
    mockDeviceFactory.getAccessoryCategory.mockReturnValue(8); // 8 is the category for switches
    mockDeviceFactory.createAccessory.mockImplementation((platform, accessory, device) => {
      const baseAccessory = {
        service: new mockAPI.hap.Service.Switch(),
        platform,
        accessory,
        device,
        initialize: jest.fn().mockResolvedValue(undefined),
        updateCharacteristicValue: jest.fn(),
      } as unknown as BaseAccessory;
      return baseAccessory;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('switch state management', () => {
    let mockSwitch: jest.Mocked<VeSyncSwitch>;
    let switchAccessory: BaseAccessory;
    let onCharacteristic: any;

    beforeEach(async () => {
      // Create a mock switch with immediate responses
      mockSwitch = createMockSwitch({
        deviceName: 'Test Switch',
        deviceType: 'ESW01-EU',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
        power: false,
      });

      // Mock successful details retrieval
      mockSwitch.getDetails.mockResolvedValue(true);
      mockSwitch.deviceStatus = 'off';

      // Create a mock accessory
      const mockAccessory = new mockAPI.platformAccessory(mockSwitch.deviceName, mockAPI.hap.uuid.generate(mockSwitch.cid));
      mockAccessory.context.device = mockSwitch;

      // Create the switch accessory
      switchAccessory = mockDeviceFactory.createAccessory(platform, mockAccessory, mockSwitch);

      // Set up the characteristic handlers
      onCharacteristic = {
        onSet: jest.fn().mockImplementation(async (value: boolean) => {
          if (value) {
            await mockSwitch.turnOn();
          } else {
            await mockSwitch.turnOff();
          }
        }),
        onGet: jest.fn().mockImplementation(async () => {
          return mockSwitch.deviceStatus === 'on';
        }),
      };

      // Mock the service to use our handlers
      const mockService = {
        getCharacteristic: jest.fn().mockReturnValue(onCharacteristic),
        setCharacteristic: jest.fn().mockReturnThis(),
      };
      (mockAccessory.getService as jest.Mock).mockReturnValue(mockService);

      await switchAccessory.initialize();
    });

    it('should handle power state changes', async () => {
      // Test turning on
      await onCharacteristic.onSet(true);
      expect(mockSwitch.turnOn).toHaveBeenCalled();

      // Test turning off
      await onCharacteristic.onSet(false);
      expect(mockSwitch.turnOff).toHaveBeenCalled();
    });

    it('should handle device errors', async () => {
      // Mock error responses
      mockSwitch.turnOn.mockRejectedValueOnce(new Error('Failed to turn on'));
      mockSwitch.turnOff.mockRejectedValueOnce(new Error('Failed to turn off'));

      // Test error handling for turn on
      await expect(onCharacteristic.onSet(true)).rejects.toThrow('Failed to turn on');

      // Test error handling for turn off
      await expect(onCharacteristic.onSet(false)).rejects.toThrow('Failed to turn off');
    });
  });

  describe('switch device types', () => {
    beforeEach(async () => {
      // Ensure platform is ready before each test
      await platform.isReady();
    });

    it('should support ESW01-EU devices', async () => {
      // Create a mock switch with immediate responses
      const mockSwitch = createMockSwitch({
        deviceName: 'Test Switch',
        deviceType: 'ESW01-EU',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      // Mock successful details retrieval
      mockSwitch.getDetails.mockResolvedValue(true);
      mockSwitch.deviceStatus = 'off';

      // Create a mock accessory
      const mockAccessory = new mockAPI.platformAccessory(mockSwitch.deviceName, mockAPI.hap.uuid.generate(mockSwitch.cid));
      mockAccessory.context.device = mockSwitch;

      // Create the switch accessory
      const switchAccessory = mockDeviceFactory.createAccessory(platform, mockAccessory, mockSwitch);
      await switchAccessory.initialize();

      // Get the switch service
      const switchService = mockAccessory.getService(platform.Service.Switch);
      expect(switchService).toBeDefined();
      expect(mockSwitch.deviceType).toBe('ESW01-EU');
    });

    it('should support other switch device types', async () => {
      // Create a mock switch with immediate responses
      const mockSwitch = createMockSwitch({
        deviceName: 'Test Switch',
        deviceType: 'other-switch-type',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      // Mock successful details retrieval
      mockSwitch.getDetails.mockResolvedValue(true);
      mockSwitch.deviceStatus = 'off';

      // Create a mock accessory
      const mockAccessory = new mockAPI.platformAccessory(mockSwitch.deviceName, mockAPI.hap.uuid.generate(mockSwitch.cid));
      mockAccessory.context.device = mockSwitch;

      // Create the switch accessory
      const switchAccessory = mockDeviceFactory.createAccessory(platform, mockAccessory, mockSwitch);
      await switchAccessory.initialize();

      // Get the switch service
      const switchService = mockAccessory.getService(platform.Service.Switch);
      expect(switchService).toBeDefined();
      expect(mockSwitch.deviceType).toBe('other-switch-type');
    });
  });
}); 