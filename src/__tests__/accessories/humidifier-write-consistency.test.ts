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

  it('keeps HomeKit in auto mode when the first Dual200S refresh is stale after setting mode', async () => {
    const { accessory, humidifierService } = createMockAccessory(platform);
    const device = createMockHumidifier({
      deviceStatus: 'on',
      mode: 'manual',
      staleRefresh: (state) => {
        state.deviceStatus = 'on';
        state.mode = 'manual';
      },
    });

    const humidifier = new HumidifierAccessory(platform, accessory, device as any);
    humidifierService.updateCharacteristic.mockClear();
    logger.warn.mockClear();

    await (humidifier as any).setTargetState(0);

    expect(device.setAutoMode).toHaveBeenCalledTimes(1);
    expect(humidifierService.updateCharacteristic.mock.calls).toContainEqual([
      platform.Characteristic.TargetHumidifierDehumidifierState,
      0,
    ]);
    expect(humidifierService.updateCharacteristic.mock.calls).toContainEqual([
      platform.Characteristic.CurrentHumidifierDehumidifierState,
      2,
    ]);
    expect(humidifierService.updateCharacteristic.mock.calls).not.toContainEqual([
      platform.Characteristic.TargetHumidifierDehumidifierState,
      1,
    ]);
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('did not change to desired mode'),
    );
  });
});
