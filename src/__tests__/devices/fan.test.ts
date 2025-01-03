import { API } from 'homebridge';
import { Logger } from 'homebridge';
import { CharacteristicValue, CharacteristicSetCallback } from 'homebridge';
import { TSVESyncPlatform } from '../../platform';
import { VeSync } from 'tsvesync';
import { VeSyncFan } from '../../types/device.types';
import { RetryManager } from '../../utils/retry';
import { FanAccessory } from '../../accessories/fan.accessory';
import { createMockFan } from '../utils/test-helpers';

describe('Fan Device Tests', () => {
  let mockAPI: jest.Mocked<API>;
  let platform: TSVESyncPlatform;
  let logger: jest.Mocked<Logger>;
  let api: jest.Mocked<VeSync>;

  beforeEach(() => {
    mockAPI = {
      hap: {
        Characteristic: {
          Active: jest.fn(),
          RotationSpeed: jest.fn(),
          RotationDirection: jest.fn(),
          SwingMode: jest.fn(),
          LockPhysicalControls: jest.fn(),
          Manufacturer: jest.fn(),
          Model: jest.fn(),
          SerialNumber: jest.fn(),
        },
        Service: {
          Fanv2: jest.fn(),
          AccessoryInformation: jest.fn(),
        },
        uuid: {
          generate: jest.fn(),
        },
      },
      platformAccessory: jest.fn(),
    } as any;

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    api = {
      login: jest.fn(),
      getDevices: jest.fn(),
    } as any;

    platform = new TSVESyncPlatform(logger, {} as any, mockAPI);
    (platform as any).api = api;
  });

  describe('fan state management', () => {
    let fan: FanAccessory;
    let mockFan: jest.Mocked<VeSyncFan>;
    let accessory: any;
    let handlers: { [key: string]: (value: CharacteristicValue) => Promise<void> } = {};
    let infoService: any;
    let fanService: any;

    beforeEach(() => {
      mockFan = createMockFan({
        deviceName: 'Test Fan',
        deviceType: 'LTF-F422',
        cid: 'test-cid',
        uuid: 'test-uuid',
      });

      // Create mock services
      infoService = {
        setCharacteristic: jest.fn().mockReturnThis(),
      };

      // Create mock fan service with handler capture
      fanService = {
        getCharacteristic: jest.fn().mockImplementation((char) => ({
          onSet: jest.fn((fn) => {
            if (char === platform.Characteristic.Active) {
              handlers.setActive = fn;
            } else if (char === platform.Characteristic.RotationSpeed) {
              handlers.setRotationSpeed = fn;
            } else if (char === platform.Characteristic.RotationDirection) {
              handlers.setRotationDirection = fn;
            } else if (char === platform.Characteristic.SwingMode) {
              handlers.setSwingMode = fn;
            } else if (char === platform.Characteristic.LockPhysicalControls) {
              handlers.setLockPhysicalControls = fn;
            }
            return { onGet: jest.fn() };
          }),
          onGet: jest.fn(),
        })),
      };

      // Create mock accessory
      accessory = {
        getService: jest.fn((service) => {
          if (service === platform.Service.AccessoryInformation) {
            return infoService;
          }
          if (service === platform.Service.Fanv2) {
            return fanService;
          }
          return null;
        }),
        addService: jest.fn((service) => {
          if (service === platform.Service.Fanv2) {
            return fanService;
          }
          return null;
        }),
      };

      fan = new FanAccessory(platform, accessory, mockFan);
    });

    it('should handle power state changes', async () => {
      expect(handlers.setActive).toBeDefined();
      await handlers.setActive(1);
      expect(mockFan.turnOn).toHaveBeenCalled();

      await handlers.setActive(0);
      expect(mockFan.turnOff).toHaveBeenCalled();
    });

    it('should handle fan speed changes', async () => {
      expect(handlers.setRotationSpeed).toBeDefined();
      await handlers.setRotationSpeed(50);
      expect(mockFan.changeFanSpeed).toHaveBeenCalledWith(3); // 50% maps to speed 3
    });

    it('should handle rotation direction changes', async () => {
      expect(handlers.setRotationDirection).toBeDefined();
      await handlers.setRotationDirection(1); // CLOCKWISE
      expect(mockFan.setRotationDirection).toHaveBeenCalledWith('clockwise');

      await handlers.setRotationDirection(0); // COUNTER_CLOCKWISE
      expect(mockFan.setRotationDirection).toHaveBeenCalledWith('counterclockwise');
    });

    it('should handle swing mode changes', async () => {
      expect(handlers.setSwingMode).toBeDefined();
      await handlers.setSwingMode(1); // SWING_ENABLED
      expect(mockFan.setSwingMode).toHaveBeenCalledWith(true);

      await handlers.setSwingMode(0); // SWING_DISABLED
      expect(mockFan.setSwingMode).toHaveBeenCalledWith(false);
    });

    it('should handle child lock changes', async () => {
      expect(handlers.setLockPhysicalControls).toBeDefined();
      await handlers.setLockPhysicalControls(1); // CONTROL_LOCK_ENABLED
      expect(mockFan.setChildLock).toHaveBeenCalledWith(true);

      await handlers.setLockPhysicalControls(0); // CONTROL_LOCK_DISABLED
      expect(mockFan.setChildLock).toHaveBeenCalledWith(false);
    });
  });
}); 