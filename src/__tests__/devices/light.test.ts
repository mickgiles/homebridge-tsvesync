// Set up mocks before imports
jest.mock('../../utils/device-factory');
jest.mock('tsvesync');
jest.mock('../../utils/retry');

import { API, Logger, PlatformAccessory, Service as ServiceType, Characteristic as CharacteristicType, CharacteristicValue } from 'homebridge';
import { VeSync } from 'tsvesync';
import { TSVESyncPlatform } from '../../platform';
import { TEST_CONFIG } from '../setup';
import { createMockLogger, createMockBulb, createMockDimmer, flushPromises } from '../utils/test-helpers';
import { DeviceFactory } from '../../utils/device-factory';
import { BaseAccessory } from '../../accessories/base.accessory';
import { LightAccessory } from '../../accessories/light.accessory';
import { VeSyncBulb, VeSyncDimmerSwitch } from '../../types/device.types';
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
    platform.discoverDevices = jest.fn().mockResolvedValue(undefined);

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

  describe('dimmer device behaviour', () => {
    const createCharacteristic = (name: string) => {
      const characteristic: any = {
        name,
        onSet: jest.fn().mockImplementation((handler) => {
          characteristic._onSet = handler;
          return characteristic;
        }),
        onGet: jest.fn().mockImplementation((handler) => {
          characteristic._onGet = handler;
          return characteristic;
        }),
        updateValue: jest.fn().mockReturnThis(),
        setProps: jest.fn().mockReturnThis(),
      };
      return characteristic;
    };

    const createService = (characteristics: Map<string, any>) => ({
      getCharacteristic: jest.fn().mockImplementation((characteristic: any) => {
        const name = characteristic.name ?? characteristic;
        if (!characteristics.has(name)) {
          characteristics.set(name, createCharacteristic(name));
        }
        return characteristics.get(name);
      }),
      setCharacteristic: jest.fn().mockReturnThis(),
    });

    interface DimmerTestContext {
      dimmer: jest.Mocked<VeSyncDimmerSwitch>;
      accessory: LightAccessory;
      lightCharacteristics: Map<string, any>;
      indicatorCharacteristicMaps: Map<string, Map<string, any>>;
      platformApi: { updatePlatformAccessories: jest.Mock };
    }

    const buildDimmerContext = (config: Parameters<typeof createMockDimmer>[0] = {}): DimmerTestContext => {
      const dimmer = createMockDimmer(config);
      const lightCharacteristics = new Map<string, any>();
      const indicatorCharacteristicMaps = new Map<string, Map<string, any>>();
      const indicatorServices = new Map<string, any>();

      const platformApi = {
        updatePlatformAccessories: jest.fn().mockResolvedValue(undefined),
      };

      const infoService = {
        setCharacteristic: jest.fn().mockReturnThis(),
      };

      const platform = {
        log: mockLogger,
        config: {
          debug: true,
          retry: {
            maxRetries: 3,
          },
        },
        api: platformApi,
        Service: {
          Lightbulb: { displayName: 'Lightbulb' },
          AccessoryInformation: { displayName: 'AccessoryInformation' },
        },
        Characteristic: {
          On: { name: 'On' },
          Brightness: { name: 'Brightness' },
          ColorTemperature: { name: 'ColorTemperature' },
          Hue: { name: 'Hue' },
          Saturation: { name: 'Saturation' },
          Name: { name: 'Name' },
        },
        isReady: jest.fn().mockResolvedValue(true),
        logError: jest.fn(),
      } as unknown as TSVESyncPlatform;

      const lightService = createService(lightCharacteristics);

      const accessory = {
        UUID: 'test-uuid',
        displayName: 'Dining Lights',
        context: {},
        getService: jest.fn().mockImplementation((serviceOrName: any) => {
          if (serviceOrName === platform.Service.AccessoryInformation) {
            return infoService;
          }
          if (serviceOrName === platform.Service.Lightbulb) {
            return lightService;
          }
          if (typeof serviceOrName === 'string') {
            return indicatorServices.get(serviceOrName);
          }
          return undefined;
        }),
        addService: jest.fn().mockImplementation((serviceToken: any, name?: string) => {
          if (serviceToken === platform.Service.Lightbulb && !name) {
            return lightService;
          }

          if (serviceToken === platform.Service.Lightbulb && name) {
            const characteristicMap = new Map<string, any>();
            indicatorCharacteristicMaps.set(name, characteristicMap);
            const service = createService(characteristicMap);
            indicatorServices.set(name, service);
            return service;
          }

          if (serviceToken === platform.Service.AccessoryInformation) {
            return infoService;
          }

          return createService(new Map<string, any>());
        }),
      } as unknown as PlatformAccessory;

      const accessoryInstance = new LightAccessory(platform, accessory, dimmer);

      return {
        dimmer,
        accessory: accessoryInstance,
        lightCharacteristics,
        indicatorCharacteristicMaps,
        platformApi,
      };
    };

    afterEach(() => {
      jest.useRealTimers();
    });

    it('turns a dimmer on by restoring the last brightness level', async () => {
      const { dimmer, lightCharacteristics } = buildDimmerContext({ brightness: 37 });
      const onCharacteristic = lightCharacteristics.get('On');
      expect(onCharacteristic?._onSet).toBeDefined();

      await onCharacteristic._onSet(true);

      expect(dimmer.setBrightness).toHaveBeenCalledWith(37);
    });

    it('remembers brightness when toggled off and on again', async () => {
      const { dimmer, lightCharacteristics } = buildDimmerContext({ brightness: 45 });
      const onCharacteristic = lightCharacteristics.get('On');

      await onCharacteristic._onSet(true);
      await onCharacteristic._onSet(false);
      dimmer.setBrightness.mockClear();

      await onCharacteristic._onSet(true);

      expect(dimmer.setBrightness).toHaveBeenCalledWith(45);
    });

    it('falls back to turnOff when the API rejects zero brightness', async () => {
      const { dimmer, lightCharacteristics } = buildDimmerContext({ brightness: 60, failBrightnessOnZero: true });
      const brightnessCharacteristic = lightCharacteristics.get('Brightness');
      expect(brightnessCharacteristic?._onSet).toBeDefined();

      await brightnessCharacteristic._onSet(0);

      expect(dimmer.setBrightness).toHaveBeenCalledWith(0);
      expect(dimmer.turnOff).toHaveBeenCalled();
    });

    it('powers the indicator ring before applying color changes', async () => {
      jest.useFakeTimers();
      const { dimmer, indicatorCharacteristicMaps } = buildDimmerContext();
      const indicatorServiceName = 'Test Dimmer Indicator';
      const indicatorMap = indicatorCharacteristicMaps.get(indicatorServiceName);
      expect(indicatorMap).toBeDefined();

      const hueCharacteristic = indicatorMap?.get('Hue');
      const saturationCharacteristic = indicatorMap?.get('Saturation');
      expect(hueCharacteristic?._onSet).toBeDefined();
      expect(saturationCharacteristic?._onSet).toBeDefined();

      await hueCharacteristic._onSet(120);
      await saturationCharacteristic._onSet(80);

      jest.runOnlyPendingTimers();
      await flushPromises();

      expect(dimmer.rgbColorOn).toHaveBeenCalled();
      expect(dimmer.rgbColorSet).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
}); 
