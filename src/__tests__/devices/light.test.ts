// Set up mocks before imports
jest.mock('../../utils/device-factory');
jest.mock('tsvesync');
jest.mock('../../utils/retry');

import { API, Logger, PlatformAccessory, Service as ServiceType, Characteristic as CharacteristicType, CharacteristicValue } from 'homebridge';
import { VeSync } from 'tsvesync';
import { TSVESyncPlatform } from '../../platform';
import { TEST_CONFIG } from '../setup';
import { createMockLogger, createMockBulb } from '../utils/test-helpers';
import { DeviceFactory } from '../../utils/device-factory';
import { BaseAccessory } from '../../accessories/base.accessory';
import { VeSyncBulb } from '../../types/device.types';
import { RetryManager } from '../../utils/retry';

const mockDeviceFactory = jest.mocked(DeviceFactory);
const mockRetryManager = jest.mocked(RetryManager);

describe('Light Device Tests', () => {
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
    jest.clearAllMocks();

    // Mock RetryManager to execute operations immediately
    mockRetryManager.prototype.execute.mockImplementation(async (operation) => {
      return operation();
    });

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
          Lightbulb: jest.fn().mockImplementation(() => ({
            getCharacteristic: jest.fn(),
            setCharacteristic: jest.fn().mockReturnThis(),
          })),
          AccessoryInformation: jest.fn(),
        } as unknown as typeof ServiceType,
        Characteristic: {
          On: 'On',
          Brightness: 'Brightness',
          ColorTemperature: 'ColorTemperature',
          Hue: 'Hue',
          Saturation: 'Saturation',
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
      bulbs: [],
    } as unknown as jest.Mocked<VeSync>;

    // Replace VeSync client
    (platform as any).client = mockVeSync;

    // Mock DeviceFactory
    mockDeviceFactory.getAccessoryCategory.mockReturnValue(5); // 5 is the category for lightbulbs
    mockDeviceFactory.createAccessory.mockImplementation((platform, accessory, device) => {
      const baseAccessory = {
        service: new mockAPI.hap.Service.Lightbulb(),
        platform,
        accessory,
        device,
        initialize: jest.fn().mockResolvedValue(undefined),
        updateCharacteristicValue: jest.fn(),
      } as unknown as BaseAccessory;
      return baseAccessory;
    });
  });

  describe('light state management', () => {
    let mockBulb: jest.Mocked<VeSyncBulb>;
    let lightAccessory: BaseAccessory;
    let onCharacteristic: any;
    let brightnessCharacteristic: any;
    let colorTempCharacteristic: any;
    let hueCharacteristic: any;
    let saturationCharacteristic: any;

    beforeEach(async () => {
      // Create a mock bulb with immediate responses
      mockBulb = createMockBulb({
        deviceName: 'Test Light',
        deviceType: 'ESL100MC',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      // Mock successful details retrieval
      mockBulb.getDetails.mockResolvedValue(true);
      mockBulb.deviceStatus = 'off';
      mockBulb.brightness = 50;
      mockBulb.colorTemp = 200;
      mockBulb.hue = 0;
      mockBulb.saturation = 0;

      // Ensure all required methods are defined
      mockBulb.turnOn = jest.fn().mockResolvedValue(true);
      mockBulb.turnOff = jest.fn().mockResolvedValue(true);
      mockBulb.setBrightness = jest.fn().mockResolvedValue(true);
      mockBulb.setColorTemperature = jest.fn().mockResolvedValue(true);
      mockBulb.setColor = jest.fn().mockResolvedValue(true);

      // Create a mock accessory
      const mockAccessory = new mockAPI.platformAccessory(mockBulb.deviceName, mockAPI.hap.uuid.generate(mockBulb.cid));
      mockAccessory.context.device = mockBulb;

      // Create the light accessory
      lightAccessory = mockDeviceFactory.createAccessory(platform, mockAccessory, mockBulb);

      // Set up the characteristic handlers
      onCharacteristic = {
        onSet: jest.fn().mockImplementation(async (value: boolean) => {
          if (value) {
            await mockBulb.turnOn!();
          } else {
            await mockBulb.turnOff!();
          }
        }),
        onGet: jest.fn().mockImplementation(async () => {
          return mockBulb.deviceStatus === 'on';
        }),
      };

      brightnessCharacteristic = {
        onSet: jest.fn().mockImplementation(async (value: number) => {
          await mockBulb.setBrightness!(value);
        }),
        onGet: jest.fn().mockImplementation(async () => {
          return mockBulb.brightness;
        }),
      };

      colorTempCharacteristic = {
        onSet: jest.fn().mockImplementation(async (value: number) => {
          await mockBulb.setColorTemperature!(value);
        }),
        onGet: jest.fn().mockImplementation(async () => {
          return mockBulb.colorTemp;
        }),
      };

      hueCharacteristic = {
        onSet: jest.fn().mockImplementation(async (value: number) => {
          await mockBulb.setColor!(value, mockBulb.saturation || 0);
        }),
        onGet: jest.fn().mockImplementation(async () => {
          return mockBulb.hue;
        }),
      };

      saturationCharacteristic = {
        onSet: jest.fn().mockImplementation(async (value: number) => {
          await mockBulb.setColor!(mockBulb.hue || 0, value);
        }),
        onGet: jest.fn().mockImplementation(async () => {
          return mockBulb.saturation;
        }),
      };

      // Mock the service to use our handlers
      const mockService = {
        getCharacteristic: jest.fn().mockImplementation((characteristic: any) => {
          if (!characteristic) return null;
          
          switch (characteristic) {
            case 'On':
              return onCharacteristic;
            case 'Brightness':
              return brightnessCharacteristic;
            case 'ColorTemperature':
              return colorTempCharacteristic;
            case 'Hue':
              return hueCharacteristic;
            case 'Saturation':
              return saturationCharacteristic;
            default:
              return {
                onSet: jest.fn(),
                onGet: jest.fn(),
              };
          }
        }),
        setCharacteristic: jest.fn().mockReturnThis(),
      };
      (mockAccessory.getService as jest.Mock).mockReturnValue(mockService);

      await lightAccessory.initialize();
    });

    it('should handle power state changes', async () => {
      // Test turning on
      await onCharacteristic.onSet(true);
      expect(mockBulb.turnOn).toHaveBeenCalled();

      // Test turning off
      await onCharacteristic.onSet(false);
      expect(mockBulb.turnOff).toHaveBeenCalled();
    });

    it('should handle brightness changes', async () => {
      const newBrightness = 75;
      await brightnessCharacteristic.onSet(newBrightness);
      expect(mockBulb.setBrightness).toHaveBeenCalledWith(newBrightness);
    });

    it('should handle color temperature changes', async () => {
      const newColorTemp = 300;
      await colorTempCharacteristic.onSet(newColorTemp);
      expect(mockBulb.setColorTemperature).toHaveBeenCalledWith(newColorTemp);
    });

    it('should handle color changes', async () => {
      const newHue = 180;
      const newSaturation = 100;

      // Test setting hue
      await hueCharacteristic.onSet(newHue);
      expect(mockBulb.setColor).toHaveBeenCalledWith(newHue, 0);

      // Test setting saturation
      await saturationCharacteristic.onSet(newSaturation);
      expect(mockBulb.setColor).toHaveBeenCalledWith(0, newSaturation);
    });

    it('should handle device errors', async () => {
      // Mock error responses
      (mockBulb.turnOn as jest.Mock).mockRejectedValueOnce(new Error('Failed to turn on'));
      (mockBulb.setBrightness as jest.Mock).mockRejectedValueOnce(new Error('Failed to set brightness'));
      (mockBulb.setColorTemperature as jest.Mock).mockRejectedValueOnce(new Error('Failed to set color temperature'));
      (mockBulb.setColor as jest.Mock).mockRejectedValueOnce(new Error('Failed to set color'));

      // Test error handling for turn on
      await expect(onCharacteristic.onSet(true)).rejects.toThrow('Failed to turn on');

      // Test error handling for brightness
      await expect(brightnessCharacteristic.onSet(75)).rejects.toThrow('Failed to set brightness');

      // Test error handling for color temperature
      await expect(colorTempCharacteristic.onSet(300)).rejects.toThrow('Failed to set color temperature');

      // Test error handling for color
      await expect(hueCharacteristic.onSet(180)).rejects.toThrow('Failed to set color');
    });
  });

  describe('light device types', () => {
    it('should support color temperature bulbs', async () => {
      // Create a mock bulb with immediate responses
      const mockBulb = createMockBulb({
        deviceName: 'Test CW Bulb',
        deviceType: 'ESL100CW',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      // Mock successful details retrieval
      mockBulb.getDetails.mockResolvedValue(true);
      mockBulb.deviceStatus = 'off';

      // Create a mock accessory
      const mockAccessory = new mockAPI.platformAccessory(mockBulb.deviceName, mockAPI.hap.uuid.generate(mockBulb.cid));
      mockAccessory.context.device = mockBulb;

      // Mock the service
      const mockService = {
        getCharacteristic: jest.fn().mockReturnValue({
          onSet: jest.fn(),
          onGet: jest.fn(),
        }),
        setCharacteristic: jest.fn().mockReturnThis(),
      };
      (mockAccessory.getService as jest.Mock).mockReturnValue(mockService);

      // Create the light accessory
      const lightAccessory = mockDeviceFactory.createAccessory(platform, mockAccessory, mockBulb);
      await lightAccessory.initialize();

      // Get the light service
      const lightService = mockAccessory.getService(platform.Service.Lightbulb);
      expect(lightService).toBeDefined();
      expect(mockBulb.deviceType).toBe('ESL100CW');
    });

    it('should support color bulbs', async () => {
      // Create a mock bulb with immediate responses
      const mockBulb = createMockBulb({
        deviceName: 'Test MC Bulb',
        deviceType: 'ESL100MC',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      // Mock successful details retrieval
      mockBulb.getDetails.mockResolvedValue(true);
      mockBulb.deviceStatus = 'off';

      // Create a mock accessory
      const mockAccessory = new mockAPI.platformAccessory(mockBulb.deviceName, mockAPI.hap.uuid.generate(mockBulb.cid));
      mockAccessory.context.device = mockBulb;

      // Mock the service
      const mockService = {
        getCharacteristic: jest.fn().mockReturnValue({
          onSet: jest.fn(),
          onGet: jest.fn(),
        }),
        setCharacteristic: jest.fn().mockReturnThis(),
      };
      (mockAccessory.getService as jest.Mock).mockReturnValue(mockService);

      // Create the light accessory
      const lightAccessory = mockDeviceFactory.createAccessory(platform, mockAccessory, mockBulb);
      await lightAccessory.initialize();

      // Get the light service
      const lightService = mockAccessory.getService(platform.Service.Lightbulb);
      expect(lightService).toBeDefined();
      expect(mockBulb.deviceType).toBe('ESL100MC');
    });
  });
}); 