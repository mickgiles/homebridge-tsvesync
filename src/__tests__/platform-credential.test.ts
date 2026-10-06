import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { API } from 'homebridge';
import { TSVESyncPlatform } from '../platform';
import { createRateLimitedVeSync } from '../utils/api-proxy';
import { createMockLogger } from './utils/test-helpers';

jest.mock('../utils/api-proxy', () => ({
  createRateLimitedVeSync: jest.fn(() => ({})),
}));

describe('platform credential files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vesync-platform-'));
  const usernameFile = join(directory, 'username');
  const passwordFile = join(directory, 'password');
  const api = {
    hap: { Service: {}, Characteristic: {} },
    user: { storagePath: () => directory },
    on: jest.fn(),
  } as unknown as API;

  beforeAll(() => {
    writeFileSync(usernameFile, 'file-user@example.invalid\n', { mode: 0o600 });
    writeFileSync(passwordFile, 'file-password\n', { mode: 0o600 });
  });
  afterAll(() => rmSync(directory, { recursive: true, force: true }));
  beforeEach(() => jest.clearAllMocks());

  it('uses file values for the client and omits them from debug logging', () => {
    const log = createMockLogger();
    new TSVESyncPlatform(log, {
      platform: 'TSVESyncPlatform',
      name: 'Test',
      username: 'inline-user@example.invalid',
      password: 'inline-password',
      usernameFile,
      passwordFile,
      debug: true,
    }, api);

    expect(jest.mocked(createRateLimitedVeSync).mock.calls[0].slice(0, 2)).toEqual([
      'file-user@example.invalid', 'file-password',
    ]);
    expect(JSON.stringify(log.info.mock.calls)).not.toContain('file-password');
    expect(JSON.stringify(log.info.mock.calls)).not.toContain('file-user@example.invalid');
  });

  it('does not initialize the client when a configured file is missing', () => {
    const log = createMockLogger();
    new TSVESyncPlatform(log, {
      platform: 'TSVESyncPlatform',
      name: 'Test',
      usernameFile,
      password: 'inline-password',
      passwordFile: join(directory, 'missing'),
    }, api);

    expect(createRateLimitedVeSync).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith('Unable to read VeSync credential file');
  });
});
