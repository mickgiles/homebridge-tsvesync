jest.mock('../utils/device-factory');

import { API, CharacteristicValue, Logger, Service as ServiceType, Characteristic as CharacteristicType } from 'homebridge';
import { VeSync } from 'tsvesync';
import { TSVESyncPlatform } from '../platform';
import { AirPurifierAccessory } from '../accessories/air-purifier.accessory';
import { DeviceFactory } from '../utils/device-factory';
import { BaseAccessory } from '../accessories/base.accessory';
import {
  createMockInfoService,
  createMockLogger,
  createMockService,
  createMockVeSync,
} from './utils/test-helpers';

const mockDeviceFactory = jest.mocked(DeviceFactory);

/**
 * Regression tests for issue #46: VeSync factory names like "OasisMist™ 4.5L"
 * violate HomeKit's Name charset and trigger HAP warnings (and can block
 * pairing). Every HomeKit-facing name must be sanitized; raw names stay in
 * logs and API calls.
 */
describe('HomeKit name sanitization (issue #46)', () => {
  describe('platform accessory creation', () => {
    let platform: TSVESyncPlatform;
    let mockAPI: jest.Mocked<API>;
    let mockVeSync: jest.Mocked<VeSync>;

    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: true });

      mockVeSync = createMockVeSync();
      mockAPI = {
        version: 2.0,
        serverVersion: '1.0.0',
        user: {
          configPath: jest.fn(),
          storagePath: jest.fn().mockReturnValue('/tmp'),
          persistPath: jest.fn(),
        },
        hapLegacyTypes: {},
        platformAccessory: jest.fn().mockImplementation((name, uuid, category) => ({
          UUID: uuid,
          displayName: name,
          category,
          context: {},
          addService: jest.fn(),
          removeService: jest.fn(),
          getService: jest.fn(),
          getServiceById: jest.fn(),
        })),
        versionGreaterOrEqual: jest.fn(),
        registerPlatformAccessories: jest.fn(),
        unregisterPlatformAccessories: jest.fn(),
        updatePlatformAccessories: jest.fn(),
        on: jest.fn(),
        hap: {
          Service: {
            AccessoryInformation: jest.fn(),
          } as unknown as typeof ServiceType,
          Characteristic: {
            Name: 'Name',
            Manufacturer: 'Manufacturer',
            Model: 'Model',
            SerialNumber: 'SerialNumber',
          } as unknown as typeof CharacteristicType,
          Categories: {
            SENSOR: 10,
          },
          uuid: {
            generate: jest.fn().mockImplementation((id) => `test-uuid-${id}`),
          },
        },
      } as unknown as jest.Mocked<API>;

      platform = new TSVESyncPlatform(
        createMockLogger() as jest.Mocked<Logger>,
        { name: 'Test Platform', username: 'u', password: 'p', platform: 'TSVESyncPlatform' } as any,
        mockAPI
      );
      (platform as any).client = mockVeSync;

      const stubAccessory = {
        initialize: jest.fn().mockResolvedValue(undefined),
        syncDeviceState: jest.fn().mockResolvedValue(undefined),
        applyUpdatedDeviceState: jest.fn(),
      } as unknown as BaseAccessory;

      mockDeviceFactory.getAccessoryCategory.mockReturnValue(0 as any);
      mockDeviceFactory.isAirPurifier.mockImplementation((deviceType: string) => deviceType.toUpperCase().includes('CORE'));
      mockDeviceFactory.createAccessory.mockReturnValue(stubAccessory);
      mockDeviceFactory.createAQSensorAccessory.mockReturnValue(stubAccessory);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function mockDevice(overrides: Record<string, unknown> = {}) {
      return {
        deviceName: 'OasisMist™ 4.5L',
        deviceType: 'LUH-M101S-WUS',
        cid: 'cid-oasis',
        uuid: 'uuid-oasis',
        deviceStatus: 'on',
        deviceRegion: 'US',
        configModule: 'VeSyncHumid',
        macId: '00:11:22:33:44:55',
        deviceCategory: 'fan',
        connectionStatus: 'online',
        details: {},
        config: {},
        ...overrides,
      };
    }

    it('creates new accessories with a sanitized display name', async () => {
      mockVeSync.fans = [mockDevice() as any];

      await platform.discoverDevices();

      expect(mockAPI.platformAccessory).toHaveBeenCalledWith(
        'OasisMist 4.5L',
        expect.any(String),
        expect.anything()
      );
    });

    it('creates AQ sensor accessories with a sanitized display name', async () => {
      mockVeSync.fans = [mockDevice({
        deviceName: 'Core 400S™',
        deviceType: 'Core400S',
        cid: 'cid-core',
        uuid: 'uuid-core',
        hasFeature: (feature: string) => feature === 'air_quality',
      }) as any];

      await platform.discoverDevices();

      expect(mockAPI.platformAccessory).toHaveBeenCalledWith(
        'Core 400S Air Quality',
        expect.any(String),
        10
      );
    });

    it('repairs an invalid cached accessory name on restore', () => {
      const infoService = { updateCharacteristic: jest.fn() };
      const cached: any = {
        UUID: 'cached-uuid',
        displayName: 'OasisMist™ 4.5L',
        context: {},
        getService: jest.fn().mockReturnValue(infoService),
      };

      platform.configureAccessory(cached);

      expect(cached.displayName).toBe('OasisMist 4.5L');
      expect(infoService.updateCharacteristic).toHaveBeenCalledWith('Name', 'OasisMist 4.5L');
      expect(mockAPI.updatePlatformAccessories).toHaveBeenCalledWith([cached]);
    });

    it('leaves valid cached accessory names untouched', () => {
      const cached: any = {
        UUID: 'cached-uuid',
        displayName: 'Bedroom Air Purifier',
        context: {},
        getService: jest.fn(),
      };

      platform.configureAccessory(cached);

      expect(cached.displayName).toBe('Bedroom Air Purifier');
      expect(cached.getService).not.toHaveBeenCalled();
      expect(mockAPI.updatePlatformAccessories).not.toHaveBeenCalled();
    });
  });

  describe('accessory Name characteristic', () => {
    interface Handlers {
      get?: () => Promise<CharacteristicValue>;
      set?: (value: CharacteristicValue) => Promise<void>;
    }

    it('serves the sanitized name through the Name characteristic', async () => {
      const logger = createMockLogger();
      const mockAPI = {
        hap: {
          Characteristic: {
            Active: 'Active',
            CurrentAirPurifierState: 'CurrentAirPurifierState',
            FilterChangeIndication: 'FilterChangeIndication',
            FilterLifeLevel: 'FilterLifeLevel',
            Manufacturer: 'Manufacturer',
            Model: 'Model',
            Name: 'Name',
            On: 'On',
            RotationSpeed: 'RotationSpeed',
            SerialNumber: 'SerialNumber',
            TargetAirPurifierState: 'TargetAirPurifierState',
          },
          Service: {
            AccessoryInformation: 'AccessoryInformation',
            AirPurifier: 'AirPurifier',
            AirQualitySensor: 'AirQualitySensor',
            FilterMaintenance: 'FilterMaintenance',
            Switch: 'Switch',
          },
          uuid: { generate: jest.fn() },
        },
        platformAccessory: jest.fn(),
        updatePlatformAccessories: jest.fn(),
      } as unknown as jest.Mocked<API>;
      const platform = new TSVESyncPlatform(logger as jest.Mocked<Logger>, {} as any, mockAPI);
      (platform as any).api = mockAPI;
      (platform as any).client = createMockVeSync() as jest.Mocked<VeSync>;

      const handlers: Record<string, Handlers> = {};
      const chars = new Map<string, any>();
      const getChar = (name: string) => {
        if (!chars.has(name)) {
          const stub: any = {
            onSet: (fn: Handlers['set']) => { handlers[name] = { ...handlers[name], set: fn }; return stub; },
            onGet: (fn: Handlers['get']) => { handlers[name] = { ...handlers[name], get: fn }; return stub; },
            updateValue: () => stub,
            setProps: () => stub,
          };
          chars.set(name, stub);
        }
        return chars.get(name);
      };
      const primaryService = {
        ...createMockService(),
        getCharacteristic: jest.fn((c: any) => getChar(String(c))),
        updateCharacteristic: jest.fn().mockReturnThis(),
      };
      const infoService = createMockInfoService();
      const accessory = {
        context: {},
        getService: jest.fn((service: any) => {
          if (service === 'AccessoryInformation') return infoService;
          if (service === 'AirPurifier') return primaryService;
          return undefined;
        }),
        addService: jest.fn(() => primaryService),
        removeService: jest.fn(),
      };

      const device: any = {
        changeFanSpeed: jest.fn().mockResolvedValue(true),
        connectionStatus: 'online',
        details: { enabled: true, filter_life: 80, mode: 'manual', speed: 2 },
        deviceName: 'Levoit™ Purifier®',
        deviceStatus: 'on',
        deviceType: 'Core300S',
        enabled: true,
        filterLife: 80,
        getDetails: jest.fn().mockResolvedValue(true),
        getMaxFanSpeed: jest.fn().mockReturnValue(3),
        hasFeature: jest.fn().mockReturnValue(false),
        maxSpeed: 3,
        mode: 'manual',
        setMode: jest.fn().mockResolvedValue(true),
        speed: 2,
        turnOff: jest.fn().mockResolvedValue(true),
        turnOn: jest.fn().mockResolvedValue(true),
        uuid: 'purifier-uuid',
      };

      new AirPurifierAccessory(platform, accessory as any, device);

      expect(handlers.Name?.get).toBeDefined();
      expect(await handlers.Name.get!()).toBe('Levoit Purifier');
      // The device object itself must keep the raw name for API calls
      expect(device.deviceName).toBe('Levoit™ Purifier®');
    });
  });
});
