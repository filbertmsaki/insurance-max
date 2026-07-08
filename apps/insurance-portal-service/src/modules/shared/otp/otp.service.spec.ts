import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { OtpService } from './otp.service';
import {
  OtpVerification,
  OtpChannel,
  OtpPurpose,
} from './entities/otp-verification.entity';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { SMS_PROVIDER } from './providers/sms.provider.interface';

const mockOtpRecord = {
  id: 'uuid-otp-1',
  target: '+255712345678',
  channel: OtpChannel.SMS,
  purpose: OtpPurpose.LOGIN,
  code_hash: 'abc123hash',
  attempts: 0,
  is_used: false,
  expires_at: new Date(Date.now() + 300000),
};

describe('OtpService', () => {
  let service: OtpService;
  let otpRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let redisService: jest.Mocked<RedisService>;
  let smsProvider: { send: jest.Mock };

  beforeEach(async () => {
    otpRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve({ ...entity, id: 'uuid-otp-1' }),
        ),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: getRepositoryToken(OtpVerification), useValue: otpRepo },
        {
          provide: RedisService,
          useValue: {
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn(),
            ttl: jest.fn().mockResolvedValue(600),
            del: jest.fn(),
            setJson: jest.fn(),
            getJson: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: unknown) => {
              const map: Record<string, unknown> = {
                'app.otp.length': 6,
                'app.otp.expirySeconds': 300,
                'app.otp.maxAttempts': 3,
              };
              return map[key] ?? def;
            }),
          },
        },
        {
          provide: MailService,
          useValue: { sendOtpEmail: jest.fn() },
        },
        {
          provide: SMS_PROVIDER,
          useValue: { send: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(OtpService);
    redisService = module.get(RedisService);
    smsProvider = module.get(SMS_PROVIDER);
  });

  describe('generate', () => {
    it('generates OTP and returns otpId', async () => {
      const result = await service.generate({
        target: '+255712345678',
        channel: OtpChannel.SMS,
        purpose: OtpPurpose.LOGIN,
      });

      expect(result.otpId).toBe('uuid-otp-1');
      expect(otpRepo.save).toHaveBeenCalled();
      expect(smsProvider.send).toHaveBeenCalled();
    });

    it('throws when throttle limit exceeded', async () => {
      (redisService.incr as jest.Mock).mockResolvedValue(4);

      await expect(
        service.generate({
          target: '+255712345678',
          channel: OtpChannel.SMS,
          purpose: OtpPurpose.LOGIN,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verify', () => {
    it('throws when OTP record not found', async () => {
      (redisService.getJson as jest.Mock).mockResolvedValue(null);
      otpRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verify('bad-id', '123456', '+255712345678', OtpPurpose.LOGIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when OTP record not found in DB', async () => {
      (redisService.getJson as jest.Mock).mockResolvedValue({
        hash: 'somehash',
        target: '+255712345678',
        purpose: OtpPurpose.LOGIN,
      });
      otpRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verify(
          'uuid-otp-1',
          '123456',
          '+255712345678',
          OtpPurpose.LOGIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when OTP is expired', async () => {
      (redisService.getJson as jest.Mock).mockResolvedValue({
        hash: 'somehash',
        target: '+255712345678',
        purpose: OtpPurpose.LOGIN,
      });
      otpRepo.findOne.mockResolvedValue({
        ...mockOtpRecord,
        expires_at: new Date(Date.now() - 1000),
      });

      await expect(
        service.verify(
          'uuid-otp-1',
          '123456',
          '+255712345678',
          OtpPurpose.LOGIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
