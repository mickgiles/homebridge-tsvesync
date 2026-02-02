jest.mock('../utils/device-factory');

import { API, Logger, Service as ServiceType, Characteristic as CharacteristicType } from 'homebridge';
import { TSVESyncPlatform } from '../platform';
import { PLATFORM_NAME, PLUGIN_NAME } from '../settings';
import { DeviceFactory } from '../utils/device-factory';
import { BaseAccessory } from '../accessories/base.accessory';
import { createMockLogger, createMockVeSync } from './utils/test-helpers';
import { VeSync } from 'tsvesync';

const mockDeviceFactory = jest.mocked(DeviceFactory);

describe('TSVESyncPlatform discoverDevices', () => {
  let platform: TSVESyncPlatform;
  let mockAPI: jest.Mocked<API>;
  let mockLogger: jest.Mocked<Logger>;
  let mockVeSync: jest.Mocked<VeSync>;

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });

    mockLogger = createMockLogger();
    mockVeSync = createMockVeSync();

    mockAPI = {
      version: 2.0,
      serverVersion: '1.0.0',
      user: {
        configPath: jest.fn(),
        storagePath: jest.fn().mockReturnValue('/tmp'),
        persistPath: jest.fn(),
      },
      hapLegacyTypes: {},
      platformAccessory: jest.fn().mockImplementation((name, uuid, category) => ({
        UUID: uuid,
        displayName: name,
        category,
        context: {},
        services: new Map(),
        addService: jest.fn(),
        removeService: jest.fn(),
        getService: jest.fn(),
        getServiceById: jest.fn(),
      })),
      versionGreaterOrEqual: jest.fn(),
      registerAccessory: jest.fn(),
      registerPlatform: jest.fn(),
      publishCameraAccessories: jest.fn(),
      registerPlatformAccessories: jest.fn(),
      unregisterPlatformAccessories: jest.fn(),
      publishExternalAccessories: jest.fn(),
      updatePlatformAccessories: jest.fn(),
      registerPlatformAccessory: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      hap: {
        Service: {
          AccessoryInformation: jest.fn(),
          AirPurifier: jest.fn(),
        } as unknown as typeof ServiceType,
        Characteristic: {
          Manufacturer: 'Manufacturer',
          Model: 'Model',
          SerialNumber: 'SerialNumber',
          FirmwareRevision: 'FirmwareRevision',
        } as unknown as typeof CharacteristicType,
        Categories: {
          SENSOR: 10,
        },
        uuid: {
          generate: jest.fn().mockImplementation((id) => `test-uuid-${id}`),
        },
      },
    } as unknown as jest.Mocked<API>;

    platform = new TSVESyncPlatform(
      mockLogger,
      {
        name: 'Test Platform',
        username: 'test@example.com',
        password: 'test-password',
        platform: PLATFORM_NAME,
      } as any,
      mockAPI
    );

    // Replace VeSync client with mock
    (platform as any).client = mockVeSync;

    const stubAccessory = {
      initialize: jest.fn().mockResolvedValue(undefined),
      syncDeviceState: jest.fn().mockResolvedValue(undefined),
      applyUpdatedDeviceState: jest.fn(),
    } as unknown as BaseAccessory;

    mockDeviceFactory.getAccessoryCategory.mockReturnValue(0 as any);
    mockDeviceFactory.isAirPurifier.mockImplementation((deviceType: string) => deviceType.toUpperCase().includes('CORE'));
    mockDeviceFactory.createAccessory.mockReturnValue(stubAccessory);
    mockDeviceFactory.createAQSensorAccessory.mockReturnValue(stubAccessory);
  });

  it('keeps cached accessories when VeSync temporarily stops reporting a device', async () => {
    const mockPurifier = {
      deviceName: 'Living Room Purifier',
      deviceType: 'Core400S',
      cid: 'cid-123',
      uuid: 'uuid-123',
      deviceStatus: 'on',
      deviceRegion: 'US',
      configModule: 'VeSyncAirBypass',
      macId: '00:11:22:33:44:55',
      deviceCategory: 'fan',
      connectionStatus: 'online',
      details: {},
      config: {},
    };

    // First discovery: device present
    mockVeSync.fans = [mockPurifier as any];
    await platform.discoverDevices();

    expect(mockAPI.registerPlatformAccessories).toHaveBeenCalled();
    expect(mockAPI.unregisterPlatformAccessories).not.toHaveBeenCalled();

    // Second discovery: device missing (e.g., powered off/unplugged)
    jest.clearAllMocks();
    mockVeSync.fans = [];
    await platform.discoverDevices();

    // Key behavior: do not unregister, which would break HomeKit automations
    expect(mockAPI.unregisterPlatformAccessories).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('missing from the VeSync device list')
    );
  });

  it('removes accessories when a device is explicitly excluded by config', async () => {
    const mockPurifier = {
      deviceName: 'Living Room Purifier',
      deviceType: 'Core400S',
      cid: 'cid-123',
      uuid: 'uuid-123',
      deviceStatus: 'on',
      deviceRegion: 'US',
      configModule: 'VeSyncAirBypass',
      macId: '00:11:22:33:44:55',
      deviceCategory: 'fan',
      connectionStatus: 'online',
      details: {},
      config: {},
    };

    // First discovery: device present
    mockVeSync.fans = [mockPurifier as any];
    await platform.discoverDevices();

    // Now exclude it by id (cid)
    (platform as any).config.exclude = { id: ['cid-123'] };

    jest.clearAllMocks();
    mockVeSync.fans = [mockPurifier as any];
    await platform.discoverDevices();

    expect(mockAPI.unregisterPlatformAccessories).toHaveBeenCalledWith(
      PLUGIN_NAME,
      PLATFORM_NAME,
      expect.arrayContaining([expect.objectContaining({ displayName: expect.any(String) })])
    );
  });
});

