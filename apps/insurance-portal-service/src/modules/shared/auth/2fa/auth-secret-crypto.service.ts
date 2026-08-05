import { Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class AuthSecretCryptoService {
  private readonly encryptionKey: Buffer;

  private readonly backupCodePepper: string;

  constructor(private readonly configService: ConfigService) {
    const encodedKey = this.configService.getOrThrow<string>(
      'AUTH_SECRET_ENCRYPTION_KEY',
    );

    this.encryptionKey = Buffer.from(encodedKey, 'base64');

    if (this.encryptionKey.length !== 32) {
      throw new Error(
        'AUTH_SECRET_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
      );
    }

    this.backupCodePepper = this.configService.getOrThrow<string>(
      'AUTH_BACKUP_CODE_PEPPER',
    );
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      'enc',
      'v1',
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':');
  }

  decrypt(storedValue: string): string {
    if (!storedValue.startsWith('enc:v1:')) {
      /*
       * Compatibility for existing plaintext secrets.
       * The caller should rewrite it in encrypted form
       * after successful verification.
       */
      return storedValue;
    }

    const [prefix, version, encodedIv, encodedTag, encodedCipher] =
      storedValue.split(':');

    if (
      prefix !== 'enc' ||
      version !== 'v1' ||
      !encodedIv ||
      !encodedTag ||
      !encodedCipher
    ) {
      throw new Error('Invalid encrypted 2FA secret.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(encodedIv, 'base64url'),
    );

    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encodedCipher, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  isEncrypted(value: string): boolean {
    return value.startsWith('enc:v1:');
  }

  hashBackupCode(normalizedCode: string): string {
    return createHmac('sha256', this.backupCodePepper)
      .update(normalizedCode)
      .digest('hex');
  }
}
