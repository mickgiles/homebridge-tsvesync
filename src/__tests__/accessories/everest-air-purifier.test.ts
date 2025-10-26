import { API, Logger } from 'homebridge';
import { AirPurifierAccessory } from '../../accessories/air-purifier.accessory';
import { TSVESyncPlatform } from '../../platform';
import { createMockLogger, createMockVeSync } from '../utils/test-helpers';

describe('Everest Air purifier mode handling', () => {
  let platform: TSVESyncPlatform;
  let logger: jest.Mocked<Logger>;
  let api: ReturnType<typeof createMockVeSync>;
  let mockAccessory: any;
  let service: any;
  let airQualityService: any;
  let filterService: any;
  let accessoryInfoService: any;
  let mockDevice: any;
  let accessory: AirPurifierAccessory;

  beforeEach(() => {
    logger = createMockLogger();
    api = createMockVeSync();

    const Characteristic = {
      RotationSpeed: 'RotationSpeed',
      TargetAirPurifierState: 'TargetAirPurifierState',
      CurrentAirPurifierState: 'CurrentAirPurifierState',
      Active: 'Active',
      FilterChangeIndication: 'FilterChangeIndication',
      FilterLifeLevel: 'FilterLifeLevel',
      AirQuality: 'AirQuality',
      PM2_5Density: 'PM2_5Density',
      Name: 'Name',
    } as any;

    const Service = {
      AirPurifier: 'AirPurifier',
      AirQualitySensor: 'AirQualitySensor',
      FilterMaintenance: 'FilterMaintenance',
      AccessoryInformation: 'AccessoryInformation',
    } as any;

    const mockAPI = {
      hap: {
        Service,
        Characteristic,
        uuid: {
          generate: jest.fn(),
        },
      },
      platformAccessory: jest.fn(),
    } as unknown as jest.Mocked<API>;

    platform = new TSVESyncPlatform(logger, {} as any, mockAPI);
    (platform as any).api = api;

    const characteristicStub = {
      onSet: jest.fn().mockReturnThis(),
      onGet: jest.fn().mockReturnThis(),
      updateValue: jest.fn().mockReturnThis(),
      setProps: jest.fn().mockReturnThis(),
    };

    const createService = () => ({
      getCharacteristic: jest.fn().mockReturnValue(characteristicStub),
      setCharacteristic: jest.fn().mockReturnThis(),
      updateCharacteristic: jest.fn().mockReturnThis(),
      addCharacteristic: jest.fn().mockReturnValue(characteristicStub),
      removeCharacteristic: jest.fn(),
      testCharacteristic: jest.fn().mockReturnValue(false),
    });

    service = createService();
    airQualityService = createService();
    filterService = createService();
    accessoryInfoService = {
      setCharacteristic: jest.fn().mockReturnThis(),
    };

    mockAccessory = {
      getService: jest.fn((svc: any) => {
        if (svc === platform.Service.AirPurifier) return service;
        if (svc === platform.Service.AirQualitySensor) return null;
        if (svc === platform.Service.FilterMaintenance) return null;
        if (svc === platform.Service.AccessoryInformation) return accessoryInfoService;
        return null;
      }),
      addService: jest.fn((svc: any) => {
        if (svc === platform.Service.AirPurifier) return service;
        if (svc === platform.Service.AirQualitySensor) return airQualityService;
        if (svc === platform.Service.FilterMaintenance) return filterService;
        return service;
      }),
      removeService: jest.fn(),
    };

    mockDevice = {
      deviceName: 'Everest Test',
      deviceType: 'LAP-EL551S-AUS',
      cid: 'cid',
      uuid: 'uuid',
      deviceStatus: 'on',
      speed: 2,
      mode: 'manual',
      airQualityValue: 12,
      filterLife: 90,
      details: {
        mode: 'manual',
        speed: 2,
        manualSpeedLevel: 2,
        air_quality_value: 12,
        air_quality: 3,
        filter_life: 90,
      },
      hasFeature: jest.fn((feature: string) => [
        'sleep_mode',
        'turbo_mode',
        'fan_speed',
        'auto_mode',
        'air_quality',
        'filter_life',
      ].includes(feature)),
      getSupportedModes: jest.fn().mockReturnValue(['sleep', 'manual', 'auto', 'turbo']),
      getSupportedAutoPreferences: jest.fn().mockReturnValue(['default', 'efficient', 'quiet']),
      getMaxFanSpeed: jest.fn().mockReturnValue(3),
      getDetails: jest.fn().mockResolvedValue(true),
      turnOn: jest.fn().mockResolvedValue(true),
      turnOff: jest.fn().mockResolvedValue(true),
      changeFanSpeed: jest.fn().mockImplementation(async (value: number) => {
        mockDevice.speed = value;
        mockDevice.mode = 'manual';
        mockDevice.details.speed = value;
        mockDevice.details.manualSpeedLevel = value;
        return true;
      }),
      sleepMode: jest.fn().mockImplementation(async () => {
        mockDevice.mode = 'sleep';
        mockDevice.speed = 0;
        mockDevice.details.mode = 'sleep';
        mockDevice.details.speed = 0;
        return true;
      }),
      turboMode: jest.fn().mockImplementation(async () => {
        mockDevice.mode = 'turbo';
        mockDevice.speed = 3;
        mockDevice.details.mode = 'turbo';
        mockDevice.details.speed = 3;
        return true;
      }),
      manualMode: jest.fn().mockImplementation(async () => {
        mockDevice.mode = 'manual';
        mockDevice.details.mode = 'manual';
        return true;
      }),
      autoMode: jest.fn().mockResolvedValue(true),
      setMode: jest.fn().mockImplementation(async (mode: string) => {
        mockDevice.mode = mode;
        mockDevice.details.mode = mode;
        return true;
      }),
      getNormalizedAirQuality: jest.fn().mockReturnValue({ level: 2, label: 'good' }),
    };

    accessory = new AirPurifierAccessory(platform, mockAccessory, mockDevice);
    service.updateCharacteristic.mockClear();
    mockDevice.sleepMode.mockClear();
    mockDevice.turboMode.mockClear();
    mockDevice.changeFanSpeed.mockClear();
  });

  it('maps first notch to sleep mode for Everest', async () => {
    await (accessory as any).setRotationSpeed(20);
    expect(mockDevice.sleepMode).toHaveBeenCalledTimes(1);
    expect(service.updateCharacteristic).toHaveBeenCalledWith(
      platform.Characteristic.RotationSpeed,
      20,
    );
  });

  it('maps highest notch to turbo mode when supported', async () => {
    await (accessory as any).setRotationSpeed(100);
    expect(mockDevice.turboMode).toHaveBeenCalledTimes(1);
    expect(service.updateCharacteristic.mock.calls).toContainEqual([
      platform.Characteristic.RotationSpeed,
      100,
    ]);
  });

  it('maps manual notches to discrete fan speeds', async () => {
    await (accessory as any).setRotationSpeed(80); // Manual level 3
    expect(mockDevice.changeFanSpeed).toHaveBeenCalledWith(3);

    service.updateCharacteristic.mockClear();
    mockDevice.changeFanSpeed.mockClear();

    await (accessory as any).setRotationSpeed(60); // Manual level 2
    expect(mockDevice.changeFanSpeed).toHaveBeenCalledWith(2);
  });

  it('reports turbo rotation speed as 100%', async () => {
    mockDevice.mode = 'turbo';
    mockDevice.speed = 3;
    const rotation = await (accessory as any).getRotationSpeed();
    expect(rotation).toBe(100);
  });

  it('keeps rotation speed at 100% after turbo state updates', async () => {
    mockDevice.mode = 'turbo';
    mockDevice.speed = 0;
    mockDevice.details.mode = 'turbo';
    mockDevice.details.speed = 0;
    await (accessory as any).updateDeviceSpecificStates({
      mode: 'turbo',
      speed: 0,
      enabled: true,
      deviceStatus: 'on',
    });
    expect(service.updateCharacteristic).toHaveBeenCalledWith(
      platform.Characteristic.RotationSpeed,
      100,
    );
  });

  it('treats auto sentinel speed as 0% and sets target to auto', async () => {
    service.updateCharacteristic.mockClear();
    mockDevice.mode = 'auto';
    mockDevice.speed = 0;
    mockDevice.details.mode = 'auto';
    mockDevice.details.speed = 0;

    await (accessory as any).updateDeviceSpecificStates({
      mode: 'auto',
      speed: 0,
      enabled: true,
      deviceStatus: 'on',
    });

    expect(service.updateCharacteristic.mock.calls).toContainEqual([
      platform.Characteristic.TargetAirPurifierState,
      1,
    ]);
    expect(service.updateCharacteristic.mock.calls).toContainEqual([
      platform.Characteristic.RotationSpeed,
      0,
    ]);
  });

  it('logs an error when turbo mode fails and leaves rotation speed unchanged', async () => {
    service.updateCharacteristic.mockClear();
    logger.error.mockClear();
    mockDevice.turboMode.mockResolvedValue(false);

    await (accessory as any).setRotationSpeed(100);

    expect(mockDevice.turboMode).toHaveBeenCalledTimes(1);
    expect(service.updateCharacteristic.mock.calls).not.toContainEqual([
      platform.Characteristic.RotationSpeed,
      100,
    ]);
    expect(logger.error).toHaveBeenCalled();
  });
});
