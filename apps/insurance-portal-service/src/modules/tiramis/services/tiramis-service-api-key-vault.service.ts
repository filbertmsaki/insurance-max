import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

@Injectable()
export class TiramisServiceApiKeyVaultService {
  private readonly prefix = 'enc:v1:aes-256-gcm';

  constructor(private readonly configService: ConfigService) {}

  encrypt(apiKey?: string | null): string | null {
    if (!apiKey) {
      return null;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(apiKey, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      this.prefix,
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':');
  }

  decrypt(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const [prefix, version, algorithm, iv, tag, encrypted] = value.split(':');
    if (`${prefix}:${version}:${algorithm}` !== this.prefix) {
      throw new InternalServerErrorException(
        'Stored TIRAMIS API key is not encrypted.',
      );
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  mask(value?: string | null): string | null {
    const plain = this.decrypt(value);
    if (!plain) {
      return null;
    }
    return `${plain.slice(0, 8)}...${plain.slice(-4)}`;
  }

  private key(): Buffer {
    return createHash('sha256')
      .update(
        this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        'utf8',
      )
      .digest();
  }
}
