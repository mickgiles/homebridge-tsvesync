import { Logger, PlatformAccessory } from 'homebridge';
import { HumidifierAccessory } from '../../accessories/humidifier.accessory';
import { TSVESyncPlatform } from '../../platform';
import { createMockLogger } from '../utils/test-helpers';

type CharacteristicStub = {
  onSet: jest.Mock;
  onGet: jest.Mock;
  updateValue: jest.Mock;
  setProps: jest.Mock;
};

const createCharacteristic = (name: string) => ({ name });

const createCharacteristicStub = (): CharacteristicStub => ({
  onSet: jest.fn().mockReturnThis(),
  onGet: jest.fn().mockReturnThis(),
  updateValue: jest.fn().mockReturnThis(),
  setProps: jest.fn().mockReturnThis(),
});

const createMockService = () => {
  const characteristicStubs = new Map<any, CharacteristicStub>();

  return {
    getCharacteristic: jest.fn((characteristic: any) => {
      if (!characteristicStubs.has(characteristic)) {
        characteristicStubs.set(characteristic, createCharacteristicStub());
      }

      return characteristicStubs.get(characteristic);
    }),
    setCharacteristic: jest.fn().mockReturnThis(),
    updateCharacteristic: jest.fn().mockReturnThis(),
    addCharacteristic: jest.fn((characteristic: any) => {
      if (!characteristicStubs.has(characteristic)) {
        characteristicStubs.set(characteristic, createCharacteristicStub());
      }

      return characteristicStubs.get(characteristic);
    }),
    removeCharacteristic: jest.fn().mockReturnThis(),
    testCharacteristic: jest.fn().mockReturnValue(true),
  };
};

const createMockPlatform = (logger: jest.Mocked<Logger>) => {
  const Characteristic = {
    Active: createCharacteristic('Active'),
    Brightness: createCharacteristic('Brightness'),
    CurrentHumidifierDehumidifierState: createCharacteristic('CurrentHumidifierDehumidifierState'),
    CurrentRelativeHumidity: createCharacteristic('CurrentRelativeHumidity'),
    LockPhysicalControls: createCharacteristic('LockPhysicalControls'),
    Manufacturer: createCharacteristic('Manufacturer'),
    Model: createCharacteristic('Model'),
    Name: createCharacteristic('Name'),
    On: createCharacteristic('On'),
    RelativeHumidityHumidifierThreshold: createCharacteristic('RelativeHumidityHumidifierThreshold'),
    RotationSpeed: createCharacteristic('RotationSpeed'),
    SerialNumber: createCharacteristic('SerialNumber'),
    TargetHumidifierDehumidifierState: createCharacteristic('TargetHumidifierDehumidifierState'),
    WaterLevel: createCharacteristic('WaterLevel'),
  } as const;

  const Service = {
    AccessoryInformation: 'AccessoryInformation',
    HumidifierDehumidifier: 'HumidifierDehumidifier',
    Lightbulb: 'Lightbulb',
  } as const;

  return {
    log: logger,
    Service,
    Characteristic,
    api: {
      updatePlatformAccessories: jest.fn(),
    },
    config: {
      debug: true,
      retry: {
        maxRetries: 3,
      },
    },
  } as unknown as jest.Mocked<TSVESyncPlatform>;
};

const createMockAccessory = (platform: jest.Mocked<TSVESyncPlatform>) => {
  const humidifierService = createMockService();
  const lightService = createMockService();
  const accessoryInformationService = {
    setCharacteristic: jest.fn().mockReturnThis(),
  };

  const accessory = {
    context: {
      device: {
        details: {},
      },
    },
    displayName: 'Test Humidifier',
    getService: jest.fn((service: any) => {
      if (service === platform.Service.AccessoryInformation) {
        return accessoryInformationService;
      }

      if (service === platform.Service.HumidifierDehumidifier) {
        return humidifierService;
      }

      if (service === 'Night Light') {
        return null;
      }

      return null;
    }),
    addService: jest.fn((service: any) => {
      if (service === platform.Service.HumidifierDehumidifier) {
        return humidifierService;
      }

      if (service === platform.Service.Lightbulb) {
        return lightService;
      }

      return humidifierService;
    }),
  };

  return {
    accessory: accessory as unknown as jest.Mocked<PlatformAccessory>,
    accessoryInformationService,
    humidifierService,
    lightService,
  };
};

const createMockHumidifier = (options?: {
  deviceStatus?: 'on' | 'off';
  mode?: 'auto' | 'manual';
  staleRefresh?: (state: {
    currentHumidity: number;
    deviceStatus: 'on' | 'off';
    mistLevel: number;
    mode: 'auto' | 'manual';
    targetHumidity: number;
  }) => void;
}) => {
  const state = {
    currentHumidity: 40,
    deviceStatus: options?.deviceStatus ?? 'off',
    mistLevel: 2,
    mode: options?.mode ?? 'manual',
    targetHumidity: 55,
  };

  const syncState = () => {
    mockDevice.currentHumidity = state.currentHumidity;
    mockDevice.deviceStatus = state.deviceStatus;
    mockDevice.details = {
      ...mockDevice.details,
      current_humidity: state.currentHumidity,
      mode: state.mode,
      target_humidity: state.targetHumidity,
      water_lacks: false,
      water_tank_lifted: false,
    };
    mockDevice.humidity = state.targetHumidity;
    mockDevice.mistLevel = state.mistLevel;
    mockDevice.mode = state.mode;
  };

  const mockDevice = {
    cid: 'cid',
    configModule: 'Humidifier',
    connectionStatus: 'online',
    currentHumidity: state.currentHumidity,
    deviceName: 'Dual 200S',
    deviceRegion: 'US',
    deviceStatus: state.deviceStatus,
    deviceType: 'Dual200S',
    details: {
      current_humidity: state.currentHumidity,
      mode: state.mode,
      target_humidity: state.targetHumidity,
      water_lacks: false,
      water_tank_lifted: false,
    },
    hasFeature: jest.fn().mockReturnValue(false),
    humidity: state.targetHumidity,
    macId: '00:11:22:33:44:55',
    mistLevel: state.mistLevel,
    mode: state.mode,
    speed: 0,
    turnOn: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'on';
      syncState();
      return true;
    }),
    turnOff: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'off';
      syncState();
      return true;
    }),
    setAutoMode: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'on';
      state.mode = 'auto';
      syncState();
      return true;
    }),
    setManualMode: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'on';
      state.mode = 'manual';
      syncState();
      return true;
    }),
    setMode: jest.fn().mockImplementation(async (mode: 'auto' | 'manual') => {
      state.deviceStatus = 'on';
      state.mode = mode;
      syncState();
      return true;
    }),
    setMistLevel: jest.fn().mockResolvedValue(true),
    changeFanSpeed: jest.fn().mockResolvedValue(true),
    uuid: 'uuid',
    getDetails: jest.fn().mockImplementation(async () => {
      if (options?.staleRefresh) {
        options.staleRefresh(state);
      }

      syncState();
      return true;
    }),
  };

  syncState();

  return mockDevice;
};

describe('HumidifierAccessory write consistency', () => {
  let logger: jest.Mocked<Logger>;
  let platform: jest.Mocked<TSVESyncPlatform>;

  beforeEach(() => {
    logger = createMockLogger();
    platform = createMockPlatform(logger);
  });

  it('keeps HomeKit on when the first Dual200S refresh is stale after turning on', async () => {
    const { accessory, humidifierService } = createMockAccessory(platform);
    const device = createMockHumidifier({
      deviceStatus: 'off',
      mode: 'manual',
      staleRefresh: (state) => {
        state.deviceStatus = 'off';
        state.mode = 'manual';
      },
    });

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);
    humidifierService.updateCharacteristic.mockClear();
    logger.warn.mockClear();

    await (humidifier as any).setActive(1);

    expect(device.turnOn).toHaveBeenCalledTimes(1);
    expect(humidifierService.updateCharacteristic.mock.calls).toContainEqual([
      platform.Characteristic.Active,
      1,
    ]);
    expect(humidifierService.updateCharacteristic.mock.calls).toContainEqual([
      platform.Characteristic.CurrentHumidifierDehumidifierState,
      2,
    ]);
    expect(humidifierService.updateCharacteristic.mock.calls).not.toContainEqual([
      platform.Characteristic.Active,
      0,
    ]);
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('did not change to desired state'),
    );
  });

  it('keeps HomeKit in manual mode when the first Dual200S refresh is stale after setting mode', async () => {
    const { accessory, humidifierService } = createMockAccessory(platform);
    const device = createMockHumidifier({
      deviceStatus: 'on',
      mode: 'auto',
      staleRefresh: (state) => {
        state.deviceStatus = 'on';
        state.mode = 'auto';
      },
    });

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);
    humidifierService.updateCharacteristic.mockClear();
    logger.warn.mockClear();

    // HomeKit state 0 = "Auto" in Home app → VeSync manual for Dual200S
    await (humidifier as any).setTargetState(0);

    expect(device.setManualMode).toHaveBeenCalledTimes(1);
    expect(humidifierService.updateCharacteristic.mock.calls).toContainEqual([
      platform.Characteristic.TargetHumidifierDehumidifierState,
      0,
    ]);
    expect(humidifierService.updateCharacteristic.mock.calls).not.toContainEqual([
      platform.Characteristic.TargetHumidifierDehumidifierState,
      1,
    ]);
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('did not change to desired mode'),
    );
  });

  it('maps Dual200S auto mode to HomeKit target state 1 (Humidity/slider)', async () => {
    const { accessory, humidifierService } = createMockAccessory(platform);
    const device = createMockHumidifier({
      deviceStatus: 'on',
      mode: 'manual',
    });

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);
    humidifierService.updateCharacteristic.mockClear();

    // HomeKit state 1 = HUMIDIFIER ("Humidity" in Home app, shows slider)
    // For Dual200S, this should trigger VeSync auto mode
    await (humidifier as any).setTargetState(1);

    expect(device.setAutoMode).toHaveBeenCalledTimes(1);
    expect(device.setManualMode).not.toHaveBeenCalled();
  });

  it('maps Dual200S manual mode to HomeKit target state 0 (Auto/no slider)', async () => {
    const { accessory, humidifierService } = createMockAccessory(platform);
    const device = createMockHumidifier({
      deviceStatus: 'on',
      mode: 'auto',
    });

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);
    humidifierService.updateCharacteristic.mockClear();

    // HomeKit state 0 = HUMIDIFIER_OR_DEHUMIDIFIER ("Auto" in Home app, no slider)
    // For Dual200S, this should trigger VeSync manual mode
    await (humidifier as any).setTargetState(0);

    expect(device.setManualMode).toHaveBeenCalledTimes(1);
    expect(device.setAutoMode).not.toHaveBeenCalled();
  });

  it('reports Dual200S auto mode as HomeKit target state 1 in state sync', async () => {
    const { accessory, humidifierService } = createMockAccessory(platform);
    const device = createMockHumidifier({
      deviceStatus: 'on',
      mode: 'auto',
    });

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);
    humidifierService.updateCharacteristic.mockClear();

    (humidifier as any).applyDeviceStatesToHomeKit(device);

    expect(humidifierService.updateCharacteristic).toHaveBeenCalledWith(
      platform.Characteristic.TargetHumidifierDehumidifierState,
      1,
    );
  });

  it('reports Dual200S manual mode as HomeKit target state 0 in state sync', async () => {
    const { accessory, humidifierService } = createMockAccessory(platform);
    const device = createMockHumidifier({
      deviceStatus: 'on',
      mode: 'manual',
    });

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);
    humidifierService.updateCharacteristic.mockClear();

    (humidifier as any).applyDeviceStatesToHomeKit(device);

    expect(humidifierService.updateCharacteristic).toHaveBeenCalledWith(
      platform.Characteristic.TargetHumidifierDehumidifierState,
      0,
    );
  });

  it('detects LUH-D301S-WEU as isHumidDual200S and isHumid200300S', () => {
    const { accessory } = createMockAccessory(platform);
    const device = createMockHumidifier({ deviceStatus: 'off', mode: 'manual' });
    (device as any).deviceType = 'LUH-D301S-WEU';

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);

    expect((humidifier as any).isHumidDual200S).toBe(true);
    expect((humidifier as any).isHumid200300S).toBe(true);
    expect((humidifier as any).isHumid200S).toBe(false);
  });

  it('detects Dual200S as isHumidDual200S, not isHumid200S', () => {
    const { accessory } = createMockAccessory(platform);
    const device = createMockHumidifier({ deviceStatus: 'off', mode: 'manual' });

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);

    expect((humidifier as any).isHumidDual200S).toBe(true);
    expect((humidifier as any).isHumid200300S).toBe(true);
    expect((humidifier as any).isHumid200S).toBe(false);
  });

  it('maps Dual200S mist level 1 to 50% rotation speed', async () => {
    const { accessory, humidifierService } = createMockAccessory(platform);
    const device = createMockHumidifier({ deviceStatus: 'on', mode: 'manual' });
    device.mistLevel = 1;

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);
    humidifierService.updateCharacteristic.mockClear();

    (humidifier as any).applyDeviceStatesToHomeKit(device);

    expect(humidifierService.updateCharacteristic).toHaveBeenCalledWith(
      platform.Characteristic.RotationSpeed,
      50,
    );
  });

  it('maps Dual200S mist level 2 to 100% rotation speed', async () => {
    const { accessory, humidifierService } = createMockAccessory(platform);
    const device = createMockHumidifier({ deviceStatus: 'on', mode: 'manual' });
    device.mistLevel = 2;

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);
    humidifierService.updateCharacteristic.mockClear();

    (humidifier as any).applyDeviceStatesToHomeKit(device);

    expect(humidifierService.updateCharacteristic).toHaveBeenCalledWith(
      platform.Characteristic.RotationSpeed,
      100,
    );
  });

  it('converts Dual200S rotation speed 50% to mist level 1', async () => {
    const { accessory } = createMockAccessory(platform);
    const device = createMockHumidifier({ deviceStatus: 'on', mode: 'manual' });
    device.setMistLevel = jest.fn().mockResolvedValue(true);

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);

    await (humidifier as any).handleSetRotationSpeed(50);

    expect(device.setMistLevel).toHaveBeenCalledWith(1);
  });

  it('converts Dual200S rotation speed 100% to mist level 2', async () => {
    const { accessory } = createMockAccessory(platform);
    const device = createMockHumidifier({ deviceStatus: 'on', mode: 'manual' });
    device.setMistLevel = jest.fn().mockResolvedValue(true);

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);

    await (humidifier as any).handleSetRotationSpeed(100);

    expect(device.setMistLevel).toHaveBeenCalledWith(2);
  });

  it('snaps Dual200S rotation speed 30% down to mist level 1', async () => {
    const { accessory } = createMockAccessory(platform);
    const device = createMockHumidifier({ deviceStatus: 'on', mode: 'manual' });
    device.setMistLevel = jest.fn().mockResolvedValue(true);

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);

    await (humidifier as any).handleSetRotationSpeed(30);

    expect(device.setMistLevel).toHaveBeenCalledWith(1);
  });

  it('snaps Dual200S rotation speed 80% up to mist level 2', async () => {
    const { accessory } = createMockAccessory(platform);
    const device = createMockHumidifier({ deviceStatus: 'on', mode: 'manual' });
    device.setMistLevel = jest.fn().mockResolvedValue(true);

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);

    await (humidifier as any).handleSetRotationSpeed(80);

    expect(device.setMistLevel).toHaveBeenCalledWith(2);
  });

  it('switches Dual200S from auto to manual mode when adjusting rotation speed', async () => {
    const { accessory } = createMockAccessory(platform);
    const device = createMockHumidifier({ deviceStatus: 'on', mode: 'auto' });
    device.setMistLevel = jest.fn().mockResolvedValue(true);

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);

    await (humidifier as any).handleSetRotationSpeed(100);

    expect(device.setManualMode).toHaveBeenCalledTimes(1);
    expect(device.setMistLevel).toHaveBeenCalledWith(2);
  });

  it('does not switch mode when Dual200S is already in manual mode', async () => {
    const { accessory } = createMockAccessory(platform);
    const device = createMockHumidifier({ deviceStatus: 'on', mode: 'manual' });
    device.setMistLevel = jest.fn().mockResolvedValue(true);

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);

    await (humidifier as any).handleSetRotationSpeed(50);

    expect(device.setManualMode).not.toHaveBeenCalled();
    expect(device.setMistLevel).toHaveBeenCalledWith(1);
  });
});
