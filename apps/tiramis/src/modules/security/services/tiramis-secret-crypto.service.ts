import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

@Injectable()
export class TiramisSecretCryptoService {
  private readonly prefix = 'enc:v1';

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

    const parts = value.split(':');

    if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== this.prefix) {
      throw new InternalServerErrorException('Invalid encrypted secret format');
    }

    const key = this.getEncryptionKey();
    const iv = Buffer.from(parts[2], 'base64');
    const authTag = Buffer.from(parts[3], 'base64');
    const encrypted = Buffer.from(parts[4], 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  mask(value?: string | null): string {
    if (!value) {
      return '';
    }

    const plain = this.decryptIfEncrypted(value) || '';

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

  private getEncryptionKey(): Buffer {
    const rawKey = process.env.TIRAMIS_SECRET_ENCRYPTION_KEY;

    if (!rawKey) {
      throw new InternalServerErrorException(
        'TIRAMIS_SECRET_ENCRYPTION_KEY is missing',
      );
    }

    const key = Buffer.from(rawKey, 'base64');

    if (key.length !== 32) {
      throw new InternalServerErrorException(
        'TIRAMIS_SECRET_ENCRYPTION_KEY must be a base64 encoded 32-byte key',
      );
    }

    return key;
  }
}
