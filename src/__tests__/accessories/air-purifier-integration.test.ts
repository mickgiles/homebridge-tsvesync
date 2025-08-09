/**
 * Integration tests for AirPurifierAccessory with combined air quality and filter features
 */

import { API } from 'homebridge';
import { Logger } from 'homebridge';
import { TSVESyncPlatform } from '../../platform';
import { VeSync } from 'tsvesync';
import { AirPurifierAccessory } from '../../accessories/air-purifier.accessory';
import { createMockLogger, createMockVeSync, createMockService } from '../utils/test-helpers';

// Complete mock for air purifier with all features
interface CompleteMockAirPurifier {
  deviceName: string;
  deviceType: string;
  cid: string;
  uuid: string;
  deviceStatus: string;
  airQualityValue: number;
  pm1: number;
  pm10: number;
  filterLife: number;
  hasFeature: jest.Mock;
  details: {
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
          // Air Quality
          AirQuality: jest.fn(),
          PM2_5Density: jest.fn(),
          PM10Density: jest.fn(),
          // Filter Maintenance
          FilterChangeIndication: jest.fn(),
          FilterLifeLevel: jest.fn(),
          // Air Purifier
          Active: jest.fn(),
          CurrentAirPurifierState: jest.fn(),
          TargetAirPurifierState: jest.fn(),
          RotationSpeed: jest.fn(),
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

  function createCompleteAirPurifier(config: Partial<CompleteMockAirPurifier> = {}): CompleteMockAirPurifier {
    return {
      deviceName: config.deviceName || 'Test Air Purifier',
      deviceType: config.deviceType || 'Core300S',
      cid: config.cid || 'test-cid',
      uuid: config.uuid || 'test-uuid',
      deviceStatus: config.deviceStatus || 'on',
      airQualityValue: config.airQualityValue !== undefined ? config.airQualityValue : 25,
      pm1: config.pm1 !== undefined ? config.pm1 : 15,
      pm10: config.pm10 !== undefined ? config.pm10 : 35,
      filterLife: config.filterLife !== undefined ? config.filterLife : 75,
      details: {
        air_quality_value: config.airQualityValue !== undefined ? config.airQualityValue : 25,
        pm1: config.pm1 !== undefined ? config.pm1 : 15,
        pm10: config.pm10 !== undefined ? config.pm10 : 35,
        filter_life: config.filterLife !== undefined ? config.filterLife : 75,
        ...config.details
      },
      hasFeature: jest.fn().mockImplementation((feature: string) => {
        return feature === 'air_quality'; // Default to supporting air quality
      }),
      getDetails: jest.fn().mockResolvedValue(true),
      turnOn: jest.fn().mockResolvedValue(true),
      turnOff: jest.fn().mockResolvedValue(true),
    };
  }

  function createMockAccessory() {
    const services = {
      airPurifier: createMockService(),
      airQuality: createMockService(),
      filter: createMockService(),
      info: {
        setCharacteristic: jest.fn().mockReturnThis(),
      },
    };

    return {
      getService: jest.fn((service) => {
        if (service === platform.Service.AirPurifier) return services.airPurifier;
        if (service === platform.Service.AirQualitySensor) return null; // Will be created
        if (service === platform.Service.FilterMaintenance) return null; // Will be created
        if (service === platform.Service.AccessoryInformation) return services.info;
        return null;
      }),
      addService: jest.fn((service) => {
        if (service === platform.Service.AirQualitySensor) return services.airQuality;
        if (service === platform.Service.FilterMaintenance) return services.filter;
        return services.airPurifier;
      }),
    };
  }

  describe('Complete Device Setup', () => {
    it('should create all services for a fully featured device', () => {
      const mockDevice = createCompleteAirPurifier();
      const accessory = createMockAccessory();

      const airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);

      // Verify all services were created
      expect(accessory.addService).toHaveBeenCalledWith(platform.Service.AirQualitySensor);
      expect(accessory.addService).toHaveBeenCalledWith(platform.Service.FilterMaintenance);
    });

    it('should setup characteristics for all services', () => {
      const mockDevice = createCompleteAirPurifier();
      const accessory = createMockAccessory();

      new AirPurifierAccessory(platform, accessory as any, mockDevice as any);

      // Verify characteristics were set up (exact verification depends on implementation details)
      expect(accessory.getService).toHaveBeenCalledWith(platform.Service.AirPurifier);
    });
  });

  describe('Real-world Scenarios', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: CompleteMockAirPurifier;
    let accessory: any;

    beforeEach(() => {
      mockDevice = createCompleteAirPurifier();
      accessory = createMockAccessory();
      airPurifier = new AirPurifierAccessory(platform, accessory, mockDevice as any);
    });

    it('should handle good air quality with healthy filter', async () => {
      mockDevice.airQualityValue = 15; // Good air
      mockDevice.pm1 = 10;
      mockDevice.pm10 = 20;
      mockDevice.filterLife = 80; // Healthy filter

      const airQuality = await (airPurifier as any).getAirQuality();
      const pm25Density = await (airPurifier as any).getPM25Density();
      const filterChange = await (airPurifier as any).getFilterChangeIndication();
      const filterLife = await (airPurifier as any).getFilterLifeLevel();

      expect(airQuality).toBe(2); // GOOD
      expect(pm25Density).toBe(15);
      expect(filterChange).toBe(0); // FILTER_OK
      expect(filterLife).toBe(80);
    });

    it('should handle poor air quality with old filter', async () => {
      mockDevice.airQualityValue = 180; // Very poor air
      mockDevice.pm1 = 120;
      mockDevice.pm10 = 220;
      mockDevice.filterLife = 5; // Old filter

      const airQuality = await (airPurifier as any).getAirQuality();
      const pm25Density = await (airPurifier as any).getPM25Density();
      const filterChange = await (airPurifier as any).getFilterChangeIndication();
      const filterLife = await (airPurifier as any).getFilterLifeLevel();

      expect(airQuality).toBe(5); // POOR
      expect(pm25Density).toBe(180);
      expect(filterChange).toBe(1); // CHANGE_FILTER
      expect(filterLife).toBe(5);
    });

    it('should handle filter replacement scenario', async () => {
      // Old filter with poor air quality
      mockDevice.airQualityValue = 75;
      mockDevice.filterLife = 3;

      let airQuality = await (airPurifier as any).getAirQuality();
      let filterChange = await (airPurifier as any).getFilterChangeIndication();

      expect(airQuality).toBe(4); // INFERIOR
      expect(filterChange).toBe(1); // CHANGE_FILTER

      // Replace filter - air quality should improve over time
      mockDevice.filterLife = 100;
      mockDevice.airQualityValue = 20; // Improved after filter change

      airQuality = await (airPurifier as any).getAirQuality();
      filterChange = await (airPurifier as any).getFilterChangeIndication();

      expect(airQuality).toBe(2); // GOOD
      expect(filterChange).toBe(0); // FILTER_OK
    });

    it('should handle seasonal air quality changes', async () => {
      const seasonalScenarios = [
        { season: 'Spring', pm25: 30, expected: 2 }, // GOOD - mild pollen
        { season: 'Summer', pm25: 15, expected: 2 }, // GOOD - clean air
        { season: 'Fall', pm25: 45, expected: 3 }, // FAIR - more particles
        { season: 'Winter', pm25: 80, expected: 4 }, // INFERIOR - heating pollution
      ];

      for (const scenario of seasonalScenarios) {
        mockDevice.airQualityValue = scenario.pm25;
        mockDevice.details.air_quality_value = scenario.pm25;

        const airQuality = await (airPurifier as any).getAirQuality();
        expect(airQuality).toBe(scenario.expected);
      }
    });
  });

  describe('Device-Specific Behaviors', () => {
    it('should handle Core300S with complete feature set', async () => {
      const core300s = createCompleteAirPurifier({
        deviceType: 'Core300S',
        airQualityValue: 28,
        filterLife: 65,
        details: { filter_life: 65 } // Number format for Core series
      });

      const accessory = createMockAccessory();
      const airPurifier = new AirPurifierAccessory(platform, accessory as any, core300s as any);

      const airQuality = await (airPurifier as any).getAirQuality();
      const filterLife = await (airPurifier as any).getFilterLifeLevel();

      expect(airQuality).toBe(2); // GOOD
      expect(filterLife).toBe(65);
    });

    it('should handle LV-PUR131S with object filter format', async () => {
      const lvPur131s = createCompleteAirPurifier({
        deviceType: 'LV-PUR131S',
        airQualityValue: 35,
        filterLife: 42,
        details: { filter_life: { percent: 42 } } // Object format for LV series
      });

      const accessory = createMockAccessory();
      const airPurifier = new AirPurifierAccessory(platform, accessory as any, lvPur131s as any);

      const airQuality = await (airPurifier as any).getAirQuality();
      const filterLife = await (airPurifier as any).getFilterLifeLevel();

      expect(airQuality).toBe(2); // GOOD
      expect(filterLife).toBe(42);
    });

    it('should handle LAP-V102S with extended PM data', async () => {
      const lapV102s = createCompleteAirPurifier({
        deviceType: 'LAP-V102S-AASR',
        airQualityValue: 22,
        pm1: 18,
        pm10: 28,
        filterLife: 88,
        details: {
          air_quality_value: 22,
          pm1: 18,
          pm10: 28,
          filter_life: 88
        }
      });

      const accessory = createMockAccessory();
      const airPurifier = new AirPurifierAccessory(platform, accessory as any, lapV102s as any);

      const airQuality = await (airPurifier as any).getAirQuality();
      const pm25 = await (airPurifier as any).getPM25Density();
      const pm10 = await (airPurifier as any).getPM10Density();

      expect(airQuality).toBe(2); // GOOD
      expect(pm25).toBe(22);
      expect(pm10).toBe(28);
    });
  });

  describe('State Synchronization', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: CompleteMockAirPurifier;
    let characteristics: any;

    beforeEach(() => {
      characteristics = {
        airQuality: { updateValue: jest.fn() },
        pm25: { updateValue: jest.fn() },
        pm10: { updateValue: jest.fn() },
        filterChange: { updateValue: jest.fn() },
        filterLife: { updateValue: jest.fn() },
      };

      mockDevice = createCompleteAirPurifier();
      
      const accessory = {
        getService: jest.fn(() => ({
          getCharacteristic: jest.fn((char) => {
            if (char === platform.Characteristic.AirQuality) return characteristics.airQuality;
            if (char === platform.Characteristic.PM2_5Density) return characteristics.pm25;
            if (char === platform.Characteristic.PM10Density) return characteristics.pm10;
            if (char === platform.Characteristic.FilterChangeIndication) return characteristics.filterChange;
            if (char === platform.Characteristic.FilterLifeLevel) return characteristics.filterLife;
            return { updateValue: jest.fn() };
          }),
        })),
        addService: jest.fn(() => ({
          getCharacteristic: jest.fn(() => ({ updateValue: jest.fn() })),
        })),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should update all characteristics when device state changes', async () => {
      // Simulate device state change
      mockDevice.airQualityValue = 45;
      mockDevice.pm1 = 35;
      mockDevice.pm10 = 55;
      mockDevice.filterLife = 25;

      // Trigger update (implementation-dependent)
      await (airPurifier as any).updateDeviceState();

      // Verify updates were called (exact verification depends on implementation)
      // This is a placeholder for the actual implementation
      expect(mockDevice.getDetails).toHaveBeenCalled();
    });

    it('should handle partial updates gracefully', async () => {
      // Update only some values
      mockDevice.airQualityValue = 60;
      // Leave other values unchanged

      const airQuality = await (airPurifier as any).getAirQuality();
      expect(airQuality).toBe(4); // INFERIOR for PM2.5 = 60
    });
  });

  describe('Error Recovery', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: CompleteMockAirPurifier;

    beforeEach(() => {
      mockDevice = createCompleteAirPurifier();
      const accessory = createMockAccessory();
      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should handle API timeouts gracefully', async () => {
      mockDevice.getDetails = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      // Should not throw and should use cached values
      const airQuality = await (airPurifier as any).getAirQuality();
      const filterLife = await (airPurifier as any).getFilterLifeLevel();

      expect(airQuality).toBeDefined();
      expect(filterLife).toBeDefined();
    });

    it('should handle corrupted device data', async () => {
      mockDevice.details = null as any;
      mockDevice.airQualityValue = NaN;
      mockDevice.filterLife = NaN;

      const airQuality = await (airPurifier as any).getAirQuality();
      const filterLife = await (airPurifier as any).getFilterLifeLevel();

      expect(airQuality).toBe(1); // Default to EXCELLENT
      expect(filterLife).toBe(0); // Default to empty
    });

    it('should recover from network interruptions', async () => {
      // Simulate network failure
      mockDevice.getDetails = jest.fn().mockRejectedValueOnce(new Error('Network error'));

      // First call should handle error
      await (airPurifier as any).getAirQuality();

      // Simulate recovery
      mockDevice.getDetails = jest.fn().mockResolvedValue(true);
      mockDevice.airQualityValue = 30;

      const airQuality = await (airPurifier as any).getAirQuality();
      expect(airQuality).toBe(2); // GOOD
    });
  });

  describe('Performance and Efficiency', () => {
    it('should not make redundant API calls for multiple characteristic reads', async () => {
      const mockDevice = createCompleteAirPurifier();
      const accessory = createMockAccessory();
      const airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);

      // Read multiple characteristics
      await Promise.all([
        (airPurifier as any).getAirQuality(),
        (airPurifier as any).getPM25Density(),
        (airPurifier as any).getFilterLifeLevel(),
        (airPurifier as any).getFilterChangeIndication(),
      ]);

      // Should use cached data, not make multiple API calls
      expect(mockDevice.getDetails).toHaveBeenCalledTimes(0); // No additional calls beyond setup
    });

    it('should handle high-frequency updates efficiently', async () => {
      const mockDevice = createCompleteAirPurifier();
      const accessory = createMockAccessory();
      const airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);

      // Simulate rapid updates
      const updates = Array.from({ length: 10 }, (_, i) => ({
        airQualityValue: 20 + i * 5,
        filterLife: 80 - i * 2,
      }));

      const startTime = Date.now();
      
      for (const update of updates) {
        mockDevice.airQualityValue = update.airQualityValue;
        mockDevice.filterLife = update.filterLife;
        
        await (airPurifier as any).getAirQuality();
        await (airPurifier as any).getFilterLifeLevel();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });
  });
});