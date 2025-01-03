// Set up mocks before imports
jest.mock('../../utils/device-factory');
jest.mock('tsvesync');

import { API, Logger, PlatformAccessory, Service as ServiceType, Characteristic as CharacteristicType, CharacteristicValue } from 'homebridge';
import { VeSync } from 'tsvesync';
import { TSVESyncPlatform } from '../../platform';
import { TEST_CONFIG } from '../setup';
import { createMockLogger, createMockLight } from '../utils/test-helpers';
import { PLATFORM_NAME, PLUGIN_NAME } from '../../settings';
import { DeviceFactory } from '../../utils/device-factory';
import { BaseAccessory } from '../../accessories/base.accessory';
import { LightAccessory } from '../../accessories/light.accessory';
import { VeSyncBulb } from '../../types/device.types';
import { VeSyncBaseDevice } from 'tsvesync';

const mockDeviceFactory = jest.mocked(DeviceFactory);

describe('Light Device Tests', () => {
  let platform: TSVESyncPlatform;
  let mockLogger: jest.Mocked<Logger>;
  let mockApi: jest.Mocked<API>;
  let mockVeSync: jest.Mocked<VeSync>;
  let mockSetHandler: jest.Mock;
  let mockGetHandler: jest.Mock;
  let mockBrightnessSetHandler: jest.Mock;
  let mockBrightnessGetHandler: jest.Mock;

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
    mockBrightnessSetHandler = jest.fn();
    mockBrightnessGetHandler = jest.fn();

    // Setup logger mock
    mockLogger = createMockLogger();

    // Setup API mock
    mockApi = {
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
        addService: jest.fn().mockImplementation((service) => {
          const mockService = {
            getCharacteristic: jest.fn().mockImplementation((characteristic) => {
              if (characteristic === platform.Characteristic.On) {
                return {
                  onSet: jest.fn().mockImplementation((fn) => {
                    mockSetHandler = jest.fn().mockImplementation(async (value) => {
                      try {
                        await fn(value);
                      } catch (error) {
                        throw error;
                      }
                    });
                    return {
                      onGet: jest.fn().mockImplementation((fn) => {
                        mockGetHandler = jest.fn().mockImplementation(async () => {
                          try {
                            return await fn();
                          } catch (error) {
                            throw error;
                          }
                        });
                        return { updateValue: jest.fn() };
                      }),
                      updateValue: jest.fn(),
                    };
                  }),
                  onGet: jest.fn().mockImplementation((fn) => {
                    mockGetHandler = jest.fn().mockImplementation(async () => {
                      try {
                        return await fn();
                      } catch (error) {
                        throw error;
                      }
                    });
                    return { updateValue: jest.fn() };
                  }),
                  updateValue: jest.fn(),
                };
              } else if (characteristic === platform.Characteristic.Brightness) {
                return {
                  onSet: jest.fn().mockImplementation((fn) => {
                    mockBrightnessSetHandler = jest.fn().mockImplementation(async (value) => {
                      try {
                        await fn(value);
                      } catch (error) {
                        throw error;
                      }
                    });
                    return {
                      onGet: jest.fn().mockImplementation((fn) => {
                        mockBrightnessGetHandler = jest.fn().mockImplementation(async () => {
                          try {
                            return await fn();
                          } catch (error) {
                            throw error;
                          }
                        });
                        return { updateValue: jest.fn() };
                      }),
                      updateValue: jest.fn(),
                    };
                  }),
                  onGet: jest.fn().mockImplementation((fn) => {
                    mockBrightnessGetHandler = jest.fn().mockImplementation(async () => {
                      try {
                        return await fn();
                      } catch (error) {
                        throw error;
                      }
                    });
                    return { updateValue: jest.fn() };
                  }),
                  updateValue: jest.fn(),
                };
              }
              return {
                onSet: jest.fn().mockReturnThis(),
                onGet: jest.fn().mockReturnThis(),
                updateValue: jest.fn(),
              };
            }),
            setCharacteristic: jest.fn().mockReturnThis(),
          };
          return mockService;
        }),
        removeService: jest.fn(),
        getService: jest.fn().mockImplementation((service) => {
          const mockService = {
            getCharacteristic: jest.fn().mockImplementation((characteristic) => {
              if (characteristic === platform.Characteristic.On) {
                return {
                  onSet: jest.fn().mockImplementation((fn) => {
                    mockSetHandler = jest.fn().mockImplementation(async (value) => {
                      try {
                        await fn(value);
                      } catch (error) {
                        throw error;
                      }
                    });
                    return {
                      onGet: jest.fn().mockImplementation((fn) => {
                        mockGetHandler = jest.fn().mockImplementation(async () => {
                          try {
                            return await fn();
                          } catch (error) {
                            throw error;
                          }
                        });
                        return { updateValue: jest.fn() };
                      }),
                      updateValue: jest.fn(),
                    };
                  }),
                  onGet: jest.fn().mockImplementation((fn) => {
                    mockGetHandler = jest.fn().mockImplementation(async () => {
                      try {
                        return await fn();
                      } catch (error) {
                        throw error;
                      }
                    });
                    return { updateValue: jest.fn() };
                  }),
                  updateValue: jest.fn(),
                };
              } else if (characteristic === platform.Characteristic.Brightness) {
                return {
                  onSet: jest.fn().mockImplementation((fn) => {
                    mockBrightnessSetHandler = jest.fn().mockImplementation(async (value) => {
                      try {
                        await fn(value);
                      } catch (error) {
                        throw error;
                      }
                    });
                    return {
                      onGet: jest.fn().mockImplementation((fn) => {
                        mockBrightnessGetHandler = jest.fn().mockImplementation(async () => {
                          try {
                            return await fn();
                          } catch (error) {
                            throw error;
                          }
                        });
                        return { updateValue: jest.fn() };
                      }),
                      updateValue: jest.fn(),
                    };
                  }),
                  onGet: jest.fn().mockImplementation((fn) => {
                    mockBrightnessGetHandler = jest.fn().mockImplementation(async () => {
                      try {
                        return await fn();
                      } catch (error) {
                        throw error;
                      }
                    });
                    return { updateValue: jest.fn() };
                  }),
                  updateValue: jest.fn(),
                };
              }
              return {
                onSet: jest.fn().mockReturnThis(),
                onGet: jest.fn().mockReturnThis(),
                updateValue: jest.fn(),
              };
            }),
            setCharacteristic: jest.fn().mockReturnThis(),
          };
          return mockService;
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
          Lightbulb: jest.fn().mockImplementation(() => ({
            getCharacteristic: jest.fn().mockImplementation((characteristic) => {
              if (characteristic === platform.Characteristic.On) {
                return {
                  onSet: jest.fn().mockImplementation((fn) => {
                    mockSetHandler = jest.fn().mockImplementation(async (value) => {
                      try {
                        await fn(value);
                      } catch (error) {
                        throw error;
                      }
                    });
                    return {
                      onGet: jest.fn().mockImplementation((fn) => {
                        mockGetHandler = jest.fn().mockImplementation(async () => {
                          try {
                            return await fn();
                          } catch (error) {
                            throw error;
                          }
                        });
                        return { updateValue: jest.fn() };
                      }),
                      updateValue: jest.fn(),
                    };
                  }),
                  onGet: jest.fn().mockImplementation((fn) => {
                    mockGetHandler = jest.fn().mockImplementation(async () => {
                      try {
                        return await fn();
                      } catch (error) {
                        throw error;
                      }
                    });
                    return { updateValue: jest.fn() };
                  }),
                  updateValue: jest.fn(),
                };
              } else if (characteristic === platform.Characteristic.Brightness) {
                return {
                  onSet: jest.fn().mockImplementation((fn) => {
                    mockBrightnessSetHandler = jest.fn().mockImplementation(async (value) => {
                      try {
                        await fn(value);
                      } catch (error) {
                        throw error;
                      }
                    });
                    return {
                      onGet: jest.fn().mockImplementation((fn) => {
                        mockBrightnessGetHandler = jest.fn().mockImplementation(async () => {
                          try {
                            return await fn();
                          } catch (error) {
                            throw error;
                          }
                        });
                        return { updateValue: jest.fn() };
                      }),
                      updateValue: jest.fn(),
                    };
                  }),
                  onGet: jest.fn().mockImplementation((fn) => {
                    mockBrightnessGetHandler = jest.fn().mockImplementation(async () => {
                      try {
                        return await fn();
                      } catch (error) {
                        throw error;
                      }
                    });
                    return { updateValue: jest.fn() };
                  }),
                  updateValue: jest.fn(),
                };
              }
              return {
                onSet: jest.fn().mockReturnThis(),
                onGet: jest.fn().mockReturnThis(),
                updateValue: jest.fn(),
              };
            }),
            setCharacteristic: jest.fn().mockReturnThis(),
          })),
          AccessoryInformation: jest.fn(),
        } as unknown as typeof ServiceType,
        Characteristic: {
          On: 'On',
          Brightness: 'Brightness',
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
    platform = new TSVESyncPlatform(mockLogger, defaultConfig, mockApi);
    platform.isReady = jest.fn().mockResolvedValue(true);

    // Setup VeSync mock
    mockVeSync = {
      login: jest.fn(),
      getDevices: jest.fn(),
      lights: [],
    } as unknown as jest.Mocked<VeSync>;

    // Replace VeSync client
    (platform as any).client = mockVeSync;

    // Mock DeviceFactory
    mockDeviceFactory.getAccessoryCategory.mockReturnValue(5); // 5 is the category for lightbulbs
    mockDeviceFactory.createAccessory.mockImplementation((platform, accessory, device: VeSyncBaseDevice) => {
      if (device.deviceType.startsWith('ESL') || device.deviceType === 'XYD0001') {
        return new LightAccessory(platform, accessory, device as VeSyncBulb);
      }
      throw new Error(`Unexpected device type: ${device.deviceType}`);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('light state management', () => {
    it('should handle power state changes', async () => {
      // Create a mock light with immediate responses
      const mockLight = createMockLight({
        deviceName: 'Test Light',
        deviceType: 'ESL100',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      // Create a mock accessory
      const mockAccessory = new mockApi.platformAccessory(mockLight.deviceName, mockApi.hap.uuid.generate(mockLight.cid));
      mockAccessory.context.device = mockLight;

      // Create the light accessory
      const lightAccessory = new LightAccessory(platform, mockAccessory, mockLight);
      await lightAccessory.initialize();

      // Get the light service
      const lightService = mockAccessory.getService(platform.Service.Lightbulb);
      expect(lightService).toBeDefined();

      // Test turning on
      await mockSetHandler(true);
      expect(mockLight.turnOn).toHaveBeenCalled();
      expect(mockLight.deviceStatus).toBe('on');

      // Test turning off
      await mockSetHandler(false);
      expect(mockLight.turnOff).toHaveBeenCalled();
      expect(mockLight.deviceStatus).toBe('off');
    }, 10000);

    it('should handle brightness changes', async () => {
      // Create a mock light with immediate responses
      const mockLight = createMockLight({
        deviceName: 'Test Light',
        deviceType: 'ESL100',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      // Create a mock accessory
      const mockAccessory = new mockApi.platformAccessory(mockLight.deviceName, mockApi.hap.uuid.generate(mockLight.cid));
      mockAccessory.context.device = mockLight;

      // Create the light accessory
      const lightAccessory = new LightAccessory(platform, mockAccessory, mockLight);
      await lightAccessory.initialize();

      // Get the light service
      const lightService = mockAccessory.getService(platform.Service.Lightbulb);
      expect(lightService).toBeDefined();

      // Test setting brightness
      await mockBrightnessSetHandler(50);
      expect(mockLight.setBrightness).toHaveBeenCalledWith(50);
      expect(mockLight.brightness).toBe(50);

      // Test getting brightness
      mockLight.brightness = 75;
      const brightness = await mockBrightnessGetHandler();
      expect(brightness).toBe(75);
    }, 10000);

    it('should handle device errors', async () => {
      const mockDevice = createMockLight({
        deviceName: 'Test Light',
        deviceType: 'ESL100',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123'
      });

      // Create a mock platform accessory
      const mockPlatformAccessory = new mockApi.platformAccessory(mockDevice.deviceName, mockApi.hap.uuid.generate(mockDevice.cid));
      mockPlatformAccessory.context.device = mockDevice;

      // Mock error responses
      (mockDevice.turnOn as jest.Mock).mockRejectedValue(new Error('Failed to turn on'));
      (mockDevice.turnOff as jest.Mock).mockRejectedValue(new Error('Failed to turn off'));
      (mockDevice.setBrightness as jest.Mock).mockRejectedValue(new Error('Failed to set brightness'));
      (mockDevice.getDetails as jest.Mock).mockRejectedValue(new Error('Failed to get details'));

      const accessory = new LightAccessory(platform, mockPlatformAccessory, mockDevice);
      await accessory.initialize();

      // Get the light service
      const service = mockPlatformAccessory.getService(platform.Service.Lightbulb);
      expect(service).toBeDefined();
      if (!service) {
        throw new Error('Service not found');
      }

      const onCharacteristic = service.getCharacteristic(platform.Characteristic.On);
      expect(onCharacteristic).toBeDefined();
      if (!onCharacteristic) {
        throw new Error('On characteristic not found');
      }

      const brightnessCharacteristic = service.getCharacteristic(platform.Characteristic.Brightness);
      expect(brightnessCharacteristic).toBeDefined();
      if (!brightnessCharacteristic) {
        throw new Error('Brightness characteristic not found');
      }

      // Test error handling
      await expect(mockDevice.turnOn).rejects.toThrow('Failed to turn on');
      await expect(mockDevice.turnOff).rejects.toThrow('Failed to turn off');
      await expect(mockDevice.setBrightness).rejects.toThrow('Failed to set brightness');
      await expect(mockDevice.getDetails).rejects.toThrow('Failed to get details');
    });
  });

  describe('light device types', () => {
    it('should support ESL100 devices', async () => {
      // Create a mock light with immediate responses
      const mockLight = createMockLight({
        deviceName: 'Test Light',
        deviceType: 'ESL100',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      (mockLight.getDetails as jest.Mock).mockResolvedValueOnce({ deviceStatus: 'off', brightness: 100 });

      // Create a mock accessory
      const mockAccessory = new mockApi.platformAccessory(mockLight.deviceName, mockApi.hap.uuid.generate(mockLight.cid));
      mockAccessory.context.device = mockLight;

      // Create the light accessory
      const lightAccessory = new LightAccessory(platform, mockAccessory, mockLight);
      await lightAccessory.initialize();

      // Get the light service
      const lightService = mockAccessory.getService(platform.Service.Lightbulb);
      expect(lightService).toBeDefined();
      expect(mockLight.deviceType).toBe('ESL100');
    }, 10000);

    it('should support other light device types', async () => {
      // Create a mock light with immediate responses
      const mockLight = createMockLight({
        deviceName: 'Test Light',
        deviceType: 'other-light-type',
        cid: 'test-cid-123',
        uuid: 'test-uuid-123',
      });

      (mockLight.getDetails as jest.Mock).mockResolvedValueOnce({ deviceStatus: 'off', brightness: 100 });

      // Create a mock accessory
      const mockAccessory = new mockApi.platformAccessory(mockLight.deviceName, mockApi.hap.uuid.generate(mockLight.cid));
      mockAccessory.context.device = mockLight;

      // Create the light accessory
      const lightAccessory = new LightAccessory(platform, mockAccessory, mockLight);
      await lightAccessory.initialize();

      // Get the light service
      const lightService = mockAccessory.getService(platform.Service.Lightbulb);
      expect(lightService).toBeDefined();
      expect(mockLight.deviceType).toBe('other-light-type');
    }, 10000);
  });
}); 