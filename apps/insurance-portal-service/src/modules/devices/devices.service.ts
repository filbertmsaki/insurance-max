import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Device } from './entities/device.entity';

interface UpsertDeviceOptions {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
}

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  async upsert(options: UpsertDeviceOptions): Promise<Device> {
    const fingerprint = this.buildFingerprint(
      options.userAgent ?? '',
      options.ipAddress ?? '',
    );

    let device = await this.deviceRepo.findOne({
      where: { user_id: options.userId, fingerprint },
    });

    if (device) {
      await this.deviceRepo.update(device.id, { last_used_at: new Date() });
      return { ...device, last_used_at: new Date() };
    }

    const parsed = this.parseUserAgent(options.userAgent ?? '');
    device = this.deviceRepo.create({
      user_id: options.userId,
      fingerprint,
      device_name: options.deviceName ?? parsed.deviceName,
      device_type: parsed.deviceType,
      os: parsed.os,
      browser: parsed.browser,
      trusted: false,
    });

    return this.deviceRepo.save(device);
  }

  async findUserDevices(userId: string): Promise<Device[]> {
    return this.deviceRepo.find({
      where: { user_id: userId },
      order: { last_used_at: 'DESC' },
    });
  }

  async trustDevice(id: string, userId: string): Promise<Device> {
    const device = await this.deviceRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!device) throw new NotFoundException('Device not found');

    await this.deviceRepo.update(id, { trusted: true, trusted_at: new Date() });
    return { ...device, trusted: true, trusted_at: new Date() };
  }

  async removeDevice(id: string, userId: string): Promise<void> {
    const device = await this.deviceRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!device) throw new NotFoundException('Device not found');
    await this.deviceRepo.remove(device);
  }

  isTrusted(deviceId: string, devices: Device[]): boolean {
    return devices.some((d) => d.id === deviceId && d.trusted);
  }

  private buildFingerprint(userAgent: string, ip: string): string {
    return crypto
      .createHash('sha256')
      .update(`${userAgent}:${ip}`)
      .digest('hex');
  }

  private parseUserAgent(ua: string): {
    deviceName: string;
    deviceType: string;
    os: string;
    browser: string;
  } {
    const isMobile = /mobile|android|iphone|ipad/i.test(ua);
    const isTablet = /ipad|tablet/i.test(ua);
    const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    let os = 'Unknown OS';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad/i.test(ua)) os = 'iOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    let browser = 'Unknown Browser';
    if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/chrome/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua)) browser = 'Safari';
    else if (/edge/i.test(ua)) browser = 'Edge';

    return { deviceName: `${browser} on ${os}`, deviceType, os, browser };
  }
}
