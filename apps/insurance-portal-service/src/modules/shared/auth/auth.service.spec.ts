jest.mock('./2fa/2fa.service', () => ({
  TwoFaService: class TwoFaService {},
}));

jest.mock('@insurance-max/portal-shared/utils/hash.util', () => ({
  comparePasswords: jest.fn(),
  hashPassword: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../../tenant/users/users.service';
import { CompaniesService } from '../../platform/companies/companies.service';
import { MailService } from '../mail/mail.service';
import { TwoFaService } from './2fa/2fa.service';
import { OtpService } from '../otp/otp.service';
import { SessionsService } from '../sessions/sessions.service';
import { DevicesService } from '../devices/devices.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { comparePasswords } from '@insurance-max/portal-shared/utils/hash.util';

const mockUser = {
  id: 'uuid-user-1',
  email: 'test@example.com',
  password: '$argon2id$v=19$m=65536,t=3,p=1$abc$def',
  status: 'active',
  user_type: 'COMPANY_USER',
  first_name: 'John',
  last_name: 'Doe',
  user_no: 'USER-2025-00001',
  phone: '+255712345678',
  is_email_verified: true,
  is_two_factor_enabled: false,
  failed_login_attempts: 0,
  locked_until: null,
  roles: [],
  permissions: [],
};

const mockCompanyContext = {
  companyId: 'uuid-company-1',
  companyName: 'Test Company',
  companySlug: 'test-company',
  membershipId: 'uuid-membership-1',
  isDefault: true,
  roles: ['ADMINISTRATOR'],
  permissions: ['users:read'],
  status: 'active',
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let companiesService: jest.Mocked<CompaniesService>;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;
  let sessionsService: jest.Mocked<SessionsService>;
  let auditService: jest.Mocked<AuditService>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmailForAuth: jest.fn(),
            findById: jest.fn(),
              updateLastLogin: jest.fn(),
              incrementLoginAttempts: jest.fn(),
              resetLoginAttempts: jest.fn(),
              lockAccount: jest.fn(),
              findByEmail: jest.fn(),
              findByPhone: jest.fn(),
              updateVerificationToken: jest.fn(),
              markEmailVerified: jest.fn(),
              findByVerificationToken: jest.fn(),
              updatePassword: jest.fn(),
          },
        },
        {
          provide: CompaniesService,
          useValue: {
            getMembershipContext: jest.fn(),
            findActiveCompanyBySlug: jest.fn(),
            setActiveMembership: jest.fn(),
            createForCompany: jest.fn(),
            listUserCompanies: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: unknown) => {
              const config: Record<string, unknown> = {
                JWT_REFRESH_SECRET: 'refresh-secret',
                JWT_REFRESH_EXPIRATION: '7d',
                JWT_ACCESS_SECRET: 'access-secret',
                JWT_TEMP_SECRET: 'temp-secret',
                APP_NAME: 'TestApp',
                APP_URL: 'http://localhost:9999',
                'app.lockout.maxAttempts': 5,
                'app.lockout.durationMinutes': 30,
              };
              return config[key] ?? def;
            }),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                JWT_ACCESS_SECRET: 'access-secret',
                JWT_REFRESH_SECRET: 'refresh-secret',
                JWT_TEMP_SECRET: 'temp-secret',
                JWT_RESET_SECRET: 'reset-secret',
                APP_URL: 'http://localhost:9999',
              };
              if (!config[key]) throw new Error(`Missing config: ${key}`);
              return config[key];
            }),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
            sendEmailVerification: jest.fn(),
            sendPasswordlessLoginEmail: jest.fn(),
            sendWelcomeEmailAfterVerification: jest.fn(),
            sendPasswordChangedSuccessEmail: jest.fn(),
          },
        },
        {
          provide: TwoFaService,
          useValue: { verify2FALogin: jest.fn(), is2FARequired: jest.fn() },
        },
        {
          provide: OtpService,
          useValue: { generate: jest.fn(), verify: jest.fn() },
        },
        {
          provide: SessionsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'session-uuid-1' }),
            rotateToken: jest.fn(),
            revokeAllUserSessions: jest.fn(),
            validateRefreshToken: jest.fn(),
            revoke: jest.fn(),
          },
        },
        {
          provide: DevicesService,
          useValue: {
            upsert: jest.fn().mockResolvedValue({ id: 'device-uuid-1' }),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: RedisService,
          useValue: {
            addToBlacklist: jest.fn(),
            isBlacklisted: jest.fn().mockResolvedValue(false),
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    companiesService = module.get(CompaniesService);
    jwtService = module.get(JwtService);
    redisService = module.get(RedisService);
    sessionsService = module.get(SessionsService);
    auditService = module.get(AuditService);
    mailService = module.get(MailService);

    (comparePasswords as jest.Mock).mockResolvedValue(true);
  });

  describe('validateUser', () => {
    it('returns null when user not found', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(null);
      const result = await service.validateUser('x@x.com', 'pass');
      expect(result).toBeNull();
    });

    it('throws when account is locked', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() + 60000),
      } as any);
      await expect(service.validateUser(mockUser.email, 'pass')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the user even when account is inactive; status is enforced during login', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        ...mockUser,
        status: 'inactive',
      } as any);
      const result = await service.validateUser(mockUser.email, 'pass');
      expect(result).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        status: 'inactive',
      });
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('refreshTokens', () => {
    it('throws when refresh token payload is invalid type', async () => {
      jwtService.verify = jest
        .fn()
        .mockReturnValue({ type: 'access', sub: 'user-1' });
      await expect(
        service.refreshTokens({ refresh_token: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('returns generic message when user not found (no email enumeration)', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const result = await service.forgotPassword({ email: 'nobody@x.com' });
      expect(result.message).toBe(
        'If the email exists, you will receive a reset link',
      );
    });

    it('sends reset email when user found', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      const result = await service.forgotPassword({ email: mockUser.email });
      expect(result.message).toBe(
        'If the email exists, you will receive a reset link',
      );
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.first_name,
        expect.stringContaining('auth/reset-password?token='),
      );
    });
  });

  describe('verifyEmail', () => {
    it('throws BadRequestException for invalid/expired token', async () => {
      usersService.findByVerificationToken.mockResolvedValue(null);
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('marks email as verified for valid token', async () => {
      usersService.findByVerificationToken.mockResolvedValue(mockUser as any);
      usersService.markEmailVerified = jest.fn();
      const result = await service.verifyEmail('valid-token');
      expect(result.message).toBeDefined();
      expect(usersService.markEmailVerified).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
