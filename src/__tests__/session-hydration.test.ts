jest.mock('../utils/device-factory');

import { API, Logger, Service as ServiceType, Characteristic as CharacteristicType } from 'homebridge';
import { TSVESyncPlatform } from '../platform';
import { PLATFORM_NAME } from '../settings';
import { DeviceFactory } from '../utils/device-factory';
import { PluginSession } from '../utils/session-store';
import { createMockLogger, createMockVeSync } from './utils/test-helpers';
import { VeSync } from 'tsvesync';

const mockDeviceFactory = jest.mocked(DeviceFactory);

const ACCOUNT_USERNAME = 'test@example.com';
const PERSISTED_TERMINAL_ID = '2aabbccddeeff00112233445566778899';

/** Build an unsigned JWT shaped like the ones VeSync issues. */
const makeToken = (expiresInSeconds: number): string => {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const nowSeconds = Math.floor(Date.now() / 1000);
  return [
    b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ iat: nowSeconds - 60, exp: nowSeconds + expiresInSeconds, terminalId: PERSISTED_TERMINAL_ID }),
    'test-signature',
  ].join('.');
};

const makeSession = (overrides: Partial<PluginSession> = {}): PluginSession => ({
  token: makeToken(30 * 24 * 60 * 60),
  accountId: 'acct-4242',
  region: 'US',
  apiBaseUrl: 'https://smartapi.vesync.com',
  countryCode: 'US',
  terminalId: PERSISTED_TERMINAL_ID,
  appId: 'AppId1234',
  username: ACCOUNT_USERNAME,
  ...overrides,
});

describe('TSVESyncPlatform persisted session handling', () => {
  let platform: TSVESyncPlatform;
  let mockAPI: jest.Mocked<API>;
  let mockLogger: jest.Mocked<Logger>;
  let mockVeSync: jest.Mocked<VeSync>;
  let store: { load: jest.Mock; save: jest.Mock; clear: jest.Mock };

  /** Run the didFinishLaunching handler the platform registered in its constructor. */
  const runStartup = async (): Promise<void> => {
    const registration = (mockAPI.on.mock.calls as unknown as Array<[string, () => Promise<void>]>)
      .find(([event]) => event === 'didFinishLaunching');
    expect(registration).toBeDefined();
    await (registration![1] as () => Promise<void>)();
  };

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });

    mockLogger = createMockLogger();
    mockVeSync = createMockVeSync();
    // A fresh client has no credentials until it logs in or hydrates a session.
    (mockVeSync as any).token = null;
    (mockVeSync as any).accountId = null;
    (mockVeSync as any).terminalId = PERSISTED_TERMINAL_ID;
    (mockVeSync as any).appId = 'AppId1234';
    (mockVeSync as any).region = 'US';
    (mockVeSync as any).apiBaseUrl = 'https://smartapi.vesync.com';
    (mockVeSync as any).hydrateSession = jest.fn().mockImplementation((session: PluginSession) => {
      (mockVeSync as any).token = session.token;
      (mockVeSync as any).accountId = session.accountId;
    });
    (mockVeSync as any).restoreClientIdentity = jest.fn();
    (mockVeSync as any).login = jest.fn().mockImplementation(async () => {
      (mockVeSync as any).token = makeToken(30 * 24 * 60 * 60);
      (mockVeSync as any).accountId = 'acct-4242';
      return true;
    });

    mockAPI = {
      version: 2.0,
      serverVersion: '1.0.0',
      user: {
        configPath: jest.fn(),
        storagePath: jest.fn().mockReturnValue('/tmp'),
        persistPath: jest.fn(),
      },
      hapLegacyTypes: {},
      platformAccessory: jest.fn(),
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
        Service: {} as unknown as typeof ServiceType,
        Characteristic: {} as unknown as typeof CharacteristicType,
        Categories: { SENSOR: 10 },
        uuid: { generate: jest.fn().mockImplementation((id) => `test-uuid-${id}`) },
      },
    } as unknown as jest.Mocked<API>;

    mockDeviceFactory.getAccessoryCategory.mockReturnValue(0 as any);
    mockDeviceFactory.isAirPurifier.mockReturnValue(false);

    platform = new TSVESyncPlatform(
      mockLogger,
      {
        name: 'Test Platform',
        username: ACCOUNT_USERNAME,
        password: 'test-password',
        platform: PLATFORM_NAME,
      } as any,
      mockAPI,
    );

    (platform as any).client = mockVeSync;

    store = {
      load: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    (platform as any).sessionStore = store;
  });

  afterEach(() => {
    // The startup path arms a device-poll interval and a token-refresh timer.
    const pollInterval = (platform as any).deviceUpdateInterval;
    if (pollInterval) clearInterval(pollInterval);
    const refreshTimer = (platform as any).refreshTimer;
    if (refreshTimer) clearTimeout(refreshTimer);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('reuses a persisted session that is still valid', async () => {
    store.load.mockResolvedValue(makeSession());

    await runStartup();

    expect((mockVeSync as any).hydrateSession).toHaveBeenCalledTimes(1);
    expect(store.clear).not.toHaveBeenCalled();
    expect(mockVeSync.login).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Reusing persisted VeSync session'));
  });

  it('does not reuse a persisted session whose token has already expired', async () => {
    const expired = makeSession({ token: makeToken(-3600) });
    store.load.mockResolvedValue(expired);

    await runStartup();

    // Handing an expired token to the client would skip the login below and spend a request being told
    // the token expired — which is what surfaced as "-11001022 the token has expired" on startup.
    expect((mockVeSync as any).hydrateSession).not.toHaveBeenCalled();
    expect(mockVeSync.login).toHaveBeenCalled();
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('expired'));
  });

  it('keeps the client identity from an expired session so the fresh login reuses it', async () => {
    store.load.mockResolvedValue(makeSession({ token: makeToken(-3600) }));

    await runStartup();

    expect((mockVeSync as any).restoreClientIdentity).toHaveBeenCalledWith({
      terminalId: PERSISTED_TERMINAL_ID,
      appId: 'AppId1234',
    });
  });

  it('persists the client identity alongside refreshed credentials', async () => {
    store.load.mockResolvedValue(null);

    await runStartup();

    expect(mockVeSync.login).toHaveBeenCalled();
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({ terminalId: PERSISTED_TERMINAL_ID, appId: 'AppId1234' }),
    );
  });

  it('ignores a persisted session belonging to a different account', async () => {
    store.load.mockResolvedValue(makeSession({ username: 'somebody-else@example.com' }));

    await runStartup();

    expect((mockVeSync as any).hydrateSession).not.toHaveBeenCalled();
    expect(mockVeSync.login).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('different account'));
  });
});
