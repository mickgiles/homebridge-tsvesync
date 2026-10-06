import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { credential } from '../utils/credential';

describe('credential files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vesync-credential-'));
  const file = join(directory, 'password');

  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  it('prefers the file and removes one final line ending', () => {
    writeFileSync(file, 'file-value\r\n', { mode: 0o600 });
    expect(credential('inline-value', file)).toBe('file-value');
    expect(readFileSync(file, 'utf8')).toBe('file-value\r\n');
  });

  it('keeps inline credentials when no file is configured', () => {
    expect(credential('inline-value', undefined)).toBe('inline-value');
  });

  it('does not fall back to an inline value when a file cannot be read', () => {
    expect(() => credential('inline-value', join(directory, 'missing'))).toThrow();
  });

  it('rejects relative paths', () => {
    expect(() => credential('inline-value', 'password')).toThrow('absolute');
  });
});
