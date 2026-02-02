/**
 * Integration-ish tests for AirPurifierAccessory service wiring.
 *
 * NOTE: Air quality is now exposed via a separate accessory (AirQualitySensorAccessory).
 * These tests focus on the AirPurifierAccessory's primary service setup and migration
 * away from legacy embedded services.
 */

import { API, Logger } from 'homebridge';
import { TSVESyncPlatform } from '../../platform';
import { AirPurifierAccessory } from '../../accessories/air-purifier.accessory';
import { createMockLogger, createMockVeSync, createMockService } from '../utils/test-helpers';
import { VeSync } from 'tsvesync';

describe('AirPurifierAccessory Integration Tests', () => {
  let mockAPI: jest.Mocked<API>;
  let platform: TSVESyncPlatform;
  let logger: jest.Mocked<Logger>;
  let api: jest.Mocked<VeSync>;

  beforeEach(() => {
    logger = createMockLogger();
    api = createMockVeSync();

    mockAPI = {
      hap: {
        Characteristic: {
          // Air Purifier + Filter
          Active: jest.fn(),
          CurrentAirPurifierState: jest.fn(),
          TargetAirPurifierState: jest.fn(),
          RotationSpeed: jest.fn(),
          FilterChangeIndication: jest.fn(),
          FilterLifeLevel: jest.fn(),
          Name: 'Name',

          // Device Info
          Manufacturer: jest.fn(),
          Model: jest.fn(),
          SerialNumber: jest.fn(),
        },
        Service: {
          AirPurifier: jest.fn(),
          AirQualitySensor: jest.fn(),
          FilterMaintenance: jest.fn(),
          AccessoryInformation: jest.fn(),
        },
        uuid: {
          generate: jest.fn(),
        },
      },
      platformAccessory: jest.fn(),
    } as any;

    platform = new TSVESyncPlatform(logger, {} as any, mockAPI);
    (platform as any).api = api;
  });

  function createMockAirPurifier(overrides: Partial<any> = {}) {
    return {
      deviceName: 'Test Air Purifier',
      deviceType: 'Core400S',
      cid: 'test-cid',
      uuid: 'test-uuid',
      deviceStatus: 'on',
      filterLife: 75,
      mode: 'manual',
      speed: 3,
      maxSpeed: 3,
      details: {
        filter_life: 75,
      },
      hasFeature: jest.fn().mockReturnValue(true),
      getDetails: jest.fn().mockResolvedValue(true),
      turnOn: jest.fn().mockResolvedValue(true),
      turnOff: jest.fn().mockResolvedValue(true),
      changeFanSpeed: jest.fn().mockResolvedValue(true),
      setMode: jest.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  it('removes legacy embedded AirQualitySensor and FilterMaintenance services and does not re-add them', () => {
    const mockDevice = createMockAirPurifier();

    const airPurifierService = createMockService();
    const legacyAqService = createMockService();
    const legacyFilterService = createMockService();
    const infoService = { setCharacteristic: jest.fn().mockReturnThis() };

    const accessory = {
      getService: jest.fn((service) => {
        if (service === platform.Service.AccessoryInformation) return infoService;
        if (service === platform.Service.AirPurifier) return airPurifierService;
        if (service === platform.Service.AirQualitySensor) return legacyAqService;
        if (service === platform.Service.FilterMaintenance) return legacyFilterService;
        return null;
      }),
      addService: jest.fn(() => airPurifierService),
      removeService: jest.fn(),
    };

    new AirPurifierAccessory(platform, accessory as any, mockDevice as any);

    expect(accessory.removeService).toHaveBeenCalledWith(legacyAqService);
    expect(accessory.removeService).toHaveBeenCalledWith(legacyFilterService);

    expect(accessory.addService).not.toHaveBeenCalledWith(platform.Service.AirQualitySensor);
    expect(accessory.addService).not.toHaveBeenCalledWith(platform.Service.FilterMaintenance);
  });
});

