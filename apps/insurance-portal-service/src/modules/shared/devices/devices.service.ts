import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { IsNull, MoreThan, Repository } from 'typeorm';

import { createHmac, createHash } from 'node:crypto';

import { Device } from './entities/device.entity';
import { SessionsService } from '../sessions/sessions.service';

interface UpsertDeviceOptions {
  userId: string;
  deviceToken?: string;
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
}

@Injectable()
export class DevicesService {
  private readonly trustedDeviceDays: number;

  private readonly fingerprintPepper: string;

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,

    private readonly sessionsService: SessionsService,

    private readonly configService: ConfigService,
  ) {
    this.trustedDeviceDays = this.configService.get<number>(
      'app.auth.trustedDeviceDays',
      30,
    );

    this.fingerprintPepper = this.configService.getOrThrow<string>(
      'AUTH_DEVICE_TOKEN_PEPPER',
    );
  }

  async upsert(options: UpsertDeviceOptions): Promise<Device> {
    const fingerprint = this.buildFingerprint(
      options.userId,
      options.deviceToken,
      options.userAgent,
      options.ipAddress,
    );

    let device = await this.deviceRepo.findOne({
      where: {
        user_id: options.userId,
        fingerprint,
      },
    });

    const parsed = this.parseUserAgent(options.userAgent ?? '');

    if (device) {
      await this.deviceRepo.update(device.id, {
        last_used_at: new Date(),
        last_ip_address: options.ipAddress ?? device.last_ip_address,
        device_name:
          options.deviceName ?? device.device_name ?? parsed.deviceName,
        device_type: parsed.deviceType,
        os: parsed.os,
        browser: parsed.browser,
        revoked_at: null,
      });

      device = await this.findOwnedDevice(device.id, options.userId);

      return device;
    }

    device = this.deviceRepo.create({
      user_id: options.userId,
      fingerprint,
      device_name: options.deviceName ?? parsed.deviceName,
      device_type: parsed.deviceType,
      os: parsed.os,
      browser: parsed.browser,
      last_ip_address: options.ipAddress ?? null,
      trusted: false,
      trusted_at: null,
      trusted_until: null,
      revoked_at: null,
    });

    return this.deviceRepo.save(device);
  }

  async isTrusted(userId: string, deviceToken?: string): Promise<boolean> {
    if (!this.isValidDeviceToken(deviceToken)) {
      return false;
    }

    const fingerprint = this.buildFingerprint(userId, deviceToken);

    const device = await this.deviceRepo.findOne({
      where: {
        user_id: userId,
        fingerprint,
        trusted: true,
        trusted_until: MoreThan(new Date()),
        revoked_at: IsNull(),
      },
    });

    return Boolean(device);
  }

  async findUserDevices(userId: string): Promise<Device[]> {
    return this.deviceRepo.find({
      where: {
        user_id: userId,
        revoked_at: IsNull(),
      },
      order: {
        last_used_at: 'DESC',
      },
    });
  }

  async trustDevice(id: string, userId: string): Promise<Device> {
    const device = await this.findOwnedDevice(id, userId);

    const trustedAt = new Date();

    const trustedUntil = new Date(
      trustedAt.getTime() + this.trustedDeviceDays * 24 * 60 * 60 * 1000,
    );

    await this.deviceRepo.update(device.id, {
      trusted: true,
      trusted_at: trustedAt,
      trusted_until: trustedUntil,
      revoked_at: null,
    });

    return this.findOwnedDevice(device.id, userId);
  }

  async untrustDevice(id: string, userId: string): Promise<Device> {
    const device = await this.findOwnedDevice(id, userId);

    await this.deviceRepo.update(device.id, {
      trusted: false,
      trusted_at: null,
      trusted_until: null,
    });

    return this.findOwnedDevice(device.id, userId);
  }

  async removeDevice(id: string, userId: string): Promise<void> {
    const device = await this.findOwnedDevice(id, userId);

    await this.sessionsService.revokeDeviceSessions(userId, device.id);

    await this.deviceRepo.update(device.id, {
      trusted: false,
      trusted_at: null,
      trusted_until: null,
      revoked_at: new Date(),
    });
  }

  private async findOwnedDevice(id: string, userId: string): Promise<Device> {
    const device = await this.deviceRepo.findOne({
      where: {
        id,
        user_id: userId,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found.');
    }

    return device;
  }

  private buildFingerprint(
    userId: string,
    deviceToken?: string,
    userAgent = '',
    ipAddress = '',
  ): string {
    if (this.isValidDeviceToken(deviceToken)) {
      return createHmac('sha256', this.fingerprintPepper)
        .update(`${userId}:${deviceToken}`)
        .digest('hex');
    }

    /*
     * Compatibility fallback only.
     * Fallback devices can be listed but should
     * never be considered trusted.
     */
    return createHash('sha256')
      .update(['legacy', userId, userAgent, ipAddress].join(':'))
      .digest('hex');
  }

  private isValidDeviceToken(token?: string): token is string {
    if (!token) {
      return false;
    }

    const normalized = token.trim();

    if (normalized.length < 32 || normalized.length > 256) {
      throw new BadRequestException('Invalid device token.');
    }

    return true;
  }

  private parseUserAgent(userAgent: string): {
    deviceName: string;
    deviceType: string;
    os: string;
    browser: string;
  } {
    const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);

    const isTablet = /ipad|tablet/i.test(userAgent);

    const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    let os = 'Unknown OS';

    if (/windows/i.test(userAgent)) {
      os = 'Windows';
    } else if (/mac os/i.test(userAgent)) {
      os = 'macOS';
    } else if (/android/i.test(userAgent)) {
      os = 'Android';
    } else if (/iphone|ipad/i.test(userAgent)) {
      os = 'iOS';
    } else if (/linux/i.test(userAgent)) {
      os = 'Linux';
    }

    let browser = 'Unknown Browser';

    if (/edg\//i.test(userAgent)) {
      browser = 'Edge';
    } else if (/firefox/i.test(userAgent)) {
      browser = 'Firefox';
    } else if (/chrome/i.test(userAgent)) {
      browser = 'Chrome';
    } else if (/safari/i.test(userAgent)) {
      browser = 'Safari';
    }

    return {
      deviceName: `${browser} on ${os}`,
      deviceType,
      os,
      browser,
    };
  }
}
