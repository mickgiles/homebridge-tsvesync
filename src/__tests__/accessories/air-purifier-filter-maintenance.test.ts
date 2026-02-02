/**
 * Unit tests for AirPurifierAccessory filter maintenance features
 */

import { API } from 'homebridge';
import { Logger } from 'homebridge';
import { CharacteristicValue } from 'homebridge';
import { TSVESyncPlatform } from '../../platform';
import { VeSync } from 'tsvesync';
import { AirPurifierAccessory } from '../../accessories/air-purifier.accessory';
import { createMockLogger, createMockVeSync, createMockService } from '../utils/test-helpers';

// Extended mock for air purifier with filter maintenance features
interface MockAirPurifierWithFilter {
  deviceName: string;
  deviceType: string;
  cid: string;
  uuid: string;
  deviceStatus: string;
  filterLife: number;
  hasFeature: jest.Mock;
  details?: {
    filter_life?: number | { percent: number };
  };
  getDetails: jest.Mock;
  turnOn: jest.Mock;
  turnOff: jest.Mock;
}

describe('AirPurifierAccessory Filter Maintenance Features', () => {
  let mockAPI: jest.Mocked<API>;
  let platform: TSVESyncPlatform;
  let logger: jest.Mocked<Logger>;
  let api: jest.Mocked<VeSync>;
  let filterService: any;
  let airPurifierService: any;
  let infoService: any;

  beforeEach(() => {
    logger = createMockLogger();
    api = createMockVeSync();

    mockAPI = {
      hap: {
        Characteristic: {
          FilterChangeIndication: jest.fn(),
          FilterLifeLevel: jest.fn(),
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

    // Setup mock services
    filterService = createMockService();
    airPurifierService = createMockService();
    infoService = {
      setCharacteristic: jest.fn().mockReturnThis(),
    };
  });

  function createMockAirPurifier(config: Partial<MockAirPurifierWithFilter> = {}): MockAirPurifierWithFilter {
    return {
      deviceName: config.deviceName || 'Test Air Purifier',
      deviceType: config.deviceType || 'Core300S',
      cid: config.cid || 'test-cid',
      uuid: config.uuid || 'test-uuid',
      deviceStatus: config.deviceStatus || 'on',
      filterLife: config.filterLife !== undefined ? config.filterLife : 75,
      details: config.details || {
        filter_life: config.filterLife !== undefined ? config.filterLife : 75,
      },
      hasFeature: jest.fn().mockReturnValue(true), // Assume filter support by default
      getDetails: jest.fn().mockResolvedValue(true),
      turnOn: jest.fn().mockResolvedValue(true),
      turnOff: jest.fn().mockResolvedValue(true),
    };
  }

  describe('Filter Service Setup', () => {
    it('should not add FilterMaintenance service (migrated to AirPurifier service)', () => {
      const mockDevice = createMockAirPurifier({ filterLife: 60 });
      
      const accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.AccessoryInformation) return infoService;
          if (service === platform.Service.AirPurifier) return airPurifierService;
          if (service === platform.Service.FilterMaintenance) return null; // Not created yet
          return null;
        }),
        addService: jest.fn((service) => {
          if (service === platform.Service.FilterMaintenance) return filterService;
          return filterService;
        }),
        removeService: jest.fn(),
      };

      new AirPurifierAccessory(platform, accessory as any, mockDevice as any);

      expect(accessory.addService).not.toHaveBeenCalledWith(platform.Service.FilterMaintenance);
    });

    it('should remove legacy FilterMaintenance service if present', () => {
      const mockDevice = createMockAirPurifier();
      
      const accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.AccessoryInformation) return infoService;
          if (service === platform.Service.AirPurifier) return airPurifierService;
          if (service === platform.Service.FilterMaintenance) return filterService;
          return null;
        }),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      new AirPurifierAccessory(platform, accessory as any, mockDevice as any);

      expect(accessory.removeService).toHaveBeenCalledWith(filterService);
      expect(accessory.addService).not.toHaveBeenCalledWith(platform.Service.FilterMaintenance);
    });
  });

  describe('Filter Change Indication', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithFilter;

    beforeEach(() => {
      mockDevice = createMockAirPurifier();
      
      const accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.FilterMaintenance) return filterService;
          return airPurifierService;
        }),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should indicate filter change needed when life is below 10%', async () => {
      mockDevice.filterLife = 5;
      
      const result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(1); // CHANGE_FILTER
    });

    it('should not indicate filter change when life is above 10%', async () => {
      mockDevice.filterLife = 25;
      
      const result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(0); // FILTER_OK
    });

    it('should handle exact 10% threshold', async () => {
      mockDevice.filterLife = 10;
      
      const result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(0); // FILTER_OK (not below 10%)
    });

    it('should handle 0% filter life', async () => {
      mockDevice.filterLife = 0;
      
      const result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(1); // CHANGE_FILTER
    });

    it('should handle 100% filter life (new filter)', async () => {
      mockDevice.filterLife = 100;
      
      const result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(0); // FILTER_OK
    });

    it('should handle edge cases around threshold', async () => {
      // Just above threshold
      mockDevice.filterLife = 11;
      let result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(0); // FILTER_OK

      // Just below threshold
      mockDevice.filterLife = 9;
      result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(1); // CHANGE_FILTER
    });
  });

  describe('Filter Life Level', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithFilter;

    beforeEach(() => {
      mockDevice = createMockAirPurifier();
      
      const accessory = {
        getService: jest.fn(() => filterService),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should return filter life percentage directly', async () => {
      const testValues = [0, 15, 30, 50, 75, 90, 100];
      
      for (const value of testValues) {
        mockDevice.filterLife = value;
        const result = await (airPurifier as any).getFilterLifeLevel();
        expect(result).toBe(value);
      }
    });

    it('should handle negative filter life values', async () => {
      mockDevice.filterLife = -10;
      
      const result = await (airPurifier as any).getFilterLifeLevel();
      expect(result).toBe(0); // Clamp to minimum
    });

    it('should handle filter life values above 100%', async () => {
      mockDevice.filterLife = 120;
      
      const result = await (airPurifier as any).getFilterLifeLevel();
      expect(result).toBe(100); // Clamp to maximum
    });

    it('should handle non-integer filter life values', async () => {
      mockDevice.filterLife = 67.5;
      
      const result = await (airPurifier as any).getFilterLifeLevel();
      expect(result).toBe(68); // Round to nearest integer
    });

    it('should handle NaN filter life values', async () => {
      mockDevice.filterLife = NaN;
      mockDevice.details!.filter_life = NaN as any;
      
      const result = await (airPurifier as any).getFilterLifeLevel();
      expect(result).toBe(100); // Default to 100% when data is invalid
    });
  });

  describe('Filter Data Parsing', () => {
    let airPurifier: AirPurifierAccessory;

    beforeEach(() => {
      const accessory = {
        getService: jest.fn(() => filterService),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      // Create base air purifier for testing
      const mockDevice = createMockAirPurifier();
      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should handle number format filter life (VeSyncAirBypass)', async () => {
      const mockDevice = createMockAirPurifier({
        filterLife: 85,
        details: { filter_life: 85 }
      });

      // Update the device reference
      (airPurifier as any).device = mockDevice;
      
      const lifeResult = await (airPurifier as any).getFilterLifeLevel();
      const changeResult = await (airPurifier as any).getFilterChangeIndication();
      
      expect(lifeResult).toBe(85);
      expect(changeResult).toBe(0); // FILTER_OK
    });

    it('should handle object format filter life (VeSyncAir131)', async () => {
      const mockDevice = createMockAirPurifier({
        filterLife: 42,
        details: { filter_life: { percent: 42 } }
      });

      (airPurifier as any).device = mockDevice;
      
      const lifeResult = await (airPurifier as any).getFilterLifeLevel();
      const changeResult = await (airPurifier as any).getFilterChangeIndication();
      
      expect(lifeResult).toBe(42);
      expect(changeResult).toBe(0); // FILTER_OK
    });

    it('should handle missing filter life data', async () => {
      const mockDevice = createMockAirPurifier({
        filterLife: 0,
        details: {}
      });

      (airPurifier as any).device = mockDevice;
      
      const lifeResult = await (airPurifier as any).getFilterLifeLevel();
      const changeResult = await (airPurifier as any).getFilterChangeIndication();
      
      expect(lifeResult).toBe(0);
      expect(changeResult).toBe(1); // CHANGE_FILTER
    });
  });

  describe('Filter Maintenance Alerts', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithFilter;
    let mockCharacteristic: any;

    beforeEach(() => {
      mockCharacteristic = {
        onGet: jest.fn().mockReturnThis(),
        onSet: jest.fn().mockReturnThis(),
        setProps: jest.fn().mockReturnThis(),
        updateValue: jest.fn(),
      };

      mockDevice = createMockAirPurifier();
      
      const accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.AccessoryInformation) return infoService;
          return {
            getCharacteristic: jest.fn(() => mockCharacteristic),
          };
        }),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should trigger alert when filter life drops below threshold', async () => {
      // Start above threshold
      mockDevice.filterLife = 15;
      await (airPurifier as any).getFilterChangeIndication();

      // Drop below threshold
      mockDevice.filterLife = 8;
      const result = await (airPurifier as any).getFilterChangeIndication();
      
      expect(result).toBe(1); // CHANGE_FILTER
    });

    it('should clear alert when filter is replaced', async () => {
      // Start with low filter life
      mockDevice.filterLife = 5;
      let result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(1); // CHANGE_FILTER

      // Filter replaced
      mockDevice.filterLife = 100;
      result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(0); // FILTER_OK
    });

    it('should handle gradual filter degradation', async () => {
      const degradationSteps = [100, 75, 50, 25, 15, 10, 8, 5, 0];
      
      for (const life of degradationSteps) {
        mockDevice.filterLife = life;
        const changeIndication = await (airPurifier as any).getFilterChangeIndication();
        const lifeLevel = await (airPurifier as any).getFilterLifeLevel();
        
        expect(lifeLevel).toBe(life);
        expect(changeIndication).toBe(life < 10 ? 1 : 0);
      }
    });
  });

  describe('Filter State Updates', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithFilter;
    let mockCharacteristic: any;
    let airPurifierServiceMock: any;

    beforeEach(() => {
      mockCharacteristic = {
        onGet: jest.fn().mockReturnThis(),
        onSet: jest.fn().mockReturnThis(),
        setProps: jest.fn().mockReturnThis(),
        updateValue: jest.fn(),
      };

      mockDevice = createMockAirPurifier();

      airPurifierServiceMock = {
        getCharacteristic: jest.fn(() => mockCharacteristic),
        updateCharacteristic: jest.fn(),
      };
      
      const accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.AccessoryInformation) return infoService;
          return airPurifierServiceMock;
        }),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should update filter characteristics when device updates', async () => {
      // Simulate device update
      mockDevice.filterLife = 30;
      
      await (airPurifier as any).updateDeviceSpecificStates(mockDevice);

      // Verify filter characteristics were updated
      expect(airPurifierServiceMock.updateCharacteristic).toHaveBeenCalledWith(
        platform.Characteristic.FilterChangeIndication,
        0
      );
      expect(airPurifierServiceMock.updateCharacteristic).toHaveBeenCalledWith(
        platform.Characteristic.FilterLifeLevel,
        30
      );
    });

    it('should handle rapid filter life changes', async () => {
      const rapidUpdates = [80, 60, 40, 20, 10, 5, 2];
      
      for (const life of rapidUpdates) {
        mockDevice.filterLife = life;
        
        const lifeResult = await (airPurifier as any).getFilterLifeLevel();
        const changeResult = await (airPurifier as any).getFilterChangeIndication();
        
        expect(lifeResult).toBe(life);
        expect(changeResult).toBe(life < 10 ? 1 : 0);
      }
    });
  });

  describe('Error Handling', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithFilter;

    beforeEach(() => {
      mockDevice = createMockAirPurifier();
      
      const accessory = {
        getService: jest.fn(() => filterService),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should handle missing filter data gracefully', async () => {
      mockDevice.filterLife = 0;
      delete mockDevice.details!.filter_life;

      const lifeResult = await (airPurifier as any).getFilterLifeLevel();
      const changeResult = await (airPurifier as any).getFilterChangeIndication();
      
      expect(lifeResult).toBe(0);
      expect(changeResult).toBe(1); // CHANGE_FILTER for 0%
    });

    it('should handle device API errors', async () => {
      mockDevice.getDetails = jest.fn().mockRejectedValue(new Error('API Error'));

      // Should not throw error
      await expect((airPurifier as any).getFilterLifeLevel()).resolves.toBeDefined();
      await expect((airPurifier as any).getFilterChangeIndication()).resolves.toBeDefined();
    });

    it('should handle corrupted filter data', async () => {
      mockDevice.details = null as any;
      mockDevice.filterLife = NaN;

      const lifeResult = await (airPurifier as any).getFilterLifeLevel();
      const changeResult = await (airPurifier as any).getFilterChangeIndication();
      
      expect(lifeResult).toBe(100);
      expect(changeResult).toBe(0); // FILTER_OK when data is missing/invalid
    });

    it('should handle invalid filter life types', async () => {
      mockDevice.filterLife = 'invalid' as any;
      mockDevice.details!.filter_life = 'invalid' as any;

      const lifeResult = await (airPurifier as any).getFilterLifeLevel();
      expect(lifeResult).toBe(100);
    });

    it('should handle extreme filter life values gracefully', async () => {
      // Test very high value
      mockDevice.filterLife = 999999;
      let lifeResult = await (airPurifier as any).getFilterLifeLevel();
      expect(lifeResult).toBe(100); // Clamped

      // Test very low value
      mockDevice.filterLife = -999999;
      lifeResult = await (airPurifier as any).getFilterLifeLevel();
      expect(lifeResult).toBe(0); // Clamped
    });
  });

  describe('Device-Specific Filter Handling', () => {
    it('should handle Core series filter life format', async () => {
      const coreDevice = createMockAirPurifier({
        deviceType: 'Core300S',
        filterLife: 68,
        details: { filter_life: 68 }
      });

      const accessory = {
        getService: jest.fn(() => filterService),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      const airPurifier = new AirPurifierAccessory(platform, accessory as any, coreDevice as any);
      
      const result = await (airPurifier as any).getFilterLifeLevel();
      expect(result).toBe(68);
    });

    it('should handle LAP series filter life format', async () => {
      const lapDevice = createMockAirPurifier({
        deviceType: 'LAP-V102S-AASR',
        filterLife: 45,
        details: { filter_life: 45 }
      });

      const accessory = {
        getService: jest.fn(() => filterService),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      const airPurifier = new AirPurifierAccessory(platform, accessory as any, lapDevice as any);
      
      const result = await (airPurifier as any).getFilterLifeLevel();
      expect(result).toBe(45);
    });

    it('should handle LV series filter life object format', async () => {
      const lvDevice = createMockAirPurifier({
        deviceType: 'LV-PUR131S',
        filterLife: 33,
        details: { filter_life: { percent: 33 } }
      });

      const accessory = {
        getService: jest.fn(() => filterService),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      const airPurifier = new AirPurifierAccessory(platform, accessory as any, lvDevice as any);
      
      const result = await (airPurifier as any).getFilterLifeLevel();
      expect(result).toBe(33);
    });
  });

  describe('Filter Replacement Scenarios', () => {
    let airPurifier: AirPurifierAccessory;
    let mockDevice: MockAirPurifierWithFilter;

    beforeEach(() => {
      mockDevice = createMockAirPurifier();
      
      const accessory = {
        getService: jest.fn(() => filterService),
        addService: jest.fn(),
        removeService: jest.fn(),
      };

      airPurifier = new AirPurifierAccessory(platform, accessory as any, mockDevice as any);
    });

    it('should handle complete filter lifecycle', async () => {
      // New filter
      mockDevice.filterLife = 100;
      let result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(0); // FILTER_OK

      // Half life
      mockDevice.filterLife = 50;
      result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(0); // FILTER_OK

      // Getting low
      mockDevice.filterLife = 15;
      result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(0); // FILTER_OK

      // Needs replacement
      mockDevice.filterLife = 8;
      result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(1); // CHANGE_FILTER

      // Completely used up
      mockDevice.filterLife = 0;
      result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(1); // CHANGE_FILTER

      // Replaced with new filter
      mockDevice.filterLife = 100;
      result = await (airPurifier as any).getFilterChangeIndication();
      expect(result).toBe(0); // FILTER_OK
    });
  });
});
