import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  OtpVerification,
  OtpChannel,
  OtpPurpose,
} from './entities/otp-verification.entity';
import { RedisService } from '../redis/redis.service';
import type { SmsProvider } from './providers/sms.provider.interface';
import { SMS_PROVIDER } from './providers/sms.provider.interface';
import { MailService } from '../mail/mail.service';

interface OtpGenerateOptions {
  userId?: string;
  target: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  ipAddress?: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  private readonly otpLength: number;
  private readonly expirySeconds: number;
  private readonly maxAttempts: number;

  constructor(
    @InjectRepository(OtpVerification)
    private readonly otpRepo: Repository<OtpVerification>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {
    this.otpLength = configService.get<number>('app.otp.length', 6);
    this.expirySeconds = configService.get<number>(
      'app.otp.expirySeconds',
      300,
    );
    this.maxAttempts = configService.get<number>('app.otp.maxAttempts', 3);
  }

  async generate(
    options: OtpGenerateOptions,
  ): Promise<{ otpId: string; expiresAt: Date }> {
    const { userId, target, channel, purpose, ipAddress } = options;

    // Throttle: max 3 OTPs per 10 minutes per target+purpose
    const throttleKey = `otp:throttle:${target}:${purpose}`;
    const throttleCount = await this.redisService.incr(throttleKey);
    if (throttleCount === 1) {
      await this.redisService.expire(throttleKey, 600);
    }
    if (throttleCount > 3) {
      throw new BadRequestException(
        'Too many OTP requests. Please wait before requesting another code.',
      );
    }

    const otp = this.generateCode();
    const otpHash = this.hashCode(otp);
    const expiresAt = new Date(Date.now() + this.expirySeconds * 1000);

    const record = this.otpRepo.create({
      user_id: userId ?? null,
      target,
      channel,
      purpose,
      otp_hash: otpHash,
      expires_at: expiresAt,
      ip_address: ipAddress ?? null,
    });
    const saved = await this.otpRepo.save(record);

    // Cache OTP in Redis for fast verification
    await this.redisService.setJson(
      `otp:${saved.id}`,
      { hash: otpHash, target, purpose },
      this.expirySeconds,
    );

    // Send OTP
    await this.sendOtp(channel, target, otp, purpose);

    return { otpId: saved.id, expiresAt };
  }

  async verify(
    otpId: string,
    code: string,
    target: string,
    purpose: OtpPurpose,
  ): Promise<boolean> {
    const cached = await this.redisService.getJson<{
      hash: string;
      target: string;
      purpose: string;
    }>(`otp:${otpId}`);

    if (!cached || cached.target !== target || cached.purpose !== purpose) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const record = await this.otpRepo.findOne({ where: { id: otpId } });
    if (!record) throw new BadRequestException('OTP not found');

    if (record.is_verified) {
      throw new BadRequestException('OTP has already been used');
    }

    if (new Date() > record.expires_at) {
      throw new BadRequestException('OTP has expired');
    }

    if (record.attempts >= this.maxAttempts) {
      throw new BadRequestException(
        'Maximum OTP attempts exceeded. Request a new code.',
      );
    }

    const isValid = this.verifyCode(code, cached.hash);

    await this.otpRepo.update(record.id, {
      attempts: record.attempts + 1,
      is_verified: isValid,
      verified_at: isValid ? new Date() : null,
    });

    if (isValid) {
      await this.redisService.del(`otp:${otpId}`);
    }

    if (!isValid) {
      throw new BadRequestException('Invalid OTP code');
    }

    return true;
  }

  async invalidateUserOtps(userId: string, purpose: OtpPurpose): Promise<void> {
    await this.otpRepo.update(
      { user_id: userId, purpose, is_verified: false },
      { is_verified: true },
    );
  }

  private generateCode(): string {
    const max = Math.pow(10, this.otpLength);
    const code = crypto.randomInt(0, max);
    return code.toString().padStart(this.otpLength, '0');
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private verifyCode(code: string, hash: string): boolean {
    const codeHash = this.hashCode(code);
    return crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(hash));
  }

  private async sendOtp(
    channel: OtpChannel,
    target: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const message = this.buildOtpMessage(otp, purpose);

    if (channel === OtpChannel.SMS) {
      try {
        await this.smsProvider.send({ to: target, body: message });
      } catch (err) {
        this.logger.error(`Failed to send SMS OTP to ${target}`, err);
      }
    } else if (channel === OtpChannel.EMAIL) {
      try {
        await this.mailService.sendOtpEmail(
          target,
          otp,
          purpose,
          this.expirySeconds,
        );
      } catch (err) {
        this.logger.error(`Failed to send email OTP to ${target}`, err);
      }
    }
  }

  private buildOtpMessage(otp: string, purpose: OtpPurpose): string {
    const purposeLabels: Record<OtpPurpose, string> = {
      [OtpPurpose.LOGIN]: 'login',
      [OtpPurpose.REGISTRATION]: 'registration',
      [OtpPurpose.PHONE_VERIFY]: 'phone verification',
      [OtpPurpose.PASSWORD_RESET]: 'password reset',
      [OtpPurpose.TRANSACTION]: 'transaction authorization',
    };
    const label = purposeLabels[purpose] ?? purpose;
    return `Your ${label} code is: ${otp}. Valid for ${Math.ceil(this.expirySeconds / 60)} minutes. Never share this code.`;
  }
}
