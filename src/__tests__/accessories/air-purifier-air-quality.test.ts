/**
 * Unit tests for AirPurifierAccessory air quality features
 */

import { API } from 'homebridge';
import { Logger } from 'homebridge';
import { CharacteristicValue } from 'homebridge';
import { TSVESyncPlatform } from '../../platform';
import { VeSync } from 'tsvesync';
import { AirPurifierAccessory } from '../../accessories/air-purifier.accessory';
import { createMockLogger, createMockVeSync, createMockService } from '../utils/test-helpers';

// Extended mock for air purifier with air quality features
interface MockAirPurifierWithAirQuality {
  deviceName: string;
  deviceType: string;
  cid: string;
  uuid: string;
  deviceStatus: string;
  hasFeature: jest.Mock;
  airQualityValue: number;
  pm1: number;
  pm10: number;
  filterLife: number;
  details?: {
    air_quality_value?: number;
    pm25?: number;
    pm1?: number;
    pm10?: number;
    filter_life?: number | { percent: number };
  };
  getDetails: jest.Mock;
  turnOn: jest.Mock;
  turnOff: jest.Mock;
}

describe('AirPurifierAccessory Air Quality Features', () => {
  let mockAPI: jest.Mocked<API>;
  let platform: TSVESyncPlatform;
  let logger: jest.Mocked<Logger>;
  let api: jest.Mocked<VeSync>;
  let airQualityService: any;
  let airPurifierService: any;
  let infoService: any;

  beforeEach(() => {
    logger = createMockLogger();
    api = createMockVeSync();

    mockAPI = {
      hap: {
        Characteristic: {
          AirQuality: jest.fn(),
          PM2_5Density: jest.fn(),
          PM10Density: jest.fn(),
          Active: jest.fn(),
          CurrentAirPurifierState: jest.fn(),
          TargetAirPurifierState: jest.fn(),
          RotationSpeed: jest.fn(),
          Manufacturer: jest.fn(),
          Model: jest.fn(),
          SerialNumber: jest.fn(),
        },
        Service: {
          AirPurifier: jest.fn(),
          AirQualitySensor: jest.fn(),
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

    // Setup mock services
    airQualityService = createMockService();
    airPurifierService = createMockService();
    infoService = {
      setCharacteristic: jest.fn().mockReturnThis(),
    };
  });

  function createMockAirPurifier(config: Partial<MockAirPurifierWithAirQuality> = {}): MockAirPurifierWithAirQuality {
    return {
      deviceName: config.deviceName || 'Test Air Purifier',
      deviceType: config.deviceType || 'Core300S',
      cid: config.cid || 'test-cid',
      uuid: config.uuid || 'test-uuid',
      deviceStatus: config.deviceStatus || 'on',
      airQualityValue: config.airQualityValue || 25,
      pm1: config.pm1 || 15,
      pm10: config.pm10 || 35,
      filterLife: config.filterLife || 75,
      details: config.details || {
        air_quality_value: config.airQualityValue || 25,
        pm1: config.pm1 || 15,
        pm10: config.pm10 || 35,
        filter_life: config.filterLife || 75,
      },
      hasFeature: jest.fn().mockImplementation((feature: string) => {
        return feature === 'air_quality';
      }),
      getDetails: jest.fn().mockResolvedValue(true),
      turnOn: jest.fn().mockResolvedValue(true),
      turnOff: jest.fn().mockResolvedValue(true),
    };
  }

  describe('Air Quality Service Setup', () => {
    it('should create air quality service for devices with air quality support', () => {
      const mockDevice = createMockAirPurifier({ airQualityValue: 20 });
      
      const accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.AccessoryInformation) return infoService;
          if (service === platform.Service.AirPurifier) return airPurifierService;
          if (service === platform.Service.AirQualitySensor) return null; // Not created yet
          return null;
        }),
        addService: jest.fn((service) => {
          if (service === platform.Service.AirQualitySensor) return airQualityService;
          return airQualityService;
        }),
      };

      const airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);

      // Verify air quality service was added
      expect(accessory.addService).toHaveBeenCalledWith(platform.Service.AirQualitySensor);
    });

    it('should not create air quality service for devices without air quality support', () => {
      const mockDevice = createMockAirPurifier();
      mockDevice.hasFeature = jest.fn().mockReturnValue(false);
      
      const accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.AccessoryInformation) return infoService;
          if (service === platform.Service.AirPurifier) return airPurifierService;
          return null;
        }),
        addService: jest.fn(),
      };

      const airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);

      // Verify air quality service was not added
      expect(accessory.addService).not.toHaveBeenCalledWith(platform.Service.AirQualitySensor);
    });
  });

  describe('Air Quality Value Conversion', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithAirQuality;

    beforeEach(() => {
      mockDevice = createMockAirPurifier();
      
      const accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.AccessoryInformation) return infoService;
          if (service === platform.Service.AirPurifier) return airPurifierService;
          if (service === platform.Service.AirQualitySensor) return airQualityService;
          return null;
        }),
        addService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should convert PM2.5 values to HomeKit air quality scale', async () => {
      const testCases = [
        { pm25: 0, expected: 1 }, // EXCELLENT
        { pm25: 12, expected: 1 }, // EXCELLENT (0-12)
        { pm25: 13, expected: 2 }, // GOOD (13-35)
        { pm25: 35, expected: 2 }, // GOOD
        { pm25: 36, expected: 3 }, // FAIR (36-55)
        { pm25: 55, expected: 3 }, // FAIR
        { pm25: 56, expected: 4 }, // INFERIOR (56-150)
        { pm25: 150, expected: 4 }, // INFERIOR
        { pm25: 151, expected: 5 }, // POOR (>150)
        { pm25: 300, expected: 5 }, // POOR
      ];

      for (const testCase of testCases) {
        mockDevice.airQualityValue = testCase.pm25;
        mockDevice.details!.air_quality_value = testCase.pm25;

        const result = await (airPurifier as any).getAirQuality();
        expect(result).toBe(testCase.expected);
      }
    });

    it('should handle edge cases in PM2.5 conversion', async () => {
      // Test boundary values
      mockDevice.airQualityValue = 12.5;
      mockDevice.details!.air_quality_value = 12.5;
      let result = await (airPurifier as any).getAirQuality();
      expect(result).toBe(1); // Should round down to EXCELLENT

      mockDevice.airQualityValue = 35.5;
      mockDevice.details!.air_quality_value = 35.5;
      result = await (airPurifier as any).getAirQuality();
      expect(result).toBe(3); // Should round to FAIR
    });

    it('should handle zero PM2.5 values', async () => {
      mockDevice.airQualityValue = 0;
      mockDevice.details!.air_quality_value = 0;

      const result = await (airPurifier as any).getAirQuality();
      expect(result).toBe(1); // EXCELLENT
    });

    it('should handle extremely high PM2.5 values', async () => {
      mockDevice.airQualityValue = 999;
      mockDevice.details!.air_quality_value = 999;

      const result = await (airPurifier as any).getAirQuality();
      expect(result).toBe(5); // POOR
    });
  });

  describe('PM2.5 Density Characteristic', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithAirQuality;

    beforeEach(() => {
      mockDevice = createMockAirPurifier();
      
      const accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.AirQualitySensor) return airQualityService;
          return airPurifierService;
        }),
        addService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should return PM2.5 density within HomeKit limits', async () => {
      mockDevice.airQualityValue = 42;
      mockDevice.details!.air_quality_value = 42;

      const result = await (airPurifier as any).getPM25Density();
      expect(result).toBe(42);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1000);
    });

    it('should clamp PM2.5 values above 1000', async () => {
      mockDevice.airQualityValue = 1500;
      mockDevice.details!.air_quality_value = 1500;

      const result = await (airPurifier as any).getPM25Density();
      expect(result).toBe(1000); // Clamped to maximum
    });

    it('should handle negative PM2.5 values', async () => {
      mockDevice.airQualityValue = -10;
      mockDevice.details!.air_quality_value = -10;

      const result = await (airPurifier as any).getPM25Density();
      expect(result).toBe(0); // Clamped to minimum
    });

    it('should fallback to pm25 field if air_quality_value is missing', async () => {
      mockDevice.airQualityValue = 35;
      mockDevice.details!.pm25 = 35;
      delete mockDevice.details!.air_quality_value;

      const result = await (airPurifier as any).getPM25Density();
      expect(result).toBe(35);
    });
  });

  describe('PM10 Density Characteristic', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithAirQuality;

    beforeEach(() => {
      mockDevice = createMockAirPurifier({ pm10: 45 });
      
      const accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.AirQualitySensor) return airQualityService;
          return airPurifierService;
        }),
        addService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should return PM10 density when available', async () => {
      const result = await (airPurifier as any).getPM10Density();
      expect(result).toBe(45);
    });

    it('should handle PM10 values above HomeKit limit', async () => {
      mockDevice.pm10 = 1200;
      mockDevice.details!.pm10 = 1200;

      const result = await (airPurifier as any).getPM10Density();
      expect(result).toBe(1000); // Clamped to maximum
    });

    it('should handle missing PM10 data', async () => {
      mockDevice.pm10 = 0;
      delete mockDevice.details!.pm10;

      const result = await (airPurifier as any).getPM10Density();
      expect(result).toBe(0);
    });

    it('should only add PM10 characteristic when data is available', () => {
      // Device without PM10 data
      const deviceWithoutPM10 = createMockAirPurifier({ pm10: 0 });
      delete deviceWithoutPM10.details!.pm10;

      const accessory = {
        getService: jest.fn(() => airQualityService),
        addService: jest.fn(() => airQualityService),
      };

      const setupCharacteristicSpy = jest.spyOn(AirPurifierAccessory.prototype as any, 'setupCharacteristic');
      
      new AirPurifierAccessory(platform, accessory as any, deviceWithoutPM10 as any);

      // PM10 characteristic should not be set up
      const pm10Calls = setupCharacteristicSpy.mock.calls.filter(call => 
        call[0] === platform.Characteristic.PM10Density
      );
      expect(pm10Calls).toHaveLength(0);
    });
  });

  describe('Air Quality Data Updates', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithAirQuality;
    let mockCharacteristic: any;

    beforeEach(() => {
      mockCharacteristic = {
        updateValue: jest.fn(),
      };

      mockDevice = createMockAirPurifier();
      
      const accessory = {
        getService: jest.fn(() => ({
          getCharacteristic: jest.fn(() => mockCharacteristic),
        })),
        addService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should update air quality characteristics when device updates', async () => {
      // Simulate device update
      mockDevice.airQualityValue = 55;
      mockDevice.pm10 = 75;
      
      await (airPurifier as any).updateDeviceState();

      // Verify characteristics were updated (exact calls depend on implementation)
      expect(mockCharacteristic.updateValue).toHaveBeenCalled();
    });

    it('should handle real-time air quality changes', async () => {
      const initialPM25 = 20;
      const updatedPM25 = 80;

      // Initial state
      mockDevice.airQualityValue = initialPM25;
      await (airPurifier as any).getAirQuality();

      // Update state
      mockDevice.airQualityValue = updatedPM25;
      mockDevice.details!.air_quality_value = updatedPM25;

      const newResult = await (airPurifier as any).getAirQuality();
      expect(newResult).toBe(4); // Should be INFERIOR for PM2.5 = 80
    });

    it('should handle air quality improvements', async () => {
      // Start with poor air quality
      mockDevice.airQualityValue = 200;
      let result = await (airPurifier as any).getAirQuality();
      expect(result).toBe(5); // POOR

      // Air quality improves
      mockDevice.airQualityValue = 25;
      mockDevice.details!.air_quality_value = 25;
      result = await (airPurifier as any).getAirQuality();
      expect(result).toBe(2); // GOOD
    });
  });

  describe('Error Handling', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithAirQuality;

    beforeEach(() => {
      mockDevice = createMockAirPurifier();
      
      const accessory = {
        getService: jest.fn(() => airQualityService),
        addService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should handle missing air quality data gracefully', async () => {
      mockDevice.airQualityValue = 0;
      delete mockDevice.details!.air_quality_value;
      delete mockDevice.details!.pm25;

      const result = await (airPurifier as any).getAirQuality();
      expect(result).toBe(1); // Default to EXCELLENT for 0 value
    });

    it('should handle device API errors', async () => {
      mockDevice.getDetails = jest.fn().mockRejectedValue(new Error('API Error'));

      // Should not throw error
      await expect((airPurifier as any).getAirQuality()).resolves.toBeDefined();
    });

    it('should handle corrupted device data', async () => {
      mockDevice.details = null as any;

      const result = await (airPurifier as any).getAirQuality();
      expect(result).toBe(1); // Default to EXCELLENT
    });

    it('should handle non-numeric air quality values', async () => {
      mockDevice.airQualityValue = NaN;
      mockDevice.details!.air_quality_value = NaN;

      const result = await (airPurifier as any).getAirQuality();
      expect(result).toBe(1); // Default to EXCELLENT for NaN
    });
  });

  describe('Feature Detection', () => {
    it('should detect air quality support correctly', () => {
      const deviceWithAirQuality = createMockAirPurifier();
      deviceWithAirQuality.hasFeature = jest.fn().mockReturnValue(true);

      const accessory = {
        getService: jest.fn(),
        addService: jest.fn(() => airQualityService),
      };

      const airPurifier = new AirPurifierAccessory(platform, accessory as any, deviceWithAirQuality as any);
      
      expect(deviceWithAirQuality.hasFeature).toHaveBeenCalledWith('air_quality');
    });

    it('should handle devices without air quality support', () => {
      const deviceWithoutAirQuality = createMockAirPurifier();
      deviceWithoutAirQuality.hasFeature = jest.fn().mockReturnValue(false);

      const accessory = {
        getService: jest.fn(),
        addService: jest.fn(),
      };

      new AirPurifierAccessory(platform, accessory as any, deviceWithoutAirQuality as any);
      
      expect(accessory.addService).not.toHaveBeenCalledWith(platform.Service.AirQualitySensor);
    });
  });
});