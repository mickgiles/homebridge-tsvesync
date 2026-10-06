import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

export function credential(inlineValue: string | undefined, file: string | undefined): string {
  if (!file) {
    return inlineValue || '';
  }
  if (!isAbsolute(file)) {
    throw new Error('Credential file path must be absolute');
  }
  // Runtime files take precedence so Homebridge config can contain only paths.
  return readFileSync(file, 'utf8').replace(/\r?\n$/, '');
}
