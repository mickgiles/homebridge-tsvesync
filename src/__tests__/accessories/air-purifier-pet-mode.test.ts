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

interface PetModeHarnessOptions {
  autoCapable?: boolean;
  existingPetService?: boolean;
  petCapable?: boolean;
}

interface PetModeHandlers {
  get?: () => Promise<CharacteristicValue>;
  set?: (value: CharacteristicValue) => Promise<void>;
}

describe('AirPurifierAccessory Pet Mode switch', () => {
  function createHarness(options: PetModeHarnessOptions = {}) {
    const {
      autoCapable = true,
      existingPetService = false,
      petCapable = true,
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
    } as unknown as jest.Mocked<API>;
    const platform = new TSVESyncPlatform(logger as jest.Mocked<Logger>, {} as any, mockAPI);
    (platform as any).api = api as jest.Mocked<VeSync>;

    const primaryService = {
      ...createMockService(),
      updateCharacteristic: jest.fn().mockReturnThis(),
    };
    const infoService = createMockInfoService();
    const petModeHandlers: PetModeHandlers = {};
    const petModeCharacteristic = {
      onGet: jest.fn((handler: PetModeHandlers['get']) => {
        petModeHandlers.get = handler;
        return petModeCharacteristic;
      }),
      onSet: jest.fn((handler: PetModeHandlers['set']) => {
        petModeHandlers.set = handler;
        return petModeCharacteristic;
      }),
    };
    const stalePetService = existingPetService ? {
      ...createMockService(),
      updateCharacteristic: jest.fn().mockReturnThis(),
    } : undefined;
    let petModeService = stalePetService;

    const accessory = {
      context: {},
      getService: jest.fn((service: any) => {
        if (service === mockAPI.hap.Service.AccessoryInformation) return infoService;
        if (service === mockAPI.hap.Service.AirPurifier) return primaryService;
        if (service === 'Pet Mode') return petModeService;
        return undefined;
      }),
      addService: jest.fn((service: any) => {
        if (service !== mockAPI.hap.Service.Switch) return primaryService;
        petModeService = {
          ...createMockService(),
          getCharacteristic: jest.fn(() => petModeCharacteristic),
          updateCharacteristic: jest.fn().mockReturnThis(),
        };
        return petModeService;
      }),
      removeService: jest.fn(),
    };

    const features = new Set([
      'fan_speed',
      'filter_life',
      ...(autoCapable ? ['auto_mode'] : []),
      ...(petCapable ? ['pet_mode'] : []),
    ]);
    const device: any = {
      autoMode: jest.fn(),
      changeFanSpeed: jest.fn().mockResolvedValue(true),
      connectionStatus: 'online',
      details: {
        enabled: true,
        filter_life: 80,
        mode: 'manual',
        speed: 2,
      },
      deviceName: 'Vital Test Unit',
      deviceStatus: 'on',
      deviceType: 'LAP-V201S-WUS',
      enabled: true,
      filterLife: 80,
      getDetails: jest.fn().mockResolvedValue(true),
      getMaxFanSpeed: jest.fn().mockReturnValue(4),
      hasFeature: jest.fn((feature: string) => features.has(feature)),
      manualMode: jest.fn(),
      maxSpeed: 4,
      mode: 'manual',
      petMode: jest.fn(),
      setMode: jest.fn().mockResolvedValue(true),
      speed: 2,
      turnOff: jest.fn().mockResolvedValue(true),
      turnOn: jest.fn().mockResolvedValue(true),
      uuid: 'vital-test-unit',
    };
    device.petMode.mockImplementation(async () => {
      device.mode = 'pet';
      device.details.mode = 'pet';
      return true;
    });
    device.autoMode.mockImplementation(async () => {
      device.mode = 'auto';
      device.details.mode = 'auto';
      return true;
    });
    device.manualMode.mockImplementation(async () => {
      device.mode = 'manual';
      device.details.mode = 'manual';
      return true;
    });

    const instance = new AirPurifierAccessory(platform, accessory as any, device);

    return {
      accessory,
      device,
      instance,
      logger,
      petModeHandlers,
      primaryService,
      stalePetService,
      getPetModeService: () => petModeService,
    };
  }

  it('adds the switch only when pet mode is supported', () => {
    const supported = createHarness();
    expect(supported.accessory.addService).toHaveBeenCalledWith(
      'Switch',
      'Pet Mode',
      'pet-mode',
    );

    const unsupported = createHarness({ petCapable: false });
    expect(unsupported.accessory.addService).not.toHaveBeenCalledWith(
      'Switch',
      'Pet Mode',
      'pet-mode',
    );
  });

  it('removes a stale cached switch when pet mode is unsupported', () => {
    const harness = createHarness({ existingPetService: true, petCapable: false });

    expect(harness.accessory.removeService).toHaveBeenCalledWith(harness.stalePetService);
  });

  it('enables pet mode, reports AUTO, and returns to auto mode', async () => {
    const harness = createHarness();
    const petModeService = harness.getPetModeService();

    await harness.petModeHandlers.set!(true);

    expect(harness.device.petMode).toHaveBeenCalledTimes(1);
    expect(await harness.petModeHandlers.get!()).toBe(true);
    expect(harness.primaryService.updateCharacteristic).toHaveBeenCalledWith(
      'TargetAirPurifierState',
      1,
    );
    expect(petModeService?.updateCharacteristic).toHaveBeenCalledWith('On', true);

    await harness.petModeHandlers.set!(false);

    expect(harness.device.autoMode).toHaveBeenCalledTimes(1);
    expect(await harness.petModeHandlers.get!()).toBe(false);
    expect(petModeService?.updateCharacteristic).toHaveBeenCalledWith('On', false);
  });

  it('returns to manual mode when auto mode is unavailable', async () => {
    const harness = createHarness({ autoCapable: false });

    await harness.petModeHandlers.set!(false);

    expect(harness.device.manualMode).toHaveBeenCalledTimes(1);
    expect(harness.device.autoMode).not.toHaveBeenCalled();
  });

  it('rejects failed pet mode writes so HomeKit can restore its state', async () => {
    const harness = createHarness();
    harness.device.petMode.mockResolvedValue(false);

    await expect(harness.petModeHandlers.set!(true))
      .rejects.toThrow('Failed to enable pet mode');
    expect(harness.logger.error).toHaveBeenCalled();
  });
});
