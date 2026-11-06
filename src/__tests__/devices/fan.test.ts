import { Characteristic, HAPStatus, Service, uuid } from 'hap-nodejs';
import * as hap from 'hap-nodejs';
import { PlatformAccessory } from 'homebridge/lib/platformAccessory';
import { CharacteristicValue } from 'homebridge';
import { VeSyncTowerFan } from 'tsvesync/dist/lib/fans/towerFan';
import { VeSync } from 'tsvesync/dist/lib/vesync';
import { LogLevel, setLogLevel } from 'tsvesync/dist/lib/logger';
import { FanAccessory } from '../../accessories/fan.accessory';
import { TSVESyncPlatform } from '../../platform';
import { VeSyncFan } from '../../types/device.types';
import { createRateLimitedVeSync } from '../../utils/api-proxy';
import { PluginLogger } from '../../utils/logger';
import { createMockLogger } from '../utils/test-helpers';
import { DeviceFactory } from '../../utils/device-factory';

class OfflineFan extends VeSyncTowerFan {
  requests: { method: string; data: any }[] = [];
  nextCode = 0;
  failMethod?: string;
  status = { powerSwitch: 1, workMode: 'normal', manualSpeedLevel: 3, fanSpeedLevel: 3,
    oscillationState: 0, oscillationSwitch: 0, screenState: 1, screenSwitch: 1, temperature: 780, timerRemain: 0 };
  constructor(model = 'LTF-F422S-WUS') {
    super({ deviceType: model, deviceName: 'Test Fan', cid: 'offline-cid', uuid: 'offline-uuid', configModule: 'offline', connectionStatus: 'online' },
      { accountId: 'offline', token: 'offline', timeZone: 'America/Chicago', debug: false } as unknown as VeSync);
  }
  protected async callApi(_endpoint: string, _httpMethod: string, body: any): Promise<[any, number]> {
    const { method, data } = body.payload;
    this.requests.push({ method, data });
    let result: any = {};
    if (method === 'getTowerFanStatus') result = { ...this.status };
    if (method === 'setTimer') result = { id: 10 };
    return [{ code: 0, result: { code: this.failMethod === method ? -1 : this.nextCode, result } }, 200];
  }
}

describe('Tower fan issue #5: real HAP services and real library requests', () => {
  beforeAll(() => setLogLevel(LogLevel.NONE));
  afterAll(() => setLogLevel(LogLevel.INFO));

  async function harness(options: { cached?: boolean; initialRefresh?: boolean; model?: string; device?: OfflineFan } = {}) {
    const device = options.device ?? new OfflineFan(options.model);
    if (options.initialRefresh !== false) await device.getDetails();
    device.requests = [];
    const accessory = new PlatformAccessory('Test Fan', uuid.generate(`issue5-${options.model ?? 'fan'}`));
    const warnings: any[] = [];
    accessory._associatedHAPAccessory.on('characteristic-warning', warning => warnings.push(warning));
    let legacyMode: Service | undefined;
    if (options.cached) {
      legacyMode = accessory.addService(Service.Switch, 'Fan Mode', 'fan-mode');
      accessory.addService(Service.Lightbulb, 'Display', 'display');
      const primary = accessory.addService(Service.Fanv2);
      primary.getCharacteristic(Characteristic.LockPhysicalControls);
      accessory.addService(Service.TemperatureSensor, 'Temperature', 'temperature')
        .updateCharacteristic(Characteristic.CurrentTemperature, 22);
    }
    const logger = createMockLogger();
    const platform = { Service, Characteristic, log: logger, config: { debug: false },
      api: { hap, updatePlatformAccessories: jest.fn() } } as unknown as TSVESyncPlatform;
    const fan = new FanAccessory(platform, accessory, device as unknown as VeSyncFan);
    const primary = accessory.getService(Service.Fanv2)!;
    const mode = (subtype: string) => accessory.getServiceById(Service.Switch, subtype)!;
    const write = (service: Service, characteristic: any, value: CharacteristicValue) => service.getCharacteristic(characteristic).handleSetRequest(value);
    const read = (service: Service, characteristic: any) => service.getCharacteristic(characteristic).handleGetRequest();
    const sync = () => (fan as any).updateDeviceSpecificStates(device);
    return { fan, device, accessory, platform, primary, mode, write, read, sync, warnings, legacyMode };
  }

  it.each(['LTF-F422S-WUS', 'LTF-F422S-WUSR', 'LTF-F422S-KEU', 'LTF-F422S-WJP', 'LTF-F422_WJP'])('routes %s to the fan accessory and exposes valid services', async model => {
    const h = await harness({ model });
    expect(DeviceFactory.getAccessoryCategory(model)).toBe(3); // FAN
    expect(DeviceFactory.createAccessory(h.platform, h.accessory, h.device as any)).toBeInstanceOf(FanAccessory);
    await h.sync();
    expect(h.accessory.services.filter(s => s.UUID === Service.Switch.UUID)).toHaveLength(5);
    expect(h.primary.testCharacteristic(Characteristic.LockPhysicalControls)).toBe(false);
    expect(h.accessory.getService(Service.TemperatureSensor)).toBeDefined();
    expect(h.warnings).toEqual([]);
  });

  it('upgrades cached display/lock controls and preserves the legacy mode service', async () => {
    const h = await harness({ cached: true });
    expect(h.mode('fan-mode')).toBe(h.legacyMode);
    expect(h.mode('fan-mode').getCharacteristic(Characteristic.Name).value).toBe('Turbo Mode');
    expect(h.accessory.getService(Service.Lightbulb)).toBeUndefined();
    expect(h.mode('display')).toBeDefined();
    expect(h.primary.testCharacteristic(Characteristic.LockPhysicalControls)).toBe(false);
    // Reconstructing from cache must not create duplicate services or handlers.
    new FanAccessory(h.platform, h.accessory, h.device as unknown as VeSyncFan);
    expect(h.accessory.services.filter(s => s.subtype === 'fan-mode')).toHaveLength(1);
    expect(h.accessory.services.filter(s => s.subtype === 'display')).toHaveLength(1);
  });

  it('uses the right oscillation command in both directions and synchronizes legacy direction', async () => {
    const h = await harness();
    await h.write(h.primary, Characteristic.SwingMode, 1);
    expect(h.device.requests).toEqual([{ method: 'setOscillationSwitch', data: { oscillationSwitch: 1 } }]);
    expect(await h.read(h.primary, Characteristic.RotationDirection)).toBe(Characteristic.RotationDirection.CLOCKWISE);
    await h.write(h.primary, Characteristic.RotationDirection, Characteristic.RotationDirection.COUNTER_CLOCKWISE);
    expect(h.device.requests[1]).toEqual({ method: 'setOscillationSwitch', data: { oscillationSwitch: 0 } });
    expect(await h.read(h.primary, Characteristic.SwingMode)).toBe(0);
    expect(h.primary.getCharacteristic(Characteristic.SwingMode).value).toBe(0);
  });

  it('sends binary display values and reports the configured switch even when the panel is asleep', async () => {
    const h = await harness();
    for (const enabled of [false, true]) {
      await h.write(h.mode('display'), Characteristic.On, enabled);
      expect(h.device.requests[h.device.requests.length - 1]).toEqual({ method: 'setDisplay', data: { screenSwitch: Number(enabled) } });
      expect(await h.read(h.mode('display'), Characteristic.On)).toBe(enabled);
    }
    h.device.status.screenState = 0;
    await h.device.getDetails();
    await h.sync();
    expect(await h.read(h.mode('display'), Characteristic.On)).toBe(true);
    expect(h.mode('display').testCharacteristic(Characteristic.Brightness)).toBe(false);
  });

  it.each([['fan-mode', 'turbo'], ['auto-mode', 'auto'], ['sleep-mode', 'advancedSleep']])('makes %s a boolean mode switch', async (subtype, wireMode) => {
    const h = await harness();
    await h.write(h.mode(subtype), Characteristic.On, true);
    expect(h.device.requests).toEqual([{ method: 'setTowerFanMode', data: { workMode: wireMode } }]);
    for (const other of ['fan-mode', 'auto-mode', 'sleep-mode']) expect(await h.read(h.mode(other), Characteristic.On)).toBe(other === subtype);
    await h.write(h.mode(subtype), Characteristic.On, false);
    expect(h.device.mode).toBe('normal');
    expect(h.device.requests[1]).toEqual({ method: 'setTowerFanMode', data: { workMode: 'normal' } });
    expect(await h.read(h.mode(subtype), Characteristic.On)).toBe(false);
  });

  it('does not change modes when an inactive mode switch is turned off', async () => {
    const h = await harness();
    await h.write(h.mode('fan-mode'), Characteristic.On, true);
    h.device.requests = [];
    await h.write(h.mode('sleep-mode'), Characteristic.On, false);
    expect(h.device.mode).toBe('turbo');
    expect(h.device.requests).toEqual([]);
  });

  it('round-trips all 12 speed levels without duplicate top positions', async () => {
    const h = await harness();
    for (let level = 1; level <= 12; level++) {
      const percent = Math.round(level / 12 * 100);
      await h.write(h.primary, Characteristic.RotationSpeed, percent);
      expect(h.device.speed).toBe(level);
      expect(await h.read(h.primary, Characteristic.RotationSpeed)).toBe(percent);
    }
    await h.write(h.primary, Characteristic.RotationSpeed, 0);
    expect(h.device.deviceStatus).toBe('off');
    expect(await h.read(h.primary, Characteristic.RotationSpeed)).toBe(0);
    await h.write(h.primary, Characteristic.RotationSpeed, 50);
    expect(h.device.deviceStatus).toBe('on');
    expect(h.device.speed).toBe(6);
  });

  it('returns manual speed changes to normal mode and reports power changes', async () => {
    const h = await harness();
    await h.write(h.mode('fan-mode'), Characteristic.On, true);
    await h.write(h.primary, Characteristic.RotationSpeed, 50);
    expect(h.device.mode).toBe('normal');
    expect(await h.read(h.mode('fan-mode'), Characteristic.On)).toBe(false);
    await h.write(h.primary, Characteristic.Active, 0);
    expect(h.device.deviceStatus).toBe('off');
    await h.write(h.primary, Characteristic.Active, 1);
    expect(h.device.deviceStatus).toBe('on');
  });

  it('coalesces scene power/mode/speed writes with explicit mode and power-off precedence', async () => {
    const h = await harness();
    await h.write(h.primary, Characteristic.Active, 0);
    h.device.requests = [];
    await Promise.all([h.write(h.primary, Characteristic.Active, 1), h.write(h.primary, Characteristic.RotationSpeed, 0)]);
    expect(h.device.requests).toEqual([{ method: 'setSwitch', data: { powerSwitch: 1, switchIdx: 0 } }]);
    await Promise.all([h.write(h.mode('auto-mode'), Characteristic.On, true), h.write(h.primary, Characteristic.RotationSpeed, 75)]);
    expect(h.device.mode).toBe('auto');
    expect(h.device.requests.some(r => r.method === 'setLevel')).toBe(false);
    await Promise.all([h.write(h.mode('sleep-mode'), Characteristic.On, true), h.write(h.mode('auto-mode'), Characteristic.On, false), h.write(h.mode('fan-mode'), Characteristic.On, false)]);
    expect(h.device.mode).toBe('sleep');
    await Promise.all([h.write(h.mode('fan-mode'), Characteristic.On, true), h.write(h.primary, Characteristic.Active, 0), h.write(h.primary, Characteristic.RotationSpeed, 100)]);
    expect(h.device.deviceStatus).toBe('off');
    expect(h.device.mode).toBe('sleep');
  });

  it('serializes overlapping batches so an older speed cannot win', async () => {
    const h = await harness();
    const transport = (h.device as any).callApi.bind(h.device);
    (h.device as any).callApi = async (...args: any[]) => {
      if (args[2].payload.method === 'setLevel' && args[2].payload.data.manualSpeedLevel === 3) await new Promise(resolve => setTimeout(resolve, 100));
      return transport(...args);
    };
    const first = h.write(h.primary, Characteristic.RotationSpeed, 25);
    await new Promise(resolve => setTimeout(resolve, 65));
    const last = h.write(h.primary, Characteristic.RotationSpeed, 100);
    await Promise.all([first, last]);
    expect(h.device.speed).toBe(12);
    expect(h.device.requests.filter(r => r.method === 'setLevel').map(r => r.data.manualSpeedLevel)).toEqual([3, 12]);
  });

  it('converts the issue temperature payload to Celsius and updates polling without device writes', async () => {
    const h = await harness();
    const temperature = h.accessory.getService(Service.TemperatureSensor)!;
    expect(await h.read(temperature, Characteristic.CurrentTemperature)).toBeCloseTo(25.6, 1);
    h.device.status = { ...h.device.status, temperature: 320, workMode: 'advancedSleep', oscillationSwitch: 1, screenSwitch: 0 };
    await h.device.getDetails();
    h.device.requests = [];
    await h.sync();
    expect(temperature.getCharacteristic(Characteristic.CurrentTemperature).value).toBe(0);
    expect(await h.read(h.mode('sleep-mode'), Characteristic.On)).toBe(true);
    expect(await h.read(h.primary, Characteristic.SwingMode)).toBe(1);
    expect(await h.read(h.mode('display'), Characteristic.On)).toBe(false);
    expect(h.device.requests).toEqual([]);
    expect(h.warnings).toEqual([]);
  });

  it.each([undefined, null, '780extra', NaN, Infinity, 99999])('reports missing or invalid temperature %s without unhandled errors and recovers', async temperature => {
    const h = await harness();
    const sensor = h.accessory.getService(Service.TemperatureSensor)!;
    const reading = sensor.getCharacteristic(Characteristic.CurrentTemperature);
    await h.sync();
    (h.device.status as any).temperature = temperature;
    await h.device.getDetails();
    await h.sync();
    expect(reading.statusCode).toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    await expect(h.read(sensor, Characteristic.CurrentTemperature)).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    expect(await h.read(h.primary, Characteristic.Active)).toBe(1);
    expect(h.platform.log.error).not.toHaveBeenCalled();
    expect(h.warnings).toEqual([]);

    h.device.status.temperature = 320;
    await h.device.getDetails();
    await h.sync();
    expect(h.accessory.getService(Service.TemperatureSensor)).toBe(sensor);
    expect(reading.statusCode).toBe(HAPStatus.SUCCESS);
    expect(reading.value).toBe(0);
    expect(await h.read(sensor, Characteristic.CurrentTemperature)).toBe(0);
    expect(h.warnings).toEqual([]);
  });

  it('accepts integer-string temperature readings like the latest pyvesync model', async () => {
    const device = new OfflineFan();
    (device.status as any).temperature = '780';
    const h = await harness({ device });
    await h.sync();
    expect(await h.read(h.accessory.getService(Service.TemperatureSensor)!, Characteristic.CurrentTemperature)).toBeCloseTo(25.6, 1);
    expect(h.platform.log.warn).not.toHaveBeenCalled();
    expect(h.warnings).toEqual([]);
  });

  it('logs safe model diagnostics once per outage, survives device replacement, and logs recovery', async () => {
    const h = await harness();
    delete (h.device.status as any).temperature;
    await h.device.getDetails();
    await h.sync();
    expect(h.platform.log.warn).toHaveBeenCalledTimes(1);
    expect(h.platform.log.warn).toHaveBeenCalledWith('Tower fan temperature unavailable', {
      model: 'LTF-F422S-WUS', connectionStatus: 'online', method: 'getTowerFanStatus',
      reason: 'missing-field', statusReceived: true, fieldPresent: false, rawType: 'undefined', numericValue: undefined,
    });
    const sensor = h.accessory.getService(Service.TemperatureSensor)!;
    await expect(h.read(sensor, Characteristic.CurrentTemperature)).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    await h.sync();
    const updated = new OfflineFan();
    delete (updated.status as any).temperature;
    await updated.getDetails();
    h.fan.applyUpdatedDeviceState(updated as unknown as VeSyncFan);
    await h.sync();
    expect(h.platform.log.warn).toHaveBeenCalledTimes(1);

    h.device.status.temperature = 320;
    await h.device.getDetails();
    await h.sync();
    expect(h.platform.log.info).toHaveBeenCalledWith('Tower fan temperature readings restored', {
      model: 'LTF-F422S-WUS', temperatureCelsius: 0,
    });
    await h.sync();
    expect(h.platform.log.info).toHaveBeenCalledTimes(1);
    (h.device.status as any).temperature = { token: 'do-not-log-this' };
    await h.device.getDetails();
    await h.sync();
    expect(h.platform.log.warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify((h.platform.log.warn as jest.Mock).mock.calls)).not.toMatch(/do-not-log-this|offline-token|offline-cid|offline-uuid/);
  });

  it.each([
    [null, 'invalid-value', 'null'], ['do-not-log-this', 'invalid-value', 'string'],
    [99999, 'out-of-range', 'number'],
  ])('diagnoses unavailable temperature %s without dumping response data', async (temperature, reason, rawType) => {
    const device = new OfflineFan();
    (device.status as any).temperature = temperature;
    (device.status as any).token = 'do-not-log-this';
    const h = await harness({ device });
    await h.sync();
    expect(h.platform.log.warn).toHaveBeenCalledWith('Tower fan temperature unavailable', expect.objectContaining({
      model: 'LTF-F422S-WUS', reason, rawType, fieldPresent: true,
    }));
    expect(JSON.stringify((h.platform.log.warn as jest.Mock).mock.calls)).not.toContain('do-not-log-this');
  });

  it.each([false, true])('handles temperature reads before the first refresh (cached: %s)', async cached => {
    const h = await harness({ cached, initialRefresh: false });
    const sensor = h.accessory.getService(Service.TemperatureSensor)!;
    await expect(h.read(sensor, Characteristic.CurrentTemperature)).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    expect(h.device.requests).toEqual([]);
    expect(h.platform.log.error).not.toHaveBeenCalled();
    expect(h.warnings).toEqual([]);

    await h.device.getDetails();
    await h.sync();
    expect(h.accessory.services.filter(s => s.UUID === Service.TemperatureSensor.UUID)).toHaveLength(1);
    expect(await h.read(sensor, Characteristic.CurrentTemperature)).toBeCloseTo(25.6, 1);
    expect(h.warnings).toEqual([]);
  });

  it('arms, resizes and cancels the real timer, including scheduling power on while off', async () => {
    const h = await harness();
    const timer = h.mode('timer');
    await h.write(timer, Characteristic.On, true);
    expect(h.device.requests[0]).toEqual({ method: 'setTimer', data: { action: 'off', total: 3600 } });
    expect(await h.read(timer, Characteristic.On)).toBe(true);
    expect(await h.read(timer, Characteristic.RemainingDuration)).toBeGreaterThan(3590);
    await h.write(timer, Characteristic.SetDuration, 7200);
    expect(h.device.requests[1]).toEqual({ method: 'setTimer', data: { action: 'off', total: 7200 } });
    await h.write(timer, Characteristic.On, false);
    expect(h.device.requests[2]).toEqual({ method: 'clearTimer', data: { id: 10 } });
    expect(await h.read(timer, Characteristic.On)).toBe(false);
    await h.write(h.primary, Characteristic.Active, 0);
    await h.write(timer, Characteristic.On, true);
    expect(h.device.requests[h.device.requests.length - 1]).toEqual({ method: 'setTimer', data: { action: 'on', total: 7200 } });
    expect(h.device.deviceStatus).toBe('off');
  });

  it('preserves the running timer and duration when resize or cancellation is rejected', async () => {
    const h = await harness();
    const timer = h.mode('timer');
    await h.write(timer, Characteristic.On, true);
    h.device.failMethod = 'setTimer';
    await expect(h.write(timer, Characteristic.SetDuration, 7200)).rejects.toBeDefined();
    expect(await h.read(timer, Characteristic.SetDuration)).toBe(3600);
    h.device.failMethod = 'clearTimer';
    await expect(h.write(timer, Characteristic.On, false)).rejects.toBeDefined();
    expect(await h.read(timer, Characteristic.On)).toBe(true);
    h.device.failMethod = undefined;
    await h.write(timer, Characteristic.On, false);
    expect(await h.read(timer, Characteristic.On)).toBe(false);
  });

  it.each([
    ['swing', 'setOscillationSwitch'], ['direction', 'setOscillationSwitch'], ['display', 'setDisplay'],
    ['power', 'setSwitch'], ['speed', 'setLevel'], ['mode', 'setTowerFanMode'], ['timer', 'setTimer']
  ])('rejects %s device failures back through HAP and can recover', async (control, method) => {
    const h = await harness();
    h.device.failMethod = method;
    const write = () => {
      if (control === 'swing') return h.write(h.primary, Characteristic.SwingMode, 1);
      if (control === 'direction') return h.write(h.primary, Characteristic.RotationDirection, Characteristic.RotationDirection.CLOCKWISE);
      if (control === 'display') return h.write(h.mode('display'), Characteristic.On, false);
      if (control === 'power') return h.write(h.primary, Characteristic.Active, 0);
      if (control === 'speed') return h.write(h.primary, Characteristic.RotationSpeed, 100);
      if (control === 'mode') return h.write(h.mode('fan-mode'), Characteristic.On, true);
      return h.write(h.mode('timer'), Characteristic.On, true);
    };
    const state = { speed: h.device.speed, mode: h.device.mode, display: h.device.displayEnabled, oscillation: h.device.oscillationEnabled, power: h.device.deviceStatus };
    await expect(write()).rejects.toBeDefined();
    expect({ speed: h.device.speed, mode: h.device.mode, display: h.device.displayEnabled, oscillation: h.device.oscillationEnabled, power: h.device.deviceStatus }).toEqual(state);
    h.device.failMethod = undefined;
    await expect(write()).resolves.toBeUndefined();
  });

  it('keeps capability metadata synchronous and sends repeated fan writes through the production proxy', async () => {
    const device = new OfflineFan();
    await device.getDetails();
    device.requests = [];
    const client = createRateLimitedVeSync('offline', 'offline', 'America/Chicago', false, true, undefined,
      new PluginLogger(createMockLogger(), false), undefined, { quotaManagement: { enabled: false } });
    (client as any).fans = [device];
    const proxied = client.fans[0] as unknown as OfflineFan;
    expect(proxied.getSupportedModes()).toEqual(['normal', 'auto', 'sleep', 'turbo']);
    for (const enabled of [true, false, true]) expect(await proxied.setOscillation(enabled)).toBe(true);
    expect(device.requests.map(r => r.data)).toEqual([{ oscillationSwitch: 1 }, { oscillationSwitch: 0 }, { oscillationSwitch: 1 }]);
  });
});
