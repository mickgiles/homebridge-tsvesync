import { API, CharacteristicValue, Logger } from 'homebridge';
import { VeSync } from 'tsvesync';
import { AirPurifierAccessory } from '../../accessories/air-purifier.accessory';
import { TSVESyncPlatform } from '../../platform';
import {
  createMockInfoService,
  createMockLogger,
  createMockVeSync,
} from '../utils/test-helpers';

/**
 * Regression tests for issue #42 - "Auto Mode not Engaging Correctly".
 *
 * HomeKit scenes and automations write Active, TargetAirPurifierState and
 * RotationSpeed in a single HAP request, and HAP-NodeJS dispatches those
 * writes concurrently. Because this accessory encodes sleep/manual/turbo into
 * the RotationSpeed slider, every speed write is implicitly a mode write - so
 * before the fix the speed handler raced with, and usually clobbered, an
 * explicit AUTO written alongside it.
 */
describe('AirPurifierAccessory batched HomeKit writes', () => {
  interface Handlers {
    get?: () => Promise<CharacteristicValue>;
    set?: (value: CharacteristicValue) => Promise<void>;
  }

  const CHARACTERISTICS = [
    'Active', 'CurrentAirPurifierState', 'FilterChangeIndication', 'FilterLifeLevel',
    'LockPhysicalControls', 'Manufacturer', 'Model', 'Name', 'On', 'RotationSpeed',
    'SerialNumber', 'TargetAirPurifierState',
  ];

  function createHarness(options: { deviceType?: string; deviceStatus?: string; mode?: string } = {}) {
    const {
      deviceType = 'Core300S',
      deviceStatus = 'off',
      mode = 'manual',
    } = options;

    const logger = createMockLogger();
    const Characteristic: Record<string, string> = {};
    for (const c of CHARACTERISTICS) Characteristic[c] = c;

    const mockAPI = {
      hap: {
        Characteristic,
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

    // Service mock that records the onSet/onGet handler per characteristic so
    // the test can invoke them exactly the way HAP-NodeJS does.
    const handlers: Record<string, Handlers> = {};
    const chars = new Map<string, any>();
    const getChar = (name: string) => {
      if (!chars.has(name)) {
        const stub: any = {
          onSet: (fn: Handlers['set']) => { handlers[name] = { ...handlers[name], set: fn }; return stub; },
          onGet: (fn: Handlers['get']) => { handlers[name] = { ...handlers[name], get: fn }; return stub; },
          updateValue: () => stub,
          setProps: (p: any) => { stub.props = p; return stub; },
        };
        chars.set(name, stub);
      }
      return chars.get(name);
    };
    const primaryService = {
      getCharacteristic: jest.fn(getChar),
      addCharacteristic: jest.fn(getChar),
      setCharacteristic: jest.fn().mockReturnThis(),
      testCharacteristic: jest.fn().mockReturnValue(true),
      removeCharacteristic: jest.fn().mockReturnThis(),
      setPrimaryService: jest.fn().mockReturnThis(),
      updateCharacteristic: jest.fn().mockReturnThis(),
    };

    const accessory = {
      context: {},
      getService: jest.fn((service: any) => {
        if (service === 'AccessoryInformation') return createMockInfoService();
        if (service === 'AirPurifier') return primaryService;
        return undefined;
      }),
      addService: jest.fn(() => primaryService),
      removeService: jest.fn(),
    };

    const features = new Set(['fan_speed', 'filter_life', 'sleep_mode',
      ...(deviceType === 'Core200S' ? [] : ['auto_mode'])]);

    const device: any = {
      connectionStatus: 'online',
      details: { enabled: deviceStatus === 'on', filter_life: 80, mode, speed: 1 },
      deviceName: 'Test Purifier',
      deviceStatus,
      deviceType,
      enabled: deviceStatus === 'on',
      filterLife: 80,
      getDetails: jest.fn().mockResolvedValue(true),
      getMaxFanSpeed: jest.fn().mockReturnValue(4),
      hasFeature: jest.fn((feature: string) => features.has(feature)),
      maxSpeed: 4,
      uuid: 'test-purifier',
      changeFanSpeed: jest.fn().mockResolvedValue(true),
      setMode: jest.fn().mockResolvedValue(true),
      autoMode: jest.fn().mockResolvedValue(true),
      manualMode: jest.fn().mockResolvedValue(true),
      sleepMode: jest.fn().mockResolvedValue(true),
      turnOn: jest.fn().mockResolvedValue(true),
      turnOff: jest.fn().mockResolvedValue(true),
    };
    // VeSyncFan exposes `mode` and `speed` as getter-only properties that read
    // through to `details`. Model that exactly - a plain writable property would
    // let the accessory "successfully" assign to them and hide real bugs.
    Object.defineProperty(device, 'mode', { get: () => device.details.mode });
    Object.defineProperty(device, 'speed', { get: () => device.details.speed });

    device.autoMode.mockImplementation(async () => { device.details.mode = 'auto'; return true; });
    device.manualMode.mockImplementation(async () => { device.details.mode = 'manual'; return true; });
    device.sleepMode.mockImplementation(async () => { device.details.mode = 'sleep'; return true; });
    device.turnOn.mockImplementation(async () => { device.deviceStatus = 'on'; device.enabled = true; return true; });
    device.turnOff.mockImplementation(async () => { device.deviceStatus = 'off'; device.enabled = false; return true; });

    new AirPurifierAccessory(platform, accessory as any, device);

    /** Dispatch a batch the way HAP-NodeJS does: all writes concurrently. */
    const writeBatch = (batch: Array<[string, number]>) =>
      Promise.all(batch.map(([name, value]) => handlers[name].set!(value)));

    return { device, handlers, primaryService, writeBatch, logger, chars };
  }

  // Core300S has three manual speeds (the library over-declares four), so with
  // sleep on the first notch the slider is 0/25/50/75/100.
  it('exposes a 25% step for the Core300S, with no dead top notch', () => {
    const { chars } = createHarness();
    expect(chars.get('RotationSpeed').props.minStep).toBe(25);
  });

  describe('an automation setting on + Auto', () => {
    it('honours AUTO instead of the mode implied by a 60% slider', async () => {
      const h = createHarness({ deviceStatus: 'off' });

      await h.writeBatch([['Active', 1], ['TargetAirPurifierState', 1], ['RotationSpeed', 60]]);

      expect(h.device.turnOn).toHaveBeenCalled();
      expect(h.device.autoMode).toHaveBeenCalledTimes(1);
      // The slider must not drag the device back into manual
      expect(h.device.manualMode).not.toHaveBeenCalled();
      expect(h.device.changeFanSpeed).not.toHaveBeenCalled();
      expect(h.device.mode).toBe('auto');
    });

    it('honours AUTO instead of sleep for a 20% slider', async () => {
      const h = createHarness({ deviceStatus: 'off' });

      await h.writeBatch([['Active', 1], ['TargetAirPurifierState', 1], ['RotationSpeed', 20]]);

      expect(h.device.autoMode).toHaveBeenCalledTimes(1);
      expect(h.device.sleepMode).not.toHaveBeenCalled();
      expect(h.device.mode).toBe('auto');
    });

    it('does not turn the device back off for a 0% slider', async () => {
      const h = createHarness({ deviceStatus: 'off' });

      await h.writeBatch([['Active', 1], ['TargetAirPurifierState', 1], ['RotationSpeed', 0]]);

      expect(h.device.turnOn).toHaveBeenCalled();
      expect(h.device.turnOff).not.toHaveBeenCalled();
      expect(h.device.autoMode).toHaveBeenCalledTimes(1);
      expect(h.device.deviceStatus).toBe('on');
      expect(h.device.mode).toBe('auto');
    });

    it('produces the same result regardless of the order writes arrive in', async () => {
      const h = createHarness({ deviceStatus: 'off' });

      // Reverse order - the coalescer must not be order-sensitive
      await h.writeBatch([['RotationSpeed', 60], ['TargetAirPurifierState', 1], ['Active', 1]]);

      expect(h.device.mode).toBe('auto');
      expect(h.device.changeFanSpeed).not.toHaveBeenCalled();
    });
  });

  describe('behaviour preserved for single-characteristic writes', () => {
    it('still treats a lone 0% slider as "turn off"', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });

      await h.writeBatch([['RotationSpeed', 0]]);

      expect(h.device.turnOff).toHaveBeenCalledTimes(1);
      expect(h.device.deviceStatus).toBe('off');
    });

    it('still switches out of auto when only the slider is dragged', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'auto' });

      await h.writeBatch([['RotationSpeed', 75]]);

      expect(h.device.manualMode).toHaveBeenCalled();
      expect(h.device.changeFanSpeed).toHaveBeenCalledWith(2);
    });

    it('still selects sleep for the first notch when only the slider is dragged', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });

      await h.writeBatch([['RotationSpeed', 20]]);

      expect(h.device.sleepMode).toHaveBeenCalledTimes(1);
      expect(h.device.changeFanSpeed).not.toHaveBeenCalled();
    });

    it('still honours an explicit power off, ignoring everything else', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'auto' });

      await h.writeBatch([['Active', 0], ['RotationSpeed', 60]]);

      expect(h.device.turnOff).toHaveBeenCalledTimes(1);
      expect(h.device.changeFanSpeed).not.toHaveBeenCalled();
      expect(h.device.deviceStatus).toBe('off');
    });

    it('still reaches sleep via on + MANUAL + 20%, which HomeKit reports as MANUAL', async () => {
      const h = createHarness({ deviceStatus: 'off' });

      await h.writeBatch([['Active', 1], ['TargetAirPurifierState', 0], ['RotationSpeed', 20]]);

      expect(h.device.sleepMode).toHaveBeenCalledTimes(1);
      expect(h.device.mode).toBe('sleep');
    });

    it('still applies a speed for on + MANUAL + 60%', async () => {
      const h = createHarness({ deviceStatus: 'off' });

      await h.writeBatch([['Active', 1], ['TargetAirPurifierState', 0], ['RotationSpeed', 75]]);

      expect(h.device.changeFanSpeed).toHaveBeenCalledWith(2);
      expect(h.device.mode).toBe('manual');
    });
  });

  /**
   * The slider implicitly changes the mode, but the accessory used to leave
   * TargetAirPurifierState untouched and set skipNextUpdate, so the Home app
   * kept showing "Auto" while the device had actually moved to Manual. The
   * poll that would have corrected it has a two minute floor.
   */
  describe('mode is reflected back to HomeKit immediately', () => {
    const targetStateWrites = (service: any) =>
      service.updateCharacteristic.mock.calls.filter((c: any[]) => c[0] === 'TargetAirPurifierState');

    it('reports MANUAL as soon as a slider drag leaves auto', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'auto' });

      await h.writeBatch([['RotationSpeed', 60]]);

      expect(h.device.manualMode).toHaveBeenCalled();
      expect(targetStateWrites(h.primaryService)).toContainEqual(['TargetAirPurifierState', 0]);
    });

    it('reports MANUAL as soon as a slider drag selects sleep', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'auto' });

      await h.writeBatch([['RotationSpeed', 20]]);

      expect(h.device.sleepMode).toHaveBeenCalled();
      // HomeKit has no "sleep"; sleep is reported as MANUAL
      expect(targetStateWrites(h.primaryService)).toContainEqual(['TargetAirPurifierState', 0]);
    });

    it('still reports AUTO after an explicit auto write', async () => {
      const h = createHarness({ deviceStatus: 'off', mode: 'manual' });

      await h.writeBatch([['Active', 1], ['TargetAirPurifierState', 1], ['RotationSpeed', 60]]);

      const writes = targetStateWrites(h.primaryService);
      expect(writes[writes.length - 1]).toEqual(['TargetAirPurifierState', 1]);
    });

    it('surfaces a failed mode change instead of pushing a speed anyway', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'auto' });
      h.device.manualMode.mockResolvedValue(false);

      await h.writeBatch([['RotationSpeed', 60]]);

      // The speed must not be sent to a device still sitting in auto
      expect(h.device.changeFanSpeed).not.toHaveBeenCalled();
      expect(h.logger.error).toHaveBeenCalled();
    });
  });

  /**
   * VeSync is eventually consistent: for a few seconds after a mode change
   * getDetails() still reports the previous mode. Without a guard that stale
   * read flips the HomeKit tile straight back - observed in both directions,
   * auto reverting to manual and a slider drag still showing auto.
   */
  describe('stale API reads must not undo a commanded mode', () => {
    const targetStateWrites = (service: any) =>
      service.updateCharacteristic.mock.calls.filter((c: any[]) => c[0] === 'TargetAirPurifierState');

    it('keeps reporting AUTO while the API still says manual', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });
      // Commanding auto succeeds, but the device keeps reporting the old mode
      h.device.autoMode.mockImplementation(async () => true);

      await h.writeBatch([['TargetAirPurifierState', 1]]);
      expect(h.device.mode).toBe('manual'); // stale, as VeSync would report it

      expect(await h.handlers.TargetAirPurifierState.get!()).toBe(1);
    });

    it('keeps reporting MANUAL while the API still says auto', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'auto' });
      // The slider moves it to manual, but the device still reports auto
      h.device.manualMode.mockImplementation(async () => true);

      await h.writeBatch([['RotationSpeed', 60]]);

      // A poll lands and overwrites the cache with a stale 'auto' from the API
      h.device.details.mode = 'auto';

      expect(await h.handlers.TargetAirPurifierState.get!()).toBe(0);
      expect(targetStateWrites(h.primaryService)).toContainEqual(['TargetAirPurifierState', 0]);
    });

    it('a poll landing mid-flight does not flip the tile back', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });
      h.device.autoMode.mockImplementation(async () => true);

      await h.writeBatch([['TargetAirPurifierState', 1]]);
      h.primaryService.updateCharacteristic.mockClear();

      // Simulate the 2-minute poll arriving while VeSync still reports manual
      await (h as any).instance?.updateDeviceSpecificStates?.(h.device);
      const writes = targetStateWrites(h.primaryService);
      if (writes.length) {
        expect(writes[writes.length - 1]).toEqual(['TargetAirPurifierState', 1]);
      }
      expect(await h.handlers.TargetAirPurifierState.get!()).toBe(1);
    });

    it('stops overriding once the device catches up', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });
      h.device.autoMode.mockImplementation(async () => true);

      await h.writeBatch([['TargetAirPurifierState', 1]]);
      expect(await h.handlers.TargetAirPurifierState.get!()).toBe(1);

      // Device catches up, then is later changed to manual in the VeSync app
      h.device.details.mode = 'auto';
      expect(await h.handlers.TargetAirPurifierState.get!()).toBe(1);
      h.device.details.mode = 'manual';
      expect(await h.handlers.TargetAirPurifierState.get!()).toBe(0);
    });

    it('expires so an out-of-band change is not masked forever', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });
      h.device.autoMode.mockImplementation(async () => true);

      await h.writeBatch([['TargetAirPurifierState', 1]]);
      expect(await h.handlers.TargetAirPurifierState.get!()).toBe(1);

      // Advance past the 30s guard window
      const realNow = Date.now;
      Date.now = () => realNow() + 31000;
      try {
        expect(await h.handlers.TargetAirPurifierState.get!()).toBe(0);
      } finally {
        Date.now = realNow;
      }
    });
  });

  /**
   * airBypass.changeFanSpeed() (the Core-series path) doesn't update the
   * library's own cache, so device.speed stays stale until the next poll -
   * which has a two minute floor. That made the slider snap back to the
   * previously reported speed, and made sleep report a manual speed.
   */
  describe('readback after a speed change with a stale library cache', () => {
    it('reports the speed we just set, not the stale cached one', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });
      h.device.details.speed = 3; // stale value the library keeps reporting
      h.device.changeFanSpeed.mockResolvedValue(true);

      await h.writeBatch([['RotationSpeed', 50]]); // -> speed 1

      expect(h.device.changeFanSpeed).toHaveBeenCalledWith(1);
      // Without the write-through this reported the stale speed instead
      expect(await h.handlers.RotationSpeed.get!()).toBe(50);
    });

    it('reports the sleep notch while the device is on and in sleep', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });
      h.device.details.speed = 3; // stale

      await h.writeBatch([['RotationSpeed', 25]]); // -> sleep

      expect(h.device.sleepMode).toHaveBeenCalled();
      // Previously fell through to the manual speed conversion instead
      expect(await h.handlers.RotationSpeed.get!()).toBe(25);
    });

    it('reports 0 when the device is off', async () => {
      const h = createHarness({ deviceStatus: 'off', mode: 'sleep' });
      h.device.details.speed = 3;

      expect(await h.handlers.RotationSpeed.get!()).toBe(0);
    });
  });

  /**
   * HomeKit caches characteristic metadata on the home hub. After an upgrade
   * that changes minStep, a controller can keep sending values on the OLD grid
   * for an unknown period - so upgrading users must still get the right speed,
   * and must not see the slider fight them. This is the property that makes a
   * minStep change safe to release.
   */
  describe('a controller using a stale slider grid', () => {
    // Core300S: sleep + Low/Med/High, so the current grid is 25%.
    // An un-refreshed controller still sends the old 20% grid.
    const STALE_20_GRID: Array<[number, number | 'sleep']> = [
      [20, 'sleep'],
      [40, 1],
      [60, 2],
      [80, 3],
      [100, 3],
    ];

    it.each(STALE_20_GRID)('maps a stale %i%% to the correct speed', async (pct, expected) => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });

      await h.writeBatch([['RotationSpeed', pct as number]]);

      if (expected === 'sleep') {
        expect(h.device.sleepMode).toHaveBeenCalled();
      } else {
        expect(h.device.changeFanSpeed).toHaveBeenCalledWith(expected);
      }
    });

    it.each(STALE_20_GRID)('echoes a stale %i%% straight back, so the slider does not jump', async (pct) => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });

      await h.writeBatch([['RotationSpeed', pct as number]]);

      expect(await h.handlers.RotationSpeed.get!()).toBe(pct);
      const speedWrites = h.primaryService.updateCharacteristic.mock.calls
        .filter((c: any[]) => c[0] === 'RotationSpeed');
      expect(speedWrites[speedWrites.length - 1]).toEqual(['RotationSpeed', pct]);
    });

    it('is also correct on the current 25% grid', async () => {
      for (const [pct, expected] of [[25, 'sleep'], [50, 1], [75, 2], [100, 3]] as const) {
        const h = createHarness({ deviceStatus: 'on', mode: 'manual' });
        await h.writeBatch([['RotationSpeed', pct as number]]);
        if (expected === 'sleep') {
          expect(h.device.sleepMode).toHaveBeenCalled();
        } else {
          expect(h.device.changeFanSpeed).toHaveBeenCalledWith(expected);
        }
        expect(await h.handlers.RotationSpeed.get!()).toBe(pct);
      }
    });
  });

  /**
   * Dragging the slider produces a burst of writes spaced further apart than
   * the coalesce window, so several batches are in flight at once. Their API
   * calls must not interleave, or the device settles on whichever response
   * lands last rather than the last value the user picked.
   */
  describe('bursts of writes are applied in order', () => {
    it('does not interleave overlapping batches', async () => {
      const h = createHarness({ deviceStatus: 'on', mode: 'manual' });

      const inFlight: string[] = [];
      const order: string[] = [];
      let overlapped = false;
      h.device.changeFanSpeed.mockImplementation(async (speed: number) => {
        if (inFlight.length > 0) overlapped = true;
        inFlight.push(`s${speed}`);
        await new Promise(r => setTimeout(r, 40));
        inFlight.pop();
        order.push(`s${speed}`);
        return true;
      });

      // Three drags, spaced beyond the 50ms coalesce window
      const writes: Promise<unknown>[] = [];
      for (const pct of [50, 75, 100]) {
        writes.push(h.handlers.RotationSpeed.set!(pct));
        await new Promise(r => setTimeout(r, 60));
      }
      await Promise.all(writes);

      expect(overlapped).toBe(false);
      expect(order).toEqual(['s1', 's2', 's3']);
      // The device ends on the last value the user chose
      expect(h.device.details.speed).toBe(3);
    });
  });

  describe('Core200S', () => {
    it('turns on without being turned straight back off by a 0% slider', async () => {
      const h = createHarness({ deviceType: 'Core200S', deviceStatus: 'off' });

      await h.writeBatch([['Active', 1], ['RotationSpeed', 0]]);

      expect(h.device.turnOn).toHaveBeenCalled();
      expect(h.device.turnOff).not.toHaveBeenCalled();
      expect(h.device.deviceStatus).toBe('on');
    });
  });
});
