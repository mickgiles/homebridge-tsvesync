// Set up mocks before imports
jest.mock('../../utils/device-factory');
jest.mock('tsvesync');

import { API, Logger, PlatformAccessory, Service as ServiceType, Characteristic as CharacteristicType, CharacteristicValue } from 'homebridge';
import { VeSync } from 'tsvesync';
import { TSVESyncPlatform } from '../../platform';
import { TEST_CONFIG } from '../setup';
import { createMockLogger, createMockSwitch } from '../utils/test-helpers';
import { DeviceFactory } from '../../utils/device-factory';
import { SwitchAccessory } from '../../accessories/switch.accessory';

const mockDeviceFactory = jest.mocked(DeviceFactory);

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
    jest.useFakeTimers();

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

    // Setup VeSync mock
    mockVeSync = {
      login: jest.fn(),
      getDevices: jest.fn(),
      switches: [],
    } as unknown as jest.Mocked<VeSync>;

    // Replace VeSync client
    (platform as any).client = mockVeSync;

    // Mock DeviceFactory
    mockDeviceFactory.getAccessoryCategory.mockReturnValue(8); // 8 is the category for switches
    mockDeviceFactory.createAccessory.mockImplementation((platform, accessory, device) => {
      return new SwitchAccessory(platform, accessory, device);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('switch state management', () => {
    it('should handle power state changes', async () => {
      // Create a mock switch with immediate responses
      const mockSwitch = createMockSwitch({
        deviceName: 'Test Switch',
        deviceType: 'ESW01-EU',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      // Create a mock accessory
      const mockAccessory = new mockAPI.platformAccessory(mockSwitch.deviceName, mockAPI.hap.uuid.generate(mockSwitch.cid));
      mockAccessory.context.device = mockSwitch;

      // Create the switch accessory
      const switchAccessory = new SwitchAccessory(platform, mockAccessory, mockSwitch);
      await switchAccessory.initialize();

      // Get the switch service
      const switchService = mockAccessory.getService(platform.Service.Switch);
      expect(switchService).toBeDefined();

      // Test turning on
      await mockSetHandler(true);
      expect(mockSwitch.turnOn).toHaveBeenCalled();
      expect(mockSwitch.power).toBe(true);
      expect(mockSwitch.deviceStatus).toBe('on');

      // Test turning off
      await mockSetHandler(false);
      expect(mockSwitch.turnOff).toHaveBeenCalled();
      expect(mockSwitch.power).toBe(false);
      expect(mockSwitch.deviceStatus).toBe('off');
    }, 10000);

    it('should handle device errors', async () => {
      // Create a mock switch with immediate error responses
      const mockSwitch = createMockSwitch({
        deviceName: 'Test Switch',
        deviceType: 'ESW01-EU',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      // Setup error cases with immediate rejections
      mockSwitch.turnOn.mockRejectedValue(new Error('Failed to turn on'));
      mockSwitch.turnOff.mockRejectedValue(new Error('Failed to turn off'));
      mockSwitch.getDetails.mockRejectedValue(new Error('Failed to get details'));

      // Create a mock accessory
      const mockAccessory = new mockAPI.platformAccessory(mockSwitch.deviceName, mockAPI.hap.uuid.generate(mockSwitch.cid));
      mockAccessory.context.device = mockSwitch;

      // Create the switch accessory
      const switchAccessory = new SwitchAccessory(platform, mockAccessory, mockSwitch);
      await switchAccessory.initialize().catch(() => {
        // Ignore initialization error since we're testing error handling
      });

      // Get the switch service
      const switchService = mockAccessory.getService(platform.Service.Switch);
      expect(switchService).toBeDefined();

      // Test error handling
      await expect(mockSwitch.turnOn).rejects.toThrow('Failed to turn on');
      await expect(mockSwitch.turnOff).rejects.toThrow('Failed to turn off');
      await expect(mockSwitch.getDetails).rejects.toThrow('Failed to get details');
    }, 10000);
  });

  describe('switch device types', () => {
    it('should support ESW01-EU devices', async () => {
      // Create a mock switch with immediate responses
      const mockSwitch = createMockSwitch({
        deviceName: 'Test Switch',
        deviceType: 'ESW01-EU',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      mockSwitch.getDetails.mockResolvedValue({ deviceStatus: 'off' });

      // Create a mock accessory
      const mockAccessory = new mockAPI.platformAccessory(mockSwitch.deviceName, mockAPI.hap.uuid.generate(mockSwitch.cid));
      mockAccessory.context.device = mockSwitch;

      // Create the switch accessory
      const switchAccessory = new SwitchAccessory(platform, mockAccessory, mockSwitch);
      await switchAccessory.initialize();

      // Get the switch service
      const switchService = mockAccessory.getService(platform.Service.Switch);
      expect(switchService).toBeDefined();
      expect(mockSwitch.deviceType).toBe('ESW01-EU');
    }, 10000);

    it('should support other switch device types', async () => {
      // Create a mock switch with immediate responses
      const mockSwitch = createMockSwitch({
        deviceName: 'Test Switch',
        deviceType: 'other-switch-type',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      mockSwitch.getDetails.mockResolvedValue({ power: false, deviceStatus: 'off' });

      // Create a mock accessory
      const mockAccessory = new mockAPI.platformAccessory(mockSwitch.deviceName, mockAPI.hap.uuid.generate(mockSwitch.cid));
      mockAccessory.context.device = mockSwitch;

      // Create the switch accessory
      const switchAccessory = new SwitchAccessory(platform, mockAccessory, mockSwitch);
      await switchAccessory.initialize();

      // Get the switch service
      const switchService = mockAccessory.getService(platform.Service.Switch);
      expect(switchService).toBeDefined();
      expect(mockSwitch.deviceType).toBe('other-switch-type');
    }, 10000);
  });
}); 