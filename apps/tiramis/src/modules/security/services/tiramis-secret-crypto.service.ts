import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

/**
 * Health of one stored secret, as seen by the keys this process holds:
 * - MISSING: no value stored
 * - PLAINTEXT: stored unencrypted (legacy); readable but should be encrypted
 * - OK: encrypted with the current TIRAMIS_SECRET_ENCRYPTION_KEY
 * - PREVIOUS_KEY: encrypted with a key in TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS;
 *   readable, and re-encrypting moves it to the current key
 * - UNREADABLE: encrypted with a key this process no longer has; the
 *   plaintext must be supplied again
 */
export type TiramisSecretStatus =
  | 'MISSING'
  | 'PLAINTEXT'
  | 'OK'
  | 'PREVIOUS_KEY'
  | 'UNREADABLE';

export class TiramisSecretDecryptionError extends InternalServerErrorException {
  constructor() {
    super(
      'Encrypted secret cannot be decrypted with TIRAMIS_SECRET_ENCRYPTION_KEY or TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS',
    );
  }
}

@Injectable()
export class TiramisSecretCryptoService {
  private readonly prefix = 'enc:v1';

  constructor(private readonly configService: ConfigService) {}

  isEncrypted(value?: string | null): boolean {
    return Boolean(value?.startsWith(this.prefix));
  }

  encrypt(plainText?: string | null): string | null {
    if (!plainText) {
      return null;
    }

    if (plainText.startsWith(this.prefix)) {
      return plainText;
    }

    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      this.prefix,
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decryptIfEncrypted(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    if (!value.startsWith(this.prefix)) {
      return value;
    }

    const result = this.tryDecrypt(value);
    if (!result) {
      throw new TiramisSecretDecryptionError();
    }

    return result.plainText;
  }

  inspect(value?: string | null): TiramisSecretStatus {
    if (!value) {
      return 'MISSING';
    }

    if (!value.startsWith(this.prefix)) {
      return 'PLAINTEXT';
    }

    const result = this.tryDecrypt(value);
    if (!result) {
      return 'UNREADABLE';
    }

    return result.keyIndex === 0 ? 'OK' : 'PREVIOUS_KEY';
  }

  /**
   * Returns the value encrypted with the current key, or null when it
   * cannot be read with any configured key.
   */
  reEncrypt(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    if (!value.startsWith(this.prefix)) {
      return this.encrypt(value);
    }

    const result = this.tryDecrypt(value);
    if (!result) {
      return null;
    }

    return result.keyIndex === 0 ? value : this.encrypt(result.plainText);
  }

  mask(value?: string | null): string {
    if (!value) {
      return '';
    }

    let plain: string;
    try {
      plain = this.decryptIfEncrypted(value) || '';
    } catch {
      return '[unreadable]';
    }

    if (plain.length <= 4) {
      return '****';
    }

    return `${plain.slice(0, 2)}****${plain.slice(-2)}`;
  }

  equalsSecret(a?: string | null, b?: string | null): boolean {
    const first = this.decryptIfEncrypted(a) || '';
    const second = this.decryptIfEncrypted(b) || '';

    const firstBuffer = Buffer.from(first);
    const secondBuffer = Buffer.from(second);

    if (firstBuffer.length !== secondBuffer.length) {
      return false;
    }

    return timingSafeEqual(firstBuffer, secondBuffer);
  }

  private tryDecrypt(
    value: string,
  ): { plainText: string; keyIndex: number } | null {
    const parts = value.split(':');

    if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== this.prefix) {
      return null;
    }

    const iv = Buffer.from(parts[2], 'base64');
    const authTag = Buffer.from(parts[3], 'base64');
    const encrypted = Buffer.from(parts[4], 'base64');
    const keys = this.getDecryptionKeys();

    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      try {
        const decipher = createDecipheriv('aes-256-gcm', keys[keyIndex], iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
          decipher.update(encrypted),
          decipher.final(),
        ]);

        return { plainText: decrypted.toString('utf8'), keyIndex };
      } catch {
        // Wrong key for this value; try the next one.
      }
    }

    return null;
  }

  /** Current key first, then any previous keys (comma separated). */
  private getDecryptionKeys(): Buffer[] {
    const previous = (
      this.configService.get<string>(
        'TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS',
      ) || ''
    )
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
      .map((key) =>
        this.parseKey(key, 'TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS'),
      );

    return [this.getEncryptionKey(), ...previous];
  }

  private getEncryptionKey(): Buffer {
    const rawKey = this.configService.get<string>(
      'TIRAMIS_SECRET_ENCRYPTION_KEY',
    );

    if (!rawKey) {
      throw new InternalServerErrorException(
        'TIRAMIS_SECRET_ENCRYPTION_KEY is missing',
      );
    }

    return this.parseKey(rawKey, 'TIRAMIS_SECRET_ENCRYPTION_KEY');
  }

  private parseKey(rawKey: string, name: string): Buffer {
    const key = Buffer.from(rawKey, 'base64');

    if (key.length !== 32) {
      throw new InternalServerErrorException(
        `${name} must be a base64 encoded 32-byte key`,
      );
    }

    return key;
  }
}
