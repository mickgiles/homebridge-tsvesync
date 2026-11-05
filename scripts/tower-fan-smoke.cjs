/* Offline smoke test against either the local or an installed Homebridge runtime. */
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const runtime = createRequire(process.env.HOMEBRIDGE_PACKAGE || require.resolve('homebridge/package.json'));
const runtimePackage = runtime('./package.json');
const hap = runtime(runtimePackage.dependencies['@homebridge/hap-nodejs'] ? '@homebridge/hap-nodejs' : 'hap-nodejs');
const { Characteristic: C, Service: S, uuid } = hap;
const { VeSyncTowerFan } = require('tsvesync');
const { setLogLevel, LogLevel } = require('tsvesync/dist/lib/logger');
const { FanAccessory } = require('../dist/accessories/fan.accessory');
setLogLevel(LogLevel.NONE);

class OfflineFan extends VeSyncTowerFan {
  constructor() {
    super({ deviceType: 'LTF-F422S-WUS', deviceName: 'Offline Tower Fan', cid: 'offline', uuid: 'offline', configModule: 'offline', connectionStatus: 'online' },
      { accountId: 'offline', token: 'offline', timeZone: 'America/Chicago', debug: false });
    this.requests = [];
    this.reject = false;
  }
  async callApi(_url, _method, body) {
    this.requests.push(body.payload);
    const result = body.payload.method === 'getTowerFanStatus' ? {
      powerSwitch: 1, workMode: 'normal', manualSpeedLevel: 3, fanSpeedLevel: 3,
      oscillationState: 0, oscillationSwitch: 0, screenState: 1, screenSwitch: 1, temperature: 780, timerRemain: 0,
    } : body.payload.method === 'setTimer' ? { id: 9 } : {};
    return [{ code: 0, result: { code: this.reject ? -1 : 0, result } }, 200];
  }
}
async function main() {
  // Use the runtime's public HAP accessory; no bridge is published or paired.
  const accessory = new hap.Accessory('Offline Tower Fan', uuid.generate('tsvesync-issue5-smoke'));
  accessory.context = {};
  const warnings = [];
  accessory.on('characteristic-warning', warning => warnings.push(warning));
  accessory.addService(S.Switch, 'Fan Mode', 'fan-mode');
  accessory.addService(S.Lightbulb, 'Display', 'display');
  const device = new OfflineFan();
  await device.getDetails();
  device.requests = [];
  const noop = () => undefined;
  const log = { debug: noop, info: noop, warn: noop, error: noop };
  const platform = { Characteristic: C, Service: S, log, config: {}, api: { updatePlatformAccessories: noop } };
  const fan = new FanAccessory(platform, accessory, device);
  const primary = accessory.getService(S.Fanv2);
  const control = subtype => accessory.getServiceById(S.Switch, subtype);
  const write = (service, characteristic, value) => service.getCharacteristic(characteristic).handleSetRequest(value);
  await write(primary, C.SwingMode, 1);
  assert.deepEqual(device.requests.pop().data, { oscillationSwitch: 1 });
  await write(primary, C.RotationDirection, C.RotationDirection.COUNTER_CLOCKWISE);
  assert.equal(device.oscillationEnabled, false);
  await write(control('display'), C.On, false);
  assert.deepEqual(device.requests.pop().data, { screenSwitch: 0 });
  await write(control('fan-mode'), C.On, true);
  assert.equal(device.mode, 'turbo');
  await write(control('sleep-mode'), C.On, true);
  assert.equal(device.mode, 'sleep');
  await write(control('auto-mode'), C.On, true);
  assert.equal(device.mode, 'auto');
  await write(primary, C.RotationSpeed, 100);
  assert.equal(device.mode, 'normal');
  assert.equal(device.speed, 12);
  await write(control('timer'), C.On, true);
  assert.deepEqual(device.requests.pop().data, { action: 'off', total: 3600 });
  await write(control('timer'), C.On, false);
  assert.deepEqual(device.requests.pop().data, { id: 9 });
  const temperature = await accessory.getService(S.TemperatureSensor).getCharacteristic(C.CurrentTemperature).handleGetRequest();
  assert.ok(Math.abs(temperature - 25.6) < 0.01);
  assert.equal(accessory.getService(S.Lightbulb), undefined);
  assert.equal(primary.testCharacteristic(C.LockPhysicalControls), false);
  assert.deepEqual(warnings, []);
  device.reject = true;
  await assert.rejects(write(primary, C.SwingMode, 1));
  device.reject = false;
  await fan.updateDeviceSpecificStates(device);
  console.log(JSON.stringify({ result: 'PASS', node: process.version, homebridge: runtimePackage.version,
    plugin: require('../package.json').version, library: require('tsvesync/package.json').version,
    services: accessory.services.map(s => ({ name: s.displayName, subtype: s.subtype })),
    verified: ['cached service migration', 'oscillation', 'legacy direction', 'display', 'all modes', 'speed', 'timer', 'temperature', 'device failure'],
    networkRequests: 0, publishedBridges: 0 }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
