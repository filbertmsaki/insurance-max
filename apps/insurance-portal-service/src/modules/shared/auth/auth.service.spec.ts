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
import { BranchesService } from '../../tenant/branches/branches.service';
import { DepartmentsService } from '../../tenant/departments/departments.service';
import { MailService } from '../mail/mail.service';
import { TwoFaService } from './2fa/2fa.service';
import { OtpService } from '../otp/otp.service';
import { SessionsService } from '../sessions/sessions.service';
import { DevicesService } from '../devices/devices.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { comparePasswords } from '@insurance-max/portal-shared/utils/hash.util';

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 900;

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
  is_phone_verified: true,
  is_two_factor_enabled: false,
  failed_login_attempts: 0,
  locked_until: null,
  roles: [],
  permissions: [],
};

const mockCompanySummary = {
  companyId: 'uuid-company-1',
  companyName: 'Test Company',
  companySlug: 'test-company',
  companyType: 'INSURER',
  membershipId: 'uuid-membership-1',
  isDefault: true,
  roles: ['ADMINISTRATOR'],
  permissions: ['users:read'],
  activeBranchId: null,
  activeBranchCode: null,
  activeBranchName: null,
  defaultSalePointId: null,
  defaultSalePointCode: null,
  defaultSalePointName: null,
  assignedBranchIds: [],
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let companiesService: jest.Mocked<CompaniesService>;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;
  let sessionsService: jest.Mocked<SessionsService>;
  let devicesService: jest.Mocked<DevicesService>;
  let twoFaService: jest.Mocked<TwoFaService>;
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
            findByPhone: jest.fn(),
            updateLastLogin: jest.fn(),
            incrementLoginAttempts: jest.fn(),
            resetLoginAttempts: jest.fn(),
            lockAccount: jest.fn(),
            findByEmail: jest.fn(),
            markPhoneVerified: jest.fn(),
            createStandaloneUser: jest.fn(),
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
            setActiveMembership: jest
              .fn()
              .mockResolvedValue(mockCompanySummary),
            listUserCompanies: jest
              .fn()
              .mockResolvedValue([mockCompanySummary]),
            createForCompany: jest.fn(),
          },
        },
        {
          provide: BranchesService,
          useValue: {
            setUserActiveBranch: jest.fn(),
          },
        },
        {
          provide: DepartmentsService,
          useValue: {
            setActiveDepartment: jest.fn(),
            reconcileActiveDepartmentForBranch: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-jwt-token'),
            verify: jest.fn(),
            decode: jest
              .fn()
              .mockReturnValue({ exp: FUTURE_EXP, jti: 'decoded-jti' }),
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
                'app.auth.twoFactorMaxAttempts': 5,
                'app.auth.twoFactorExpiration': '5m',
                'app.auth.allowTrustedDeviceBypass': true,
              };
              return config[key] ?? def;
            }),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                JWT_ACCESS_SECRET: 'access-secret',
                JWT_REFRESH_SECRET: 'refresh-secret',
                JWT_TEMP_SECRET: 'temp-secret',
                JWT_RESET_SECRET: 'reset-secret',
                JWT_2FA_SECRET: '2fa-secret',
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
          useValue: {
            verify2FALogin: jest.fn(),
            is2FARequired: jest.fn().mockResolvedValue(false),
            getRequirement: jest.fn().mockResolvedValue({
              required: false,
              enrolled: false,
              allowTrustedDeviceBypass: true,
              stepUpMaxAgeMinutes: 10,
            }),
          },
        },
        {
          provide: OtpService,
          useValue: { generate: jest.fn(), verify: jest.fn() },
        },
        {
          provide: SessionsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'session-uuid-1' }),
            bindRefreshToken: jest.fn(),
            rotateRefreshToken: jest.fn(),
            revokeAllUserSessions: jest.fn(),
            revoke: jest.fn(),
          },
        },
        {
          provide: DevicesService,
          useValue: {
            upsert: jest.fn().mockResolvedValue({ id: 'device-uuid-1' }),
            isTrusted: jest.fn().mockResolvedValue(false),
            trustDevice: jest.fn(),
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
            getJson: jest.fn(),
            setJson: jest.fn(),
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn(),
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
    devicesService = module.get(DevicesService);
    twoFaService = module.get(TwoFaService);
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
      await expect(
        service.validateUser(mockUser.email, 'pass'),
      ).rejects.toThrow(ForbiddenException);
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

    it('clears an expired lock and continues validating the password', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() - 60000),
        failed_login_attempts: 5,
      } as any);

      const result = await service.validateUser(mockUser.email, 'pass');

      expect(usersService.resetLoginAttempts).toHaveBeenCalledWith(mockUser.id);
      expect(result).toMatchObject({ id: mockUser.id, status: 'active' });
    });
  });

  describe('phoneLogin — 2FA enforcement (previously bypassed)', () => {
    beforeEach(() => {
      usersService.findByPhone.mockResolvedValue({ ...mockUser } as any);
    });

    it('requires 2FA when enabled and the device is not trusted', async () => {
      twoFaService.getRequirement.mockResolvedValue({
        required: true,
        enrolled: true,
        allowTrustedDeviceBypass: true,
        stepUpMaxAgeMinutes: 10,
      });
      devicesService.isTrusted.mockResolvedValue(false);

      const result = await service.phoneLogin({
        phone: mockUser.phone,
        otp_id: 'otp-1',
        otp: '123456',
      });

      expect(result).toMatchObject({ requires2FA: true });
      expect((result as any).tempToken).toBeDefined();
      expect(sessionsService.create).not.toHaveBeenCalled();
    });

    it('bypasses 2FA and issues a session when the device is trusted', async () => {
      twoFaService.getRequirement.mockResolvedValue({
        required: true,
        enrolled: true,
        allowTrustedDeviceBypass: true,
        stepUpMaxAgeMinutes: 10,
      });
      devicesService.isTrusted.mockResolvedValue(true);

      const result = await service.phoneLogin({
        phone: mockUser.phone,
        otp_id: 'otp-1',
        otp: '123456',
      });

      expect(result).not.toHaveProperty('requires2FA');
      expect(sessionsService.create).toHaveBeenCalled();
      expect(result).toHaveProperty('access_token');
    });
  });

  describe('customer-scope authentication', () => {
    it('issues a customer-scope session when a valid user has no active companies', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({ ...mockUser } as any);
      companiesService.listUserCompanies.mockResolvedValueOnce([]);

      const result = await service.login({
        email: mockUser.email,
        password: 'StrongPassword@2026',
      });

      expect(result).toMatchObject({
        scope: 'customer',
        companies: [],
      });
      expect(sessionsService.create).toHaveBeenCalled();
    });
  });

  describe('completePasswordlessLogin — 2FA enforcement (previously bypassed)', () => {
    beforeEach(() => {
      redisService.get.mockResolvedValue(mockUser.id);
      usersService.findById.mockResolvedValue({ ...mockUser } as any);
    });

    it('requires 2FA when enabled and the device is not trusted', async () => {
      twoFaService.getRequirement.mockResolvedValue({
        required: true,
        enrolled: true,
        allowTrustedDeviceBypass: true,
        stepUpMaxAgeMinutes: 10,
      });
      devicesService.isTrusted.mockResolvedValue(false);

      const result = await service.completePasswordlessLogin('link-token');

      expect(result).toMatchObject({ requires2FA: true });
      expect(redisService.del).toHaveBeenCalledWith('passwordless:link-token');
    });
  });

  describe('complete2FALogin', () => {
    const deviceId = 'device-uuid-1';
    const challengeJti = 'challenge-jti-1';

    function mockValidTempToken(overrides: Record<string, unknown> = {}) {
      jwtService.verify = jest.fn().mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        scope: 'company',
        userType: mockUser.user_type,
        companyId: mockCompanySummary.companyId,
        deviceId,
        jti: challengeJti,
        temp: true,
        type: '2fa-temp',
        ...overrides,
      });
    }

    beforeEach(() => {
      mockValidTempToken();
      redisService.getJson.mockResolvedValue({
        userId: mockUser.id,
        deviceId,
        createdAt: new Date().toISOString(),
      });
      redisService.incr.mockResolvedValue(1);
      twoFaService.verify2FALogin = jest
        .fn()
        .mockResolvedValue({ valid: true, used_backup_code: false });
      usersService.findById.mockResolvedValue({ ...mockUser } as any);
      devicesService.upsert.mockResolvedValue({ id: deviceId } as any);
      companiesService.getMembershipContext = jest
        .fn()
        .mockResolvedValue(mockCompanySummary);
    });

    it('issues a session when the code is valid and the device is unchanged', async () => {
      const result = await service.complete2FALogin(
        'temp-token',
        '123456',
        false,
      );

      expect(sessionsService.create).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalledWith(
        `auth:2fa:challenge:${challengeJti}`,
      );
      expect(result).toHaveProperty('access_token');
    });

    it('trusts the device when trustDevice is true', async () => {
      await service.complete2FALogin('temp-token', '123456', true);

      expect(devicesService.trustDevice).toHaveBeenCalledWith(
        deviceId,
        mockUser.id,
      );
    });

    it('throws when the resolved device differs from the one on the temp token', async () => {
      devicesService.upsert.mockResolvedValue({
        id: 'a-different-device',
      } as any);

      await expect(
        service.complete2FALogin('temp-token', '123456', false),
      ).rejects.toThrow(UnauthorizedException);

      expect(sessionsService.create).not.toHaveBeenCalled();
    });

    it('throws and clears the challenge after exceeding the max attempts', async () => {
      redisService.incr.mockResolvedValue(6);

      await expect(
        service.complete2FALogin('temp-token', '000000', false),
      ).rejects.toThrow(UnauthorizedException);

      expect(redisService.del).toHaveBeenCalledWith(
        `auth:2fa:challenge:${challengeJti}`,
      );
      expect(redisService.del).toHaveBeenCalledWith(
        `auth:2fa:challenge:${challengeJti}:attempts`,
      );
      expect(twoFaService.verify2FALogin).not.toHaveBeenCalled();
    });

    it('throws when the Redis challenge is missing or does not match', async () => {
      redisService.getJson.mockResolvedValue(null);

      await expect(
        service.complete2FALogin('temp-token', '123456', false),
      ).rejects.toThrow(UnauthorizedException);
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

    it('throws when the refresh token jti is already blacklisted', async () => {
      jwtService.verify = jest.fn().mockReturnValue({
        type: 'refresh',
        sub: mockUser.id,
        jti: 'old-jti',
        sessionId: 'session-uuid-1',
        scope: 'platform',
      });
      redisService.isBlacklisted.mockResolvedValue(true);

      await expect(
        service.refreshTokens({ refresh_token: 'old-refresh-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rotates the session refresh token and blacklists the old jti', async () => {
      jwtService.verify = jest.fn().mockReturnValue({
        type: 'refresh',
        sub: mockUser.id,
        jti: 'old-jti',
        sessionId: 'session-uuid-1',
        scope: 'company',
        companyId: mockCompanySummary.companyId,
        membershipId: mockCompanySummary.membershipId,
      });
      usersService.findById.mockResolvedValue({ ...mockUser } as any);
      companiesService.getMembershipContext = jest
        .fn()
        .mockResolvedValue(mockCompanySummary);

      const result = await service.refreshTokens({
        refresh_token: 'old-refresh-token',
      });

      expect(sessionsService.rotateRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-uuid-1',
          userId: mockUser.id,
          oldRefreshToken: 'old-refresh-token',
          newRefreshToken: 'signed-jwt-token',
        }),
      );
      expect(redisService.addToBlacklist).toHaveBeenCalledWith(
        'old-jti',
        expect.any(Number),
      );
      expect(result).toHaveProperty('access_token');
    });

    it('rejects reused refresh tokens surfaced by the sessions service', async () => {
      jwtService.verify = jest.fn().mockReturnValue({
        type: 'refresh',
        sub: mockUser.id,
        jti: 'old-jti',
        sessionId: 'session-uuid-1',
        scope: 'platform',
      });
      usersService.findById.mockResolvedValue({
        ...mockUser,
        user_type: 'SUPER_ADMIN',
      } as any);
      sessionsService.rotateRefreshToken.mockRejectedValue(
        new UnauthorizedException('Refresh token reuse was detected.'),
      );

      await expect(
        service.refreshTokens({ refresh_token: 'stolen-refresh-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('switchCompany', () => {
    it('reuses the existing session instead of creating a new one', async () => {
      jwtService.verify = jest.fn().mockReturnValue({
        sub: mockUser.id,
        sessionId: 'session-uuid-1',
        type: 'refresh',
      });
      usersService.findById.mockResolvedValue({ ...mockUser } as any);

      const result = await service.switchCompany({
        userId: mockUser.id,
        sessionId: 'session-uuid-1',
        refreshToken: 'old-refresh-token',
        companyId: mockCompanySummary.companyId,
      });

      expect(sessionsService.create).not.toHaveBeenCalled();
      expect(sessionsService.rotateRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-uuid-1',
          userId: mockUser.id,
          oldRefreshToken: 'old-refresh-token',
          newRefreshToken: 'signed-jwt-token',
        }),
      );
      expect(redisService.addToBlacklist).toHaveBeenCalled();
      expect(result).toHaveProperty('company');
    });

    it('rejects when the refresh token belongs to a different session', async () => {
      jwtService.verify = jest.fn().mockReturnValue({
        sub: mockUser.id,
        sessionId: 'a-different-session',
        type: 'refresh',
      });

      await expect(
        service.switchCompany({
          userId: mockUser.id,
          sessionId: 'session-uuid-1',
          refreshToken: 'old-refresh-token',
          companyId: mockCompanySummary.companyId,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects platform users switching company context', async () => {
      jwtService.verify = jest.fn().mockReturnValue({
        sub: mockUser.id,
        sessionId: 'session-uuid-1',
        type: 'refresh',
      });
      usersService.findById.mockResolvedValue({
        ...mockUser,
        user_type: 'SUPER_ADMIN',
      } as any);

      await expect(
        service.switchCompany({
          userId: mockUser.id,
          sessionId: 'session-uuid-1',
          refreshToken: 'old-refresh-token',
          companyId: mockCompanySummary.companyId,
        }),
      ).rejects.toThrow(ForbiddenException);
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
