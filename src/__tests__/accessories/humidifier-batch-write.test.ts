import { API, CharacteristicValue, Logger } from 'homebridge';
import { VeSync } from 'tsvesync';
import { HumidifierAccessory } from '../../accessories/humidifier.accessory';
import { TSVESyncPlatform } from '../../platform';
import {
  createMockInfoService,
  createMockLogger,
  createMockVeSync,
} from '../utils/test-helpers';

/**
 * Companion to air-purifier-batch-write.test.ts for issue #42. The humidifier
 * has the same concurrent-write hazard: HomeKit sends Active,
 * TargetHumidifierDehumidifierState and RotationSpeed in one HAP request, and
 * a 0% mist slider used to turn the device straight back off.
 */
describe('HumidifierAccessory batched HomeKit writes', () => {
  interface Handlers {
    get?: () => Promise<CharacteristicValue>;
    set?: (value: CharacteristicValue) => Promise<void>;
  }

  const CHARACTERISTICS = [
    'Active', 'Brightness', 'CurrentHumidifierDehumidifierState', 'CurrentRelativeHumidity',
    'CurrentTemperature', 'FilterChangeIndication', 'FilterLifeLevel', 'LockPhysicalControls',
    'Manufacturer', 'Model', 'Name', 'On', 'RelativeHumidityHumidifierThreshold',
    'RotationSpeed', 'SerialNumber', 'TargetHumidifierDehumidifierState', 'WaterLevel',
  ];

  function createHarness(options: { deviceStatus?: string; mode?: string } = {}) {
    const { deviceStatus = 'off', mode = 'manual' } = options;

    const logger = createMockLogger();
    const Characteristic: Record<string, string> = {};
    for (const c of CHARACTERISTICS) Characteristic[c] = c;

    const mockAPI = {
      hap: {
        Characteristic,
        Service: {
          AccessoryInformation: 'AccessoryInformation',
          HumidifierDehumidifier: 'HumidifierDehumidifier',
          FilterMaintenance: 'FilterMaintenance',
          Lightbulb: 'Lightbulb',
          TemperatureSensor: 'TemperatureSensor',
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
        if (service === 'HumidifierDehumidifier') return primaryService;
        return undefined;
      }),
      addService: jest.fn(() => primaryService),
      removeService: jest.fn(),
    };

    const device: any = {
      connectionStatus: 'online',
      details: { enabled: deviceStatus === 'on', mode, humidity: 40, mist_virtual_level: 3 },
      deviceName: 'Test Humidifier',
      deviceStatus,
      deviceType: 'LUH-A601S-WUSB',
      enabled: deviceStatus === 'on',
      mode,
      mistLevel: 3,
      humidity: 40,
      uuid: 'test-humidifier',
      getDetails: jest.fn().mockResolvedValue(true),
      hasFeature: jest.fn(() => true),
      changeFanSpeed: jest.fn().mockResolvedValue(true),
      setMistLevel: jest.fn().mockResolvedValue(true),
      setMode: jest.fn().mockResolvedValue(true),
      setAutoMode: jest.fn().mockResolvedValue(true),
      setManualMode: jest.fn().mockResolvedValue(true),
      setHumidity: jest.fn().mockResolvedValue(true),
      turnOn: jest.fn().mockResolvedValue(true),
      turnOff: jest.fn().mockResolvedValue(true),
    };
    device.setAutoMode.mockImplementation(async () => { device.mode = 'auto'; device.details.mode = 'auto'; return true; });
    device.setManualMode.mockImplementation(async () => { device.mode = 'manual'; device.details.mode = 'manual'; return true; });
    device.turnOn.mockImplementation(async () => { device.deviceStatus = 'on'; device.enabled = true; return true; });
    device.turnOff.mockImplementation(async () => { device.deviceStatus = 'off'; device.enabled = false; return true; });

    new HumidifierAccessory(platform, accessory as any, device);

    const writeBatch = (batch: Array<[string, number]>) =>
      Promise.all(batch.map(([name, value]) => handlers[name].set!(value)));

    return { device, handlers, primaryService, writeBatch, logger };
  }

  it('does not turn the device back off when a 0% slider accompanies "on"', async () => {
    const h = createHarness({ deviceStatus: 'off' });

    await h.writeBatch([['Active', 1], ['RotationSpeed', 0]]);

    expect(h.device.turnOn).toHaveBeenCalled();
    expect(h.device.turnOff).not.toHaveBeenCalled();
    expect(h.device.deviceStatus).toBe('on');
  });

  it('honours an explicit auto request over the mist slider', async () => {
    const h = createHarness({ deviceStatus: 'off', mode: 'manual' });

    // TargetHumidifierDehumidifierState 0 == auto for this device
    await h.writeBatch([['Active', 1], ['TargetHumidifierDehumidifierState', 0], ['RotationSpeed', 60]]);

    expect(h.device.setAutoMode).toHaveBeenCalledTimes(1);
    expect(h.device.setMistLevel).not.toHaveBeenCalled();
    expect(h.device.mode).toBe('auto');
  });

  it('still treats a lone 0% slider as "turn off"', async () => {
    const h = createHarness({ deviceStatus: 'on', mode: 'manual' });

    await h.writeBatch([['RotationSpeed', 0]]);

    expect(h.device.turnOff).toHaveBeenCalledTimes(1);
    expect(h.device.deviceStatus).toBe('off');
  });

  it('still applies a mist level for a lone slider write', async () => {
    const h = createHarness({ deviceStatus: 'on', mode: 'manual' });

    await h.writeBatch([['RotationSpeed', 60]]);

    expect(h.device.setMistLevel).toHaveBeenCalled();
    expect(h.device.turnOff).not.toHaveBeenCalled();
  });

  it('still honours an explicit power off, ignoring everything else', async () => {
    const h = createHarness({ deviceStatus: 'on', mode: 'auto' });

    await h.writeBatch([['Active', 0], ['RotationSpeed', 60]]);

    expect(h.device.turnOff).toHaveBeenCalledTimes(1);
    expect(h.device.setMistLevel).not.toHaveBeenCalled();
  });
});
