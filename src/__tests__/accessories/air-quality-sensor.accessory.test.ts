import { API, Logger } from 'homebridge';
import { TSVESyncPlatform } from '../../platform';
import { VeSync } from 'tsvesync';
import { AirQualitySensorAccessory } from '../../accessories/air-quality-sensor.accessory';
import { createMockLogger, createMockVeSync } from '../utils/test-helpers';

interface MockAirQualityDevice {
  deviceName: string;
  deviceType: string;
  cid: string;
  uuid: string;
  deviceStatus: string;
  airQualityValue: number;
  details: Record<string, any>;
  getDetails: jest.Mock;
  getNormalizedAirQuality?: jest.Mock;
  airQualityLevel?: number;
  airQualityLabel?: string;
}

describe('AirQualitySensorAccessory', () => {
  let mockAPI: jest.Mocked<API>;
  let platform: TSVESyncPlatform;
  let logger: jest.Mocked<Logger>;
  let api: jest.Mocked<VeSync>;

  const AirQualityEnum = {
    UNKNOWN: 0,
    EXCELLENT: 1,
    GOOD: 2,
    FAIR: 3,
    INFERIOR: 4,
    POOR: 5,
  } as const;

  const ServiceEnum = {
    AirQualitySensor: 'AirQualitySensor',
    AccessoryInformation: 'AccessoryInformation',
  } as const;

  const createDevice = (overrides: Partial<MockAirQualityDevice> = {}): MockAirQualityDevice => ({
    deviceName: overrides.deviceName || 'Dining Room AQ',
    deviceType: overrides.deviceType || 'Core300S',
    cid: overrides.cid || 'cid-123',
    uuid: overrides.uuid || 'uuid-123',
    deviceStatus: overrides.deviceStatus || 'on',
    airQualityValue: overrides.airQualityValue ?? 18,
    details: overrides.details || {
      air_quality_value: overrides.airQualityValue ?? 18,
      air_quality_level: overrides.airQualityLevel,
      air_quality: overrides.airQualityLabel ?? 'good',
      pm10: 22,
    },
    getDetails: overrides.getDetails || jest.fn().mockResolvedValue(true),
    getNormalizedAirQuality: overrides.getNormalizedAirQuality,
    airQualityLevel: overrides.airQualityLevel,
    airQualityLabel: overrides.airQualityLabel,
  });

  const buildAccessory = (device: MockAirQualityDevice) => {
    const airQualityService = {
      getCharacteristic: jest.fn().mockImplementation((characteristic) => {
        if (characteristic === AirQualityEnum) {
          return {
            setProps: jest.fn().mockReturnThis(),
            onGet: jest.fn().mockReturnThis(),
            updateValue: jest.fn().mockReturnThis(),
          };
        }
        return {
          onGet: jest.fn().mockReturnThis(),
          updateValue: jest.fn().mockReturnThis(),
          setProps: jest.fn().mockReturnThis(),
        };
      }),
      setCharacteristic: jest.fn().mockReturnThis(),
      updateCharacteristic: jest.fn().mockReturnThis(),
    } as any;

    const infoService = {
      setCharacteristic: jest.fn().mockReturnThis(),
    } as any;

    const accessory = {
      getService: jest.fn((service) => {
        if (service === ServiceEnum.AccessoryInformation) return infoService;
        if (service === ServiceEnum.AirQualitySensor) return null;
        return null;
      }),
      addService: jest.fn((service) => {
        if (service === ServiceEnum.AirQualitySensor) {
          return airQualityService;
        }
        return airQualityService;
      }),
    } as any;

    const accessoryInstance = new AirQualitySensorAccessory(platform, accessory, device as any);

    return {
      accessoryInstance,
      airQualityService,
      infoService,
      accessory,
    };
  };

  beforeEach(() => {
    logger = createMockLogger();
    api = createMockVeSync();

    mockAPI = {
      hap: {
        Characteristic: {
          AirQuality: AirQualityEnum,
          PM2_5Density: 'PM2_5Density',
          PM10Density: 'PM10Density',
          Manufacturer: 'Manufacturer',
          Model: 'Model',
          SerialNumber: 'SerialNumber',
          Name: 'Name',
        },
        Service: ServiceEnum,
        uuid: {
          generate: jest.fn(),
        },
      },
      platformAccessory: jest.fn(),
    } as unknown as jest.Mocked<API>;

    platform = new TSVESyncPlatform(logger, { debug: false, retry: { maxRetries: 3 } } as any, mockAPI);
    (platform as any).api = api;
  });

  it('configures AirQuality characteristic to expose VeSync levels', () => {
    const device = createDevice({
      getNormalizedAirQuality: jest.fn().mockReturnValue({ level: 2, label: 'good' }),
      airQualityLevel: 2,
      airQualityLabel: 'good',
    });

    const { airQualityService } = buildAccessory(device);

    expect(airQualityService.getCharacteristic).toHaveBeenCalledWith(AirQualityEnum);
    const setter = airQualityService.getCharacteristic.mock.results[0].value.setProps;
    expect(setter).toHaveBeenCalledWith({
      validValues: [
        AirQualityEnum.UNKNOWN,
        AirQualityEnum.EXCELLENT,
        AirQualityEnum.GOOD,
        AirQualityEnum.FAIR,
        AirQualityEnum.INFERIOR,
      ],
    });
  });

  it('returns normalized air quality levels when provided by the device', async () => {
    const device = createDevice({
      getNormalizedAirQuality: jest.fn().mockReturnValue({ level: 3, label: 'moderate' }),
      airQualityValue: 42,
    });

    const { accessoryInstance } = buildAccessory(device);

    const value = await (accessoryInstance as any).getAirQuality();
    expect(value).toBe(AirQualityEnum.FAIR);
    expect(device.getNormalizedAirQuality).toHaveBeenCalled();
  });

  it('falls back to direct level properties when normalized metadata is unavailable', async () => {
    const device = createDevice({
      getNormalizedAirQuality: undefined,
      airQualityLevel: 4,
      details: {
        air_quality_level: 4,
        air_quality_value: 80,
      },
      airQualityValue: 80,
    });

    const { accessoryInstance } = buildAccessory(device);

    const value = await (accessoryInstance as any).getAirQuality();
    expect(value).toBe(AirQualityEnum.INFERIOR);
  });

  it('falls back to PM2.5 heuristic when no level information is available', async () => {
    const device = createDevice({
      getNormalizedAirQuality: undefined,
      airQualityLevel: undefined,
      details: {
        air_quality_value: 120,
      },
      airQualityValue: 120,
    });

    const { accessoryInstance } = buildAccessory(device);

    const value = await (accessoryInstance as any).getAirQuality();
    expect(value).toBe(AirQualityEnum.INFERIOR);
  });

  it('clamps PM2.5 density to HomeKit-supported range', async () => {
    const device = createDevice({
      airQualityValue: 1450,
      details: {
        air_quality_value: 1450,
      },
    });

    const { accessoryInstance } = buildAccessory(device);

    const density = await (accessoryInstance as any).getPM25Density();
    expect(density).toBe(1000);
  });

  it('updates characteristics during refresh cycle', async () => {
    const device = createDevice({
      airQualityValue: 24,
      getNormalizedAirQuality: jest.fn().mockReturnValue({ level: 2, label: 'good' }),
    });

    const { accessoryInstance, airQualityService } = buildAccessory(device);

    await (accessoryInstance as any).updateCharacteristics();

    expect(device.getDetails).toHaveBeenCalled();
    expect(airQualityService.updateCharacteristic).toHaveBeenCalledWith(AirQualityEnum, AirQualityEnum.GOOD);
    expect(airQualityService.updateCharacteristic).toHaveBeenCalledWith('PM2_5Density', 24);
  });
});
