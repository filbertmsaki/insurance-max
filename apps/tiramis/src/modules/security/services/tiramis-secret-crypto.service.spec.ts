import { randomBytes } from 'crypto';

import {
  TiramisSecretCryptoService,
  TiramisSecretDecryptionError,
} from './tiramis-secret-crypto.service';

describe('TiramisSecretCryptoService key rotation', () => {
  const oldKey = randomBytes(32).toString('base64');
  const newKey = randomBytes(32).toString('base64');

  const createService = (env: Record<string, string | undefined>) =>
    new TiramisSecretCryptoService({
      get: (name: string) => env[name],
    } as any);

  const encryptedWithOldKey = createService({
    TIRAMIS_SECRET_ENCRYPTION_KEY: oldKey,
  }).encrypt('secret-value')!;

  it('reports a value from a removed key as UNREADABLE and throws on decrypt', () => {
    const service = createService({ TIRAMIS_SECRET_ENCRYPTION_KEY: newKey });

    expect(service.inspect(encryptedWithOldKey)).toBe('UNREADABLE');
    expect(service.reEncrypt(encryptedWithOldKey)).toBeNull();
    expect(service.mask(encryptedWithOldKey)).toBe('[unreadable]');
    expect(() => service.decryptIfEncrypted(encryptedWithOldKey)).toThrow(
      TiramisSecretDecryptionError,
    );
  });

  it('decrypts with a previous key and re-encrypts onto the current key', () => {
    const service = createService({
      TIRAMIS_SECRET_ENCRYPTION_KEY: newKey,
      TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS: oldKey,
    });

    expect(service.inspect(encryptedWithOldKey)).toBe('PREVIOUS_KEY');
    expect(service.decryptIfEncrypted(encryptedWithOldKey)).toBe(
      'secret-value',
    );

    const reEncrypted = service.reEncrypt(encryptedWithOldKey)!;
    const newKeyOnly = createService({ TIRAMIS_SECRET_ENCRYPTION_KEY: newKey });
    expect(newKeyOnly.inspect(reEncrypted)).toBe('OK');
    expect(newKeyOnly.decryptIfEncrypted(reEncrypted)).toBe('secret-value');
  });

  it('classifies missing and plaintext values', () => {
    const service = createService({ TIRAMIS_SECRET_ENCRYPTION_KEY: newKey });

    expect(service.inspect(null)).toBe('MISSING');
    expect(service.inspect('plain')).toBe('PLAINTEXT');
    expect(service.decryptIfEncrypted(service.reEncrypt('plain'))).toBe(
      'plain',
    );
  });
});
