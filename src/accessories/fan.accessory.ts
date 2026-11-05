import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncFan } from '../types/device.types';

type FanMode = 'normal' | 'auto' | 'sleep' | 'turbo';
interface FanWrite {
  active?: number;
  speed?: number;
  modes?: Partial<Record<FanMode, boolean>>;
}
const MODES: { mode: FanMode; name: string; subtype: string }[] = [
  // Reuse the old Fan Mode service identity so existing automations survive.
  { mode: 'turbo', name: 'Turbo Mode', subtype: 'fan-mode' },
  { mode: 'auto', name: 'Auto Mode', subtype: 'auto-mode' },
  { mode: 'sleep', name: 'Sleep Mode', subtype: 'sleep-mode' },
];

export class FanAccessory extends BaseAccessory {
  protected readonly device: VeSyncFan;
  private writeChain: Promise<void> = Promise.resolve();
  private pendingWrite: FanWrite | null = null;
  private pendingPromise: Promise<void> | null = null;

  constructor(platform: TSVESyncPlatform, accessory: PlatformAccessory, device: VeSyncFan) {
    super(platform, accessory, device);
    this.device = device;
  }

  private get maxSpeed(): number {
    return this.device.getMaxFanSpeed?.() ?? (this.device.deviceType.startsWith('LTF-F422') ? 12 : 4);
  }

  private get currentMode(): FanMode {
    return this.device.mode === 'advancedSleep' ? 'sleep' : this.device.mode || 'normal';
  }

  private get oscillationEnabled(): boolean {
    return this.device.oscillationEnabled ?? this.device.oscillationState;
  }

  private supports(feature: string): boolean {
    return this.device.hasFeature?.(feature) ?? this.device.deviceType.startsWith('LTF-F422');
  }

  private supportsMode(mode: FanMode): boolean {
    return this.device.getSupportedModes?.().includes(mode) ?? true;
  }

  private findSwitch(name: string, subtype: string): Service | undefined {
    return this.accessory.getServiceById(this.platform.Service.Switch, subtype) ||
      this.accessory.getService(name) ||
      (subtype === 'fan-mode' ? this.accessory.getService('Fan Mode') : undefined);
  }

  private setupSwitch(name: string, subtype: string, get: () => Promise<CharacteristicValue>, set: (value: CharacteristicValue) => Promise<void>): Service {
    const service = this.findSwitch(name, subtype) || this.accessory.addService(this.platform.Service.Switch, name, subtype);
    service.displayName = name;
    service.setCharacteristic(this.platform.Characteristic.Name, name);
    this.setupCharacteristic(this.platform.Characteristic.On, get, set, undefined, service);
    return service;
  }

  protected setupService(): void {
    this.service = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);
    this.setupCharacteristic(this.platform.Characteristic.Active, async () => this.device.deviceStatus === 'on' ? 1 : 0,
      value => this.queueWrite('active', Number(value)));
    this.setupCharacteristic(this.platform.Characteristic.RotationSpeed, async () => this.rotationSpeed,
      value => this.queueWrite('speed', Number(value)), { minValue: 0, maxValue: 100, minStep: 1 });
    this.setupCharacteristic(this.platform.Characteristic.SwingMode, async () => Number(this.oscillationEnabled),
      value => this.setOscillation(Number(value) === 1));
    // Legacy clients used direction to toggle oscillation. Keep both controls in sync.
    this.setupCharacteristic(this.platform.Characteristic.RotationDirection,
      async () => this.oscillationEnabled ? this.platform.Characteristic.RotationDirection.CLOCKWISE : this.platform.Characteristic.RotationDirection.COUNTER_CLOCKWISE,
      value => this.setOscillation(value === this.platform.Characteristic.RotationDirection.CLOCKWISE));
    this.setupCharacteristic(this.platform.Characteristic.Name, async () => this.sanitizedDeviceName);
    this.setupChildLock();

    for (const { mode, name, subtype } of MODES) {
      if (!this.supportsMode(mode)) continue;
      this.setupSwitch(name, subtype, async () => this.device.deviceStatus === 'on' && this.currentMode === mode,
        value => this.queueWrite('modes', { [mode]: Boolean(value) }));
    }

    if (this.supports('display') && this.device.setDisplay) {
      // Old cached Lightbulb/brightness controls cannot represent a binary display.
      for (const service of [...this.accessory.services]) {
        if (service.UUID === this.platform.Service.Lightbulb.UUID &&
            (service.subtype === 'display' || /^(display|night light)$/i.test(service.displayName))) {
          this.accessory.removeService(service);
        }
      }
      this.setupSwitch('Display', 'display', async () => Boolean(this.device.displayEnabled), value => this.enqueue(async () => {
        this.requireSuccess(await this.device.setDisplay!(Boolean(value)), 'set display');
      }));
    }

    if (this.supports('timer') && this.device.setTimer && this.device.clearTimer) {
      const timer = this.setupSwitch('Timer', 'timer', async () => (this.device.timerRemaining ?? 0) > 0,
        value => this.enqueue(async () => {
          this.requireSuccess(value ? await this.device.setTimer!(this.timerDuration / 3600) : await this.device.clearTimer!(), 'set timer');
        }));
      timer.addOptionalCharacteristic(this.platform.Characteristic.SetDuration);
      timer.addOptionalCharacteristic(this.platform.Characteristic.RemainingDuration);
      timer.getCharacteristic(this.platform.Characteristic.SetDuration).updateValue(this.timerDuration);
      // Home shows the on/off switch; controllers such as Eve can also set the duration.
      this.setupCharacteristic(this.platform.Characteristic.SetDuration, async () => this.timerDuration, value => this.enqueue(async () => {
        const seconds = Number(value);
        if (!Number.isInteger(seconds) || seconds < 60 || seconds > 43200) throw new Error('Timer duration must be 60–43200 seconds');
        if ((this.device.timerRemaining ?? 0) > 0) this.requireSuccess(await this.device.setTimer!(seconds / 3600), 'set timer duration');
        this.accessory.context.fanTimerDuration = seconds;
      }), { minValue: 60, maxValue: 43200, minStep: 1 }, timer);
      this.setupCharacteristic(this.platform.Characteristic.RemainingDuration, async () => this.device.timerRemaining ?? 0,
        undefined, { minValue: 0, maxValue: 43200, minStep: 1 }, timer);
    }

    if (this.supports('temperature') && 'temperatureCelsius' in this.device) {
      const temperature = this.accessory.getService(this.platform.Service.TemperatureSensor) ||
        this.accessory.addService(this.platform.Service.TemperatureSensor, 'Temperature', 'temperature');
      this.setupCharacteristic(this.platform.Characteristic.CurrentTemperature, async () => {
        const value = this.currentTemperature;
        if (value === undefined) throw new Error('Temperature is not available');
        return value;
      }, undefined, { minValue: -50, maxValue: 100, minStep: 0.1 }, temperature);
    }
  }

  private get timerDuration(): number {
    const value = this.accessory.context.fanTimerDuration;
    return Number.isInteger(value) && value >= 60 && value <= 43200 ? value : 3600;
  }

  private get currentTemperature(): number | undefined {
    const value = this.device.temperatureCelsius;
    return value !== undefined && Number.isFinite(value) && value >= -50 && value <= 100 ? value : undefined;
  }

  private get rotationSpeed(): number {
    return this.device.deviceStatus === 'on' ? Math.round(Math.max(0, Math.min(this.maxSpeed, this.device.speed ?? 0)) / this.maxSpeed * 100) : 0;
  }

  protected async updateDeviceSpecificStates(_details: any): Promise<void> {
    const c = this.platform.Characteristic;
    this.updateCharacteristicValue(c.Active, this.device.deviceStatus === 'on' ? 1 : 0);
    this.updateCharacteristicValue(c.CurrentFanState, this.device.deviceStatus === 'on' ? 2 : 0);
    this.updateCharacteristicValue(c.RotationSpeed, this.rotationSpeed);
    this.updateCharacteristicValue(c.SwingMode, Number(this.oscillationEnabled));
    this.updateCharacteristicValue(c.RotationDirection, this.oscillationEnabled ? c.RotationDirection.CLOCKWISE : c.RotationDirection.COUNTER_CLOCKWISE);
    if (this.supportsChildLock()) this.updateCharacteristicValue(c.LockPhysicalControls, this.device.childLock ? 1 : 0);
    for (const { mode, name, subtype } of MODES) {
      this.findSwitch(name, subtype)?.updateCharacteristic(c.On, this.device.deviceStatus === 'on' && this.currentMode === mode);
    }
    this.findSwitch('Display', 'display')?.updateCharacteristic(c.On, Boolean(this.device.displayEnabled));
    const timer = this.findSwitch('Timer', 'timer');
    timer?.updateCharacteristic(c.On, (this.device.timerRemaining ?? 0) > 0);
    timer?.updateCharacteristic(c.RemainingDuration, this.device.timerRemaining ?? 0);
    const temperature = this.currentTemperature;
    if (temperature !== undefined) {
      this.accessory.getService(this.platform.Service.TemperatureSensor)?.updateCharacteristic(c.CurrentTemperature, temperature);
    }
  }

  protected getDeviceCapabilities(): DeviceCapabilities {
    return { hasBrightness: false, hasColorTemp: false, hasColor: false, hasSpeed: true, hasHumidity: false,
      hasAirQuality: false, hasWaterLevel: false, hasChildLock: this.supportsChildLock(), hasSwingMode: true };
  }

  private requireSuccess(success: boolean, action: string): void {
    if (!success) throw new Error(`Failed to ${action}`);
  }

  private enqueue(action: () => Promise<void>): Promise<void> {
    const write = this.writeChain.catch(() => undefined).then(async () => {
      try {
        await action();
        await this.updateDeviceSpecificStates(this.device);
        this.cacheDeviceDetails(this.device);
        await this.persistDeviceState('mode', this.currentMode);
      } catch (error) {
        await this.handleDeviceError('set fan state', error);
        throw error;
      }
    });
    this.writeChain = write;
    return write;
  }

  /** Coalesce scene writes so an explicit mode/on is not undone by a 0% slider. */
  private queueWrite<K extends keyof FanWrite>(key: K, value: FanWrite[K]): Promise<void> {
    if (!this.pendingWrite) this.pendingWrite = {};
    if (key === 'modes') {
      this.pendingWrite.modes = { ...this.pendingWrite.modes, ...value as FanWrite['modes'] };
    } else {
      this.pendingWrite[key] = value;
    }
    if (!this.pendingPromise) {
      this.pendingPromise = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          const batch = this.pendingWrite ?? {};
          this.pendingWrite = null;
          this.pendingPromise = null;
          this.enqueue(() => this.applyWrite(batch)).then(resolve, reject);
        }, 50);
      });
    }
    return this.pendingPromise;
  }

  private async applyWrite({ active, speed, modes }: FanWrite): Promise<void> {
    const enabledMode = (Object.keys(modes ?? {}) as FanMode[]).reverse().find(mode => modes![mode]);
    if (active === 0 || (speed === 0 && active !== 1 && !enabledMode)) {
      this.requireSuccess(await this.device.turnOff(), 'turn off fan');
      return;
    }
    const selectedMode = enabledMode ?? (modes?.[this.currentMode] === false ? 'normal' : undefined) ??
      (speed !== undefined && speed > 0 ? 'normal' : undefined);
    const shouldPowerOn = active === 1 || enabledMode !== undefined || (speed !== undefined && speed > 0);
    if (shouldPowerOn && this.device.deviceStatus !== 'on') this.requireSuccess(await this.device.turnOn(), 'turn on fan');
    if (selectedMode && selectedMode !== this.currentMode) this.requireSuccess(await this.device.setMode(selectedMode), `set ${selectedMode} mode`);
    if (speed !== undefined && speed > 0 && !enabledMode) {
      const level = Math.max(1, Math.min(this.maxSpeed, Math.round(speed / 100 * this.maxSpeed)));
      this.requireSuccess(await this.device.changeFanSpeed(level), 'set fan speed');
    }
  }

  private setOscillation(enabled: boolean): Promise<void> {
    return this.enqueue(async () => this.requireSuccess(await this.device.setOscillation(enabled), 'set oscillation'));
  }

  private supportsChildLock(): boolean {
    return typeof this.device.setChildLock === 'function' && (this.device.hasFeature?.('child_lock') ?? true);
  }

  private setupChildLock(): void {
    const characteristic = this.platform.Characteristic.LockPhysicalControls;
    if (!this.supportsChildLock()) {
      if (this.service.testCharacteristic(characteristic)) this.service.removeCharacteristic(this.service.getCharacteristic(characteristic));
      return;
    }
    this.setupCharacteristic(characteristic, async () => this.device.childLock ? 1 : 0, value => this.enqueue(async () => {
      this.requireSuccess(await this.device.setChildLock(Number(value) === 1), 'set child lock');
    }));
  }
}
