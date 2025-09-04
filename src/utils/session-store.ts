import fs from 'fs';
import path from 'path';
import { PluginLogger } from './logger';

export interface PluginSession {
  token: string;
  accountId: string;
  countryCode?: string | null;
  region: string;
  apiBaseUrl: string;
  authFlowUsed?: 'legacy' | 'new';
  issuedAt?: number | null;
  expiresAt?: number | null;
  lastValidatedAt?: number | null;
  libraryVersion?: string;
}

export class FileSessionStore {
  private readonly dir: string;
  private readonly file: string;

  constructor(basePath: string, private readonly logger: PluginLogger) {
    this.dir = path.join(basePath, 'tsvesync');
    this.file = path.join(this.dir, 'session.json');
  }

  async load(): Promise<PluginSession | null> {
    try {
      await fs.promises.mkdir(this.dir, { recursive: true });
      const data = await fs.promises.readFile(this.file, 'utf8');
      const session = JSON.parse(data) as PluginSession;
      if (!session || !session.token || !session.accountId) return null;
      return session;
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        this.logger.debug(`Session load error: ${e?.message || e}`);
      }
      return null;
    }
  }

  async save(session: PluginSession): Promise<void> {
    try {
      await fs.promises.mkdir(this.dir, { recursive: true });
      const tmp = this.file + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(session), { encoding: 'utf8', mode: 0o600 });
      await fs.promises.rename(tmp, this.file);
      try { await fs.promises.chmod(this.file, 0o600); } catch { /* best effort */ }
    } catch (e: any) {
      this.logger.debug(`Session save error: ${e?.message || e}`);
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.promises.unlink(this.file);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        this.logger.debug(`Session clear error: ${e?.message || e}`);
      }
    }
  }
}

export function decodeJwtTimestampsLocal(token: string): { iat?: number; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    const iat = typeof payload.iat === 'number' ? payload.iat : undefined;
    const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
    return { iat, exp };
  } catch {
    return null;
  }
}
