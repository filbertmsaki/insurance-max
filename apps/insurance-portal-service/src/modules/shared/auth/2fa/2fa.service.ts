import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { generateSecret, generateURI, verify } from 'otplib';

import * as qrcode from 'qrcode';

import { randomBytes } from 'node:crypto';

import { UsersService } from '../../../tenant/users/users.service';
import { AuthSecretCryptoService } from './auth-secret-crypto.service';

@Injectable()
export class TwoFaService {
  constructor(
    private readonly usersService: UsersService,

    private readonly configService: ConfigService,

    private readonly cryptoService: AuthSecretCryptoService,
  ) {}

  async generate2FASetup(userId: string) {
    const user = await this.usersService.findByIdFor2FA(userId);

    if (user.is_two_factor_enabled) {
      throw new BadRequestException('2FA is already enabled for this account.');
    }

    const secret = generateSecret({ length: 32 });

    const serviceName =
      this.configService.get<string>('app.name') || 'Insurance Max';

    const otpAuthUrl = generateURI({
      issuer: serviceName,
      label: user.email,
      secret,
    });

    const qrCodeUrl = await qrcode.toDataURL(otpAuthUrl);

    await this.usersService.update2FASecret(
      userId,
      this.cryptoService.encrypt(secret),
    );

    return {
      secret,
      qr_code_url: qrCodeUrl,
      otp_auth_url: otpAuthUrl,
    };
  }

  async verifyAndActivate2FA(userId: string, code: string) {
    const user = await this.usersService.findByIdFor2FA(userId);

    if (!user.two_factor_secret) {
      throw new BadRequestException('No 2FA setup is in progress.');
    }

    const secret = this.cryptoService.decrypt(user.two_factor_secret);

    const normalizedCode = this.normalizeCode(code);

    const result = await verify({
      secret,
      token: normalizedCode,
    });

    if (!result.valid) {
      throw new BadRequestException('Invalid 2FA code.');
    }

    const backupCodes = this.generateBackupCodes();

    const hashedCodes = backupCodes.map((backupCode) =>
      this.cryptoService.hashBackupCode(backupCode),
    );

    await this.usersService.activate2FA(
      userId,
      this.cryptoService.encrypt(secret),
      hashedCodes,
    );

    return {
      message: 'Two-factor authentication has been enabled.',
      backup_codes: this.formatBackupCodes(backupCodes),
    };
  }

  async verify2FALogin(
    userId: string,
    code: string,
  ): Promise<{
    valid: true;
    used_backup_code: boolean;
  }> {
    const user = await this.usersService.findByIdFor2FA(userId);

    if (!user.is_two_factor_enabled || !user.two_factor_secret) {
      throw new BadRequestException('2FA is not enabled for this user.');
    }

    const normalizedCode = this.normalizeCode(code);

    const secret = this.cryptoService.decrypt(user.two_factor_secret);

    const totpResult = await verify({
      secret,
      token: normalizedCode,
    });

    if (totpResult.valid) {
      /*
       * Lazily migrate existing plaintext secrets.
       */
      if (!this.cryptoService.isEncrypted(user.two_factor_secret)) {
        await this.usersService.update2FASecret(
          userId,
          this.cryptoService.encrypt(secret),
        );
      }

      return {
        valid: true,
        used_backup_code: false,
      };
    }

    if (user.two_factor_backup_codes?.length) {
      const hashedCode = this.cryptoService.hashBackupCode(normalizedCode);

      const index = user.two_factor_backup_codes.indexOf(hashedCode);

      if (index !== -1) {
        const remainingCodes = user.two_factor_backup_codes.filter(
          (_value, codeIndex) => codeIndex !== index,
        );

        await this.usersService.updateBackupCodes(userId, remainingCodes);

        return {
          valid: true,
          used_backup_code: true,
        };
      }
    }

    throw new UnauthorizedException('Invalid 2FA code.');
  }

  async disable2FA(userId: string, code: string) {
    const user = await this.usersService.findByIdFor2FA(userId);

    if (!user.is_two_factor_enabled) {
      throw new BadRequestException('2FA is not enabled.');
    }

    await this.verify2FALogin(userId, code);

    await this.usersService.disable2FA(userId);

    return {
      message: 'Two-factor authentication has been disabled.',
    };
  }

  async is2FARequired(userId: string): Promise<boolean> {
    const user = await this.usersService.findByIdFor2FA(userId);

    return Boolean(user.is_two_factor_enabled);
  }

  async regenerateBackupCodes(userId: string, code: string) {
    const user = await this.usersService.findByIdFor2FA(userId);

    if (!user.is_two_factor_enabled) {
      throw new BadRequestException('2FA is not enabled.');
    }

    await this.verify2FALogin(userId, code);

    const backupCodes = this.generateBackupCodes();

    const hashedCodes = backupCodes.map((backupCode) =>
      this.cryptoService.hashBackupCode(backupCode),
    );

    await this.usersService.updateBackupCodes(userId, hashedCodes);

    return {
      message:
        'New backup codes have been generated. Previous backup codes are invalid.',
      backup_codes: this.formatBackupCodes(backupCodes),
    };
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: 10 }, () =>
      randomBytes(5).toString('hex').toUpperCase(),
    );
  }

  private normalizeCode(code: string): string {
    return code.replace(/[\s-]/g, '').toUpperCase();
  }

  private formatBackupCodes(codes: string[]): string[] {
    return codes.map((code) => `${code.slice(0, 5)}-${code.slice(5)}`);
  }
}
