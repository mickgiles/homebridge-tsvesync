import { API, CharacteristicValue, Logger } from 'homebridge';
import { VeSync } from 'tsvesync';
import { AirPurifierAccessory } from '../../accessories/air-purifier.accessory';
import { TSVESyncPlatform } from '../../platform';
import {
  createMockInfoService,
  createMockLogger,
  createMockService,
  createMockVeSync,
} from '../utils/test-helpers';

interface ChildLockHarnessOptions {
  childLockFeature?: boolean;
  hasSetter?: boolean;
  initialLock?: boolean;
  cachedCharacteristic?: boolean;
  nativeHasFeature?: boolean;
}

interface LockHandlers {
  get?: () => Promise<CharacteristicValue>;
  set?: (value: CharacteristicValue) => Promise<void>;
}

describe('AirPurifierAccessory child lock (issue #44)', () => {
  function createHarness(options: ChildLockHarnessOptions = {}) {
    const {
      childLockFeature = true,
      hasSetter = true,
      initialLock = false,
      cachedCharacteristic = false,
      nativeHasFeature = true,
    } = options;
    const logger = createMockLogger();
    const api = createMockVeSync();
    const mockAPI = {
      hap: {
        Characteristic: {
          Active: 'Active',
          CurrentAirPurifierState: 'CurrentAirPurifierState',
          FilterChangeIndication: 'FilterChangeIndication',
          FilterLifeLevel: 'FilterLifeLevel',
          LockPhysicalControls: 'LockPhysicalControls',
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
        uuid: {
          generate: jest.fn(),
        },
      },
      platformAccessory: jest.fn(),
      updatePlatformAccessories: jest.fn(),
    } as unknown as jest.Mocked<API>;
    const platform = new TSVESyncPlatform(logger as jest.Mocked<Logger>, {} as any, mockAPI);
    (platform as any).api = mockAPI;
    (platform as any).client = api as jest.Mocked<VeSync>;

    const lockHandlers: LockHandlers = {};
    const lockCharacteristic = {
      onGet: jest.fn((handler: LockHandlers['get']) => {
        lockHandlers.get = handler;
        return lockCharacteristic;
      }),
      onSet: jest.fn((handler: LockHandlers['set']) => {
        lockHandlers.set = handler;
        return lockCharacteristic;
      }),
      setProps: jest.fn().mockReturnThis(),
      updateValue: jest.fn().mockReturnThis(),
    };
    const defaultCharacteristic = {
      onGet: jest.fn().mockReturnThis(),
      onSet: jest.fn().mockReturnThis(),
      setProps: jest.fn().mockReturnThis(),
      updateValue: jest.fn().mockReturnThis(),
    };
    const primaryService = {
      ...createMockService(),
      getCharacteristic: jest.fn((characteristic: any) =>
        characteristic === 'LockPhysicalControls' ? lockCharacteristic : defaultCharacteristic
      ),
      testCharacteristic: jest.fn().mockReturnValue(cachedCharacteristic),
      removeCharacteristic: jest.fn(),
      updateCharacteristic: jest.fn().mockReturnThis(),
    };
    const infoService = createMockInfoService();

    const accessory = {
      context: {},
      getService: jest.fn((service: any) => {
        if (service === mockAPI.hap.Service.AccessoryInformation) return infoService;
        if (service === mockAPI.hap.Service.AirPurifier) return primaryService;
        return undefined;
      }),
      addService: jest.fn(() => primaryService),
      removeService: jest.fn(),
    };

    const features = new Set([
      'fan_speed',
      'filter_life',
      'auto_mode',
      ...(childLockFeature ? ['child_lock'] : []),
    ]);
    const device: any = {
      changeFanSpeed: jest.fn().mockResolvedValue(true),
      childLock: initialLock,
      connectionStatus: 'online',
      details: {
        child_lock: initialLock,
        enabled: true,
        filter_life: 80,
        mode: 'manual',
        speed: 2,
      },
      deviceName: 'Core Test Unit',
      deviceStatus: 'on',
      deviceType: 'Core300S',
      enabled: true,
      filterLife: 80,
      getDetails: jest.fn().mockResolvedValue(true),
      getMaxFanSpeed: jest.fn().mockReturnValue(3),
      hasFeature: jest.fn((feature: string) => features.has(feature)),
      maxSpeed: 3,
      mode: 'manual',
      setMode: jest.fn().mockResolvedValue(true),
      speed: 2,
      turnOff: jest.fn().mockResolvedValue(true),
      turnOn: jest.fn().mockResolvedValue(true),
      uuid: 'core-test-unit',
    };
    if (hasSetter) {
      device.setChildLock = jest.fn().mockImplementation(async (enabled: boolean) => {
        device.childLock = enabled;
        device.details.child_lock = enabled;
        return true;
      });
    }
    if (!nativeHasFeature) {
      delete device.hasFeature;
    }

    const instance = new AirPurifierAccessory(platform, accessory as any, device);

    return {
      accessory,
      device,
      instance,
      lockCharacteristic,
      lockHandlers,
      logger,
      primaryService,
    };
  }

  it('registers LockPhysicalControls when the device supports child lock', () => {
    const harness = createHarness();

    expect(harness.lockCharacteristic.onGet).toHaveBeenCalled();
    expect(harness.lockCharacteristic.onSet).toHaveBeenCalled();
  });

  it('does not register the characteristic when the setter is missing', () => {
    const harness = createHarness({ hasSetter: false });

    expect(harness.lockCharacteristic.onGet).not.toHaveBeenCalled();
    expect(harness.lockCharacteristic.onSet).not.toHaveBeenCalled();
  });

  it('does not register the characteristic when the feature is absent', () => {
    const harness = createHarness({ childLockFeature: false });

    expect(harness.lockCharacteristic.onGet).not.toHaveBeenCalled();
    expect(harness.lockCharacteristic.onSet).not.toHaveBeenCalled();
  });

  it('removes a stale cached characteristic when unsupported', () => {
    const harness = createHarness({ hasSetter: false, cachedCharacteristic: true });

    expect(harness.primaryService.removeCharacteristic).toHaveBeenCalledWith(harness.lockCharacteristic);
  });

  it('falls back to setter detection when the device has no native hasFeature', () => {
    const withSetter = createHarness({ nativeHasFeature: false });
    expect(withSetter.lockCharacteristic.onGet).toHaveBeenCalled();
    expect(withSetter.lockCharacteristic.onSet).toHaveBeenCalled();

    const withoutSetter = createHarness({ nativeHasFeature: false, hasSetter: false });
    expect(withoutSetter.lockCharacteristic.onGet).not.toHaveBeenCalled();
    expect(withoutSetter.lockCharacteristic.onSet).not.toHaveBeenCalled();
  });

  it('reports the current lock state', async () => {
    const unlocked = createHarness();
    expect(await unlocked.lockHandlers.get!()).toBe(0);

    const locked = createHarness({ initialLock: true });
    expect(await locked.lockHandlers.get!()).toBe(1);
  });

  it('falls back to details.child_lock when the getter is undefined', async () => {
    const harness = createHarness();
    harness.device.childLock = undefined;
    harness.device.details.child_lock = true;

    expect(await harness.lockHandlers.get!()).toBe(1);
  });

  it('enables and disables the lock through the device API', async () => {
    const harness = createHarness();

    await harness.lockHandlers.set!(1);
    expect(harness.device.setChildLock).toHaveBeenCalledWith(true);
    expect(await harness.lockHandlers.get!()).toBe(1);

    await harness.lockHandlers.set!(0);
    expect(harness.device.setChildLock).toHaveBeenCalledWith(false);
    expect(await harness.lockHandlers.get!()).toBe(0);
  });

  it('persists the lock state under the tsvesync details key', async () => {
    const harness = createHarness();

    await harness.lockHandlers.set!(1);

    expect((harness.accessory.context as any).device.details.child_lock).toBe(true);
  });

  it('rejects failed writes so HomeKit can restore its state', async () => {
    const harness = createHarness();
    harness.device.setChildLock.mockResolvedValue(false);

    await expect(harness.lockHandlers.set!(1))
      .rejects.toThrow('Failed to enable child lock');
    expect(harness.logger.error).toHaveBeenCalled();
  });

  it('pushes the polled lock state into HomeKit', async () => {
    const harness = createHarness({ initialLock: true });

    await (harness.instance as any).updateDeviceSpecificStates(harness.device);

    expect(harness.primaryService.updateCharacteristic).toHaveBeenCalledWith(
      'LockPhysicalControls',
      1
    );
  });

  it('does not push lock state for devices without child lock', async () => {
    const harness = createHarness({ hasSetter: false });

    await (harness.instance as any).updateDeviceSpecificStates(harness.device);

    expect(harness.primaryService.updateCharacteristic).not.toHaveBeenCalledWith(
      'LockPhysicalControls',
      expect.anything()
    );
  });
});
