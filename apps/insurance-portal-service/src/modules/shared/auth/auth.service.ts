import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildUrl } from '@insurance-max/shared-config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { StringValue } from 'ms';

import {
  AuthScope,
  UserType,
  PLATFORM_USER_TYPES,
} from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  comparePasswords,
  hashPassword,
} from '@insurance-max/portal-shared/utils/hash.util';
import { CompaniesService } from '../../platform/companies/companies.service';
import {
  CompanyMembershipContext,
  CompanySummary,
} from '../../platform/companies/interfaces/company-membership-context.interface';
import { MailService } from '../mail/mail.service';
import { User } from '../../tenant/users/entities/user.entity';
import { UsersService } from '../../tenant/users/users.service';
import { TwoFaService } from './2fa/2fa.service';
import { OtpService } from '../otp/otp.service';
import { SessionsService } from '../sessions/sessions.service';
import { DevicesService } from '../devices/devices.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { RedisService } from '../redis/redis.service';
import {
  OtpChannel,
  OtpPurpose,
} from '../otp/entities/otp-verification.entity';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { LoginDto } from './dtos/login.dto';
import { LogoutDto } from './dtos/logout.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { RegisterDto } from './dtos/register.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { SendPhoneOtpDto, PhoneLoginDto } from './dtos/phone-login.dto';
import { SendOtpDto } from './dtos/send-otp.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';

type AccessTokenPayload = {
  sub: string;
  email: string;
  scope: AuthScope;
  userType: UserType;
  companyId?: string;
  companySlug?: string;
  companyName?: string;
  companyType?: string;
  membershipId?: string;
  activeBranchId?: string | null;
  activeBranchCode?: string | null;
  activeBranchName?: string | null;
  defaultSalePointId?: string | null;
  defaultSalePointCode?: string | null;
  defaultSalePointName?: string | null;
  assignedBranchIds?: string[];
  roles: string[];
  permissions: string[];
  type: 'access';
  iss: string;
  aud: string;
  sessionId: string;
  jti: string;
};

type RefreshTokenPayload = {
  sub: string;
  scope: AuthScope;
  userType: UserType;
  companyId?: string;
  membershipId?: string;
  sessionId?: string;
  type: 'refresh';
  jti: string;
};

type TwoFactorTempTokenPayload = {
  sub: string;
  email: string;
  scope: AuthScope;
  userType: UserType;
  companyId?: string;
  temp: true;
  type: '2fa-temp';
};

type PlatformAccessContext = {
  scope: 'platform';
  userType: UserType;
  roles: string[];
  permissions: string[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly twoFaService: TwoFaService,
    private readonly companiesService: CompaniesService,
    private readonly otpService: OtpService,
    private readonly sessionsService: SessionsService,
    private readonly devicesService: DevicesService,
    private readonly auditService: AuditService,
    private readonly redisService: RedisService,
  ) {}

  // ── Email/password login ────────────────────────────────────────────────────

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmailForAuth(email);
    if (!user) return null;

    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      throw new ForbiddenException(
        'Account is temporarily locked due to too many failed login attempts.',
      );
    }

    const match = await comparePasswords(pass, user.password ?? '');
    if (!match) {
      await this.handleFailedLogin(user);
      return null;
    }

    if (user.failed_login_attempts > 0) {
      await this.usersService.resetLoginAttempts(user.id);
    }

    const { password, ...result } = user;
    void password;
    return result;
  }

  async login(loginDto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      await this.auditService.log({
        action: AuditAction.LOGIN_FAILURE,
        metadata: { email: loginDto.email },
        ipAddress: ip,
        status: 'failure',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new ForbiddenException(
        'Your account is inactive. Please contact an administrator.',
      );
    }

    if (
      this.isFeatureEnabled('ENABLE_EMAIL_VERIFICATION', true) &&
      !user.is_email_verified
    ) {
      return {
        requiresEmailVerification: true,
        message: 'Please verify your email address before continuing.',
        userId: user.id,
        email: user.email,
      };
    }

    const device = await this.devicesService.upsert({
      userId: user.id,
      userAgent,
      ipAddress: ip,
    });

    if (this.isPlatformUser(user)) {
      const platformContext = this.buildPlatformAccessContext(user as User);
      const is2FAEnabled = await this.twoFaService.is2FARequired(user.id);

      if (is2FAEnabled) {
        return this.build2FATempResponse(
          user.id,
          user.email,
          'platform',
          user.user_type as UserType,
        );
      }

      await this.usersService.updateLastLogin(user.id, new Date(), ip ?? null);
      const session = await this.sessionsService.create({
        userId: user.id,
        refreshToken: randomUUID(),
        deviceId: device.id,
        ipAddress: ip,
        userAgent,
      });

      await this.auditService.log({
        userId: user.id,
        action: AuditAction.LOGIN_SUCCESS,
        ipAddress: ip,
        userAgent,
        metadata: { scope: 'platform' },
      });

      const authResponse = this.generatePlatformAuthResponse(
        user as User,
        platformContext,
        session.id,
      );
      await this.sessionsService.bindRefreshToken(
        session.id,
        authResponse.refresh_token,
      );
      return authResponse;
    }

    const { activeCompany, companies } =
      await this.resolveSingleActiveCompanyForLogin(user.id);
    const is2FAEnabled = await this.twoFaService.is2FARequired(user.id);

    if (is2FAEnabled) {
      return this.build2FATempResponse(
        user.id,
        user.email,
        'company',
        user.user_type as UserType,
        activeCompany.companyId,
      );
    }

    await this.usersService.updateLastLogin(user.id, new Date(), ip ?? null);
    const activeCompanyContext =
      await this.companiesService.setActiveMembership(
        user.id,
        activeCompany.companyId,
      );
    const availableCompanies = companies;
    const session = await this.sessionsService.create({
      userId: user.id,
      refreshToken: randomUUID(),
      deviceId: device.id,
      ipAddress: ip,
      userAgent,
    });

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      ipAddress: ip,
      userAgent,
      metadata: { scope: 'company', companyId: activeCompany.companyId },
    });

    const authResponse = this.generateCompanyAuthResponse(
      user as User,
      activeCompanyContext,
      availableCompanies,
      session.id,
    );
    await this.sessionsService.bindRefreshToken(
      session.id,
      authResponse.refresh_token,
    );
    return authResponse;
  }

  // ── Phone OTP login ─────────────────────────────────────────────────────────

  async sendPhoneOtp(
    dto: SendPhoneOtpDto,
    ip?: string,
  ): Promise<{ otpId: string; expiresAt: Date }> {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) {
      // Prevent user enumeration — always respond success-like
      return {
        otpId: randomUUID(),
        expiresAt: new Date(Date.now() + 300_000),
      };
    }

    return this.otpService.generate({
      userId: user.id,
      target: dto.phone,
      channel: OtpChannel.SMS,
      purpose: OtpPurpose.LOGIN,
      ipAddress: ip,
    });
  }

  async phoneLogin(dto: PhoneLoginDto, ip?: string, userAgent?: string) {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'active') {
      throw new ForbiddenException('Your account is inactive.');
    }

    await this.otpService.verify(
      dto.otp_id,
      dto.otp,
      dto.phone,
      OtpPurpose.LOGIN,
    );

    if (!user.is_phone_verified) {
      await this.usersService.markPhoneVerified(user.id);
    }

    const device = await this.devicesService.upsert({
      userId: user.id,
      userAgent,
      ipAddress: ip,
    });
    await this.usersService.updateLastLogin(user.id, new Date(), ip ?? null);

    const session = await this.sessionsService.create({
      userId: user.id,
      refreshToken: randomUUID(),
      deviceId: device.id,
      ipAddress: ip,
      userAgent,
    });

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      ipAddress: ip,
      userAgent,
      metadata: { method: 'phone_otp' },
    });

    if (this.isPlatformUser(user)) {
      const ctx = this.buildPlatformAccessContext(user);
      const authResponse = this.generatePlatformAuthResponse(
        user,
        ctx,
        session.id,
      );
      await this.sessionsService.bindRefreshToken(
        session.id,
        authResponse.refresh_token,
      );
      return authResponse;
    }

    const { activeCompany, companies: availableCompanies } =
      await this.resolveSingleActiveCompanyForLogin(user.id);
    const companyCtx = await this.companiesService.setActiveMembership(
      user.id,
      activeCompany.companyId,
    );

    const authResponse = this.generateCompanyAuthResponse(
      user,
      companyCtx,
      availableCompanies,
      session.id,
    );
    await this.sessionsService.bindRefreshToken(
      session.id,
      authResponse.refresh_token,
    );
    return authResponse;
  }

  // ── Generic OTP operations ──────────────────────────────────────────────────

  async sendOtp(dto: SendOtpDto, userId?: string, ip?: string) {
    const target = dto.channel === OtpChannel.SMS ? dto.phone : dto.email;
    if (!target) {
      throw new BadRequestException(
        `${dto.channel === OtpChannel.SMS ? 'phone' : 'email'} is required for ${dto.channel} channel`,
      );
    }

    return this.otpService.generate({
      userId,
      target,
      channel: dto.channel,
      purpose: dto.purpose,
      ipAddress: ip,
    });
  }

  async verifyOtp(dto: VerifyOtpDto) {
    await this.otpService.verify(dto.otp_id, dto.code, dto.target, dto.purpose);
    return { verified: true };
  }

  // ── Passwordless login ──────────────────────────────────────────────────────

  async requestPasswordlessLink(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user)
      return { message: 'If the email exists, you will receive a login link.' };

    const token = randomUUID();
    const ttlSeconds = 600;
    await this.redisService.set(`passwordless:${token}`, user.id, ttlSeconds);

    const loginLink = this.buildFrontendAuthUrl(
      `auth/passwordless?token=${encodeURIComponent(token)}`,
    );

    try {
      await this.mailService.sendPasswordlessLoginEmail(
        user.email,
        user.first_name,
        loginLink,
      );
    } catch (err) {
      console.error('Failed to send passwordless email:', err);
    }

    return { message: 'If the email exists, you will receive a login link.' };
  }

  async completePasswordlessLogin(
    token: string,
    ip?: string,
    userAgent?: string,
  ) {
    const userId = await this.redisService.get(`passwordless:${token}`);
    if (!userId)
      throw new UnauthorizedException('Login link is invalid or expired');

    await this.redisService.del(`passwordless:${token}`);

    const user = await this.usersService.findById(userId);
    if (user.status !== 'active')
      throw new ForbiddenException('Account is inactive');

    const device = await this.devicesService.upsert({
      userId: user.id,
      userAgent,
      ipAddress: ip,
    });
    await this.usersService.updateLastLogin(user.id, new Date(), ip ?? null);

    const session = await this.sessionsService.create({
      userId: user.id,
      refreshToken: randomUUID(),
      deviceId: device.id,
      ipAddress: ip,
      userAgent,
    });

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      ipAddress: ip,
      metadata: { method: 'passwordless' },
    });

    if (this.isPlatformUser(user)) {
      const ctx = this.buildPlatformAccessContext(user);
      const authResponse = this.generatePlatformAuthResponse(
        user,
        ctx,
        session.id,
      );
      await this.sessionsService.bindRefreshToken(
        session.id,
        authResponse.refresh_token,
      );
      return authResponse;
    }

    const { activeCompany, companies } =
      await this.resolveSingleActiveCompanyForLogin(user.id);
    const companyCtx = await this.companiesService.setActiveMembership(
      user.id,
      activeCompany.companyId,
    );
    const authResponse = this.generateCompanyAuthResponse(
      user,
      companyCtx,
      companies,
      session.id,
    );
    await this.sessionsService.bindRefreshToken(
      session.id,
      authResponse.refresh_token,
    );
    return authResponse;
  }

  // ── 2FA completion ──────────────────────────────────────────────────────────

  async complete2FALogin(
    tempToken: string,
    code: string,
    ip?: string,
    userAgent?: string,
  ) {
    try {
      const payload = this.jwtService.verify<TwoFactorTempTokenPayload>(
        tempToken,
        {
          secret: this.getAccessTokenSecret(),
        },
      );

      if (payload.type !== '2fa-temp' || !payload.temp || !payload.sub) {
        throw new UnauthorizedException('Invalid temporary token');
      }

      const isValid = await this.twoFaService.verify2FALogin(payload.sub, code);
      if (!isValid) throw new UnauthorizedException('Invalid 2FA code');

      const user = await this.usersService.findById(payload.sub);
      if (user.status !== 'active') {
        throw new ForbiddenException('Your account is inactive.');
      }

      const device = await this.devicesService.upsert({
        userId: user.id,
        userAgent,
        ipAddress: ip,
      });
      await this.usersService.updateLastLogin(user.id, new Date(), ip ?? null);

      const session = await this.sessionsService.create({
        userId: user.id,
        refreshToken: randomUUID(),
        deviceId: device.id,
        ipAddress: ip,
        userAgent,
      });

      if (payload.scope === 'platform') {
        if (!this.isPlatformUser(user))
          throw new UnauthorizedException('Invalid platform login context');
        const authResponse = this.generatePlatformAuthResponse(
          user,
          this.buildPlatformAccessContext(user),
          session.id,
        );
        await this.sessionsService.bindRefreshToken(
          session.id,
          authResponse.refresh_token,
        );
        return authResponse;
      }

      if (!payload.companyId)
        throw new UnauthorizedException('Company context is missing');

      const companyContext = await this.companiesService.setActiveMembership(
        payload.sub,
        payload.companyId,
      );
      const companies = await this.companiesService.listUserCompanies(
        payload.sub,
      );

      const authResponse = this.generateCompanyAuthResponse(
        user,
        companyContext,
        companies,
        session.id,
      );
      await this.sessionsService.bindRefreshToken(
        session.id,
        authResponse.refresh_token,
      );
      return authResponse;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      )
        throw error;
      if (error instanceof NotFoundException)
        throw new UnauthorizedException('Company access unavailable');
      if (this.isJwtError(error))
        throw new UnauthorizedException(
          'Temporary token is invalid or expired.',
        );
      throw error;
    }
  }

  // ── Token refresh ───────────────────────────────────────────────────────────

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshTokenDto.refresh_token,
        { secret: this.getRefreshTokenSecret() },
      );

      if (
        payload.type !== 'refresh' ||
        !payload.sub ||
        !payload.jti ||
        !payload.sessionId
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (await this.redisService.isBlacklisted(payload.jti)) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      await this.sessionsService
        .validateRefreshToken(
          payload.sessionId,
          refreshTokenDto.refresh_token,
          payload.sub,
        )
        .catch(() => {
          throw new UnauthorizedException('Session has been revoked');
        });

      const user = await this.usersService.findById(payload.sub);
      if (user.status !== 'active')
        throw new ForbiddenException('Account inactive');

      // Blacklist the used refresh token (rotation)
      const ttl = this.getTokenBlacklistTtlSeconds(
        refreshTokenDto.refresh_token,
        60,
      );
      await this.redisService.addToBlacklist(payload.jti, ttl);

      const newRefreshJti = randomUUID();
      const sessionId = payload.sessionId;

      if (payload.scope === 'platform') {
        if (!this.isPlatformUser(user))
          throw new UnauthorizedException('Invalid scope');
        const authResponse = this.generatePlatformAuthResponse(
          user,
          this.buildPlatformAccessContext(user),
          sessionId,
          newRefreshJti,
        );
        await this.sessionsService.bindRefreshToken(
          sessionId,
          authResponse.refresh_token,
        );
        return authResponse;
      }

      if (!payload.companyId || !payload.membershipId) {
        throw new UnauthorizedException(
          'Refresh token company context is invalid',
        );
      }

      const companyContext = await this.companiesService.getMembershipContext(
        payload.sub,
        payload.companyId,
      );
      if (companyContext.membershipId !== payload.membershipId) {
        throw new UnauthorizedException(
          'Refresh token company context is invalid',
        );
      }

      const companies = await this.companiesService.listUserCompanies(
        payload.sub,
      );
      const authResponse = this.generateCompanyAuthResponse(
        user,
        companyContext,
        companies,
        sessionId,
        newRefreshJti,
      );
      await this.sessionsService.bindRefreshToken(
        sessionId,
        authResponse.refresh_token,
      );
      return authResponse;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      )
        throw error;
      if (error instanceof NotFoundException)
        throw new UnauthorizedException('Company access unavailable');
      if (this.isJwtError(error))
        throw new UnauthorizedException('Invalid or expired refresh token');
      throw error;
    }
  }

  // ── Switch company ──────────────────────────────────────────────────────────

  async switchCompany(userId: string, companyId: string, ip?: string) {
    const user = await this.usersService.findById(userId);
    if (user.status !== 'active')
      throw new ForbiddenException('Account inactive');
    if (this.isPlatformUser(user))
      throw new ForbiddenException('Platform users do not use company context');

    let companyContext: CompanyMembershipContext;
    try {
      companyContext = await this.companiesService.setActiveMembership(
        userId,
        companyId,
      );
    } catch {
      throw new UnauthorizedException(
        'You do not have access to the selected company',
      );
    }

    await this.usersService.updateLastLogin(userId, new Date(), ip ?? null);
    const companies = await this.companiesService.listUserCompanies(userId);
    const session = await this.sessionsService.create({
      userId,
      refreshToken: randomUUID(),
      ipAddress: ip,
    });

    const authResponse = this.generateCompanyAuthResponse(
      user,
      companyContext,
      companies,
      session.id,
    );
    await this.sessionsService.bindRefreshToken(
      session.id,
      authResponse.refresh_token,
    );
    return authResponse;
  }

  // ── Register ────────────────────────────────────────────────────────────────

  async register(registerDto: RegisterDto) {
    const normalizedSlug = this.normalizeCompanySlug(registerDto.company_slug);
    const company =
      await this.companiesService.findActiveCompanyBySlug(normalizedSlug);

    if (!company) throw new NotFoundException('Company not found');

    const defaultBranch = await this.companiesService.getDefaultActiveBranch(
      company.id,
    );
    if (!defaultBranch) {
      throw new NotFoundException('Company has no active branch');
    }

    const creationResult = await this.usersService.createForCompany(
      company.id,
      {
        first_name: registerDto.first_name,
        last_name: registerDto.last_name,
        phone: registerDto.phone,
        email: registerDto.email,
        password: registerDto.password,
        officer_title: 'Underwriter',
        branch_id: defaultBranch.id,
      },
    );

    const createdUser =
      'user' in creationResult ? creationResult.user : creationResult;
    const companyContext = await this.companiesService.getMembershipContext(
      createdUser.id,
      company.id,
    );

    await this.auditService.log({
      userId: createdUser.id,
      action: AuditAction.REGISTER,
      metadata: { companyId: company.id },
    });

    return {
      message: 'Registered successfully',
      user: {
        id: createdUser.id,
        user_no: createdUser.user_no,
        first_name: createdUser.first_name,
        last_name: createdUser.last_name,
        phone: createdUser.phone,
        email: createdUser.email,
        status: createdUser.status,
        user_type: createdUser.user_type,
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        membership_id: companyContext.membershipId,
        roles: companyContext.roles,
        permissions: companyContext.permissions,
      },
    };
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  async logout(logoutDto: LogoutDto, userId?: string, accessToken?: string) {
    const refreshPayload = this.decodeJwtPayload(logoutDto.refresh_token);
    const refreshJti =
      refreshPayload && typeof refreshPayload['jti'] === 'string'
        ? refreshPayload['jti']
        : null;
    const refreshSessionId =
      refreshPayload && typeof refreshPayload['sessionId'] === 'string'
        ? refreshPayload['sessionId']
        : null;

    if (refreshJti) {
      const ttl = this.getTokenBlacklistTtlSeconds(
        logoutDto.refresh_token,
        60 * 60 * 24 * 7,
      );
      await this.redisService.addToBlacklist(refreshJti, ttl);
    }

    if (accessToken?.trim()) {
      const accessPayload = this.decodeJwtPayload(accessToken);
      const accessJti =
        accessPayload && typeof accessPayload['jti'] === 'string'
          ? accessPayload['jti']
          : null;

      if (accessJti) {
        const accessTtl = this.getTokenBlacklistTtlSeconds(accessToken, 900);
        await this.redisService.addToBlacklist(accessJti, accessTtl);
      }
    }

    if (refreshSessionId) {
      await this.sessionsService.revoke(refreshSessionId, userId);
    }

    if (userId) {
      await this.auditService.log({ userId, action: AuditAction.LOGOUT });
    }

    return { message: 'Successfully logged out' };
  }

  // ── Password management ─────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user)
      return { message: 'If the email exists, you will receive a reset link' };

    const resetToken = this.jwtService.sign(
      { sub: user.id, type: 'password_reset', jti: randomUUID() },
      { secret: this.getResetTokenSecret(), expiresIn: '60m' as StringValue },
    );

    const resetLink = this.buildFrontendAuthUrl(
      `auth/reset-password?token=${encodeURIComponent(resetToken)}`,
    );

    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        user.first_name,
        resetLink,
      );
    } catch (err) {
      console.error('Failed to send password reset email:', err);
    }

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.PASSWORD_RESET_REQUEST,
    });
    return { message: 'If the email exists, you will receive a reset link' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      const payload = this.jwtService.verify(dto.token, {
        secret: this.getResetTokenSecret(),
      });
      if (payload.type !== 'password_reset')
        throw new BadRequestException('Invalid reset token');

      const hashed = await hashPassword(dto.new_password);
      await this.usersService.updatePassword(payload.sub as string, hashed);

      const user = await this.usersService.findById(payload.sub as string);
      await this.sessionsService.revokeAllUserSessions(user.id);

      try {
        await this.mailService.sendPasswordChangedSuccessEmail(
          user.email,
          user.first_name,
        );
      } catch (err) {
        console.error('Failed to send password changed email:', err);
      }

      await this.auditService.log({
        userId: user.id,
        action: AuditAction.PASSWORD_RESET_SUCCESS,
      });
      return { message: 'Password has been reset successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (this.isJwtError(error))
        throw new BadRequestException('Invalid or expired reset token');
      throw error;
    }
  }

  // ── Email verification ──────────────────────────────────────────────────────

  async verifyEmail(token: string) {
    if (!this.isFeatureEnabled('ENABLE_EMAIL_VERIFICATION', true)) {
      return { message: 'Email verification is not required in this system' };
    }

    if (!token?.trim())
      throw new BadRequestException('Verification token is required');

    const user = await this.usersService.findByVerificationToken(token.trim());
    if (!user)
      throw new BadRequestException('Invalid or expired verification token');

    await this.usersService.markEmailVerified(user.id);
    await this.auditService.log({
      userId: user.id,
      action: AuditAction.EMAIL_VERIFIED,
    });

    try {
      await this.mailService.sendWelcomeEmailAfterVerification(
        user.email,
        user.first_name || 'User',
      );
    } catch (err) {
      console.error('Failed to send welcome email:', err);
    }

    return { message: 'Email successfully verified! You can now log in.' };
  }

  async resendVerificationEmail(email: string) {
    if (!this.isFeatureEnabled('ENABLE_EMAIL_VERIFICATION', true)) {
      return { message: 'Email verification is not required in this system.' };
    }

    const user = await this.usersService.findByEmail(email);
    if (!user || user.is_email_verified) {
      return {
        message:
          'If the email is registered and unverified, a new link has been sent.',
      };
    }

    const verificationToken = randomUUID();
    const expires = new Date();
    expires.setHours(
      expires.getHours() +
        Number(
          this.configService.get<string>('EMAIL_VERIFICATION_EXPIRY_HOURS') ??
            24,
        ),
    );

    await this.usersService.updateVerificationToken(
      user.id,
      verificationToken,
      expires,
    );

    const verifyLink = this.buildFrontendAuthUrl(
      `auth/verify-email?token=${encodeURIComponent(verificationToken)}`,
    );

    try {
      await this.mailService.sendEmailVerification(
        user.email,
        user.first_name || 'User',
        verifyLink,
      );
    } catch (err) {
      console.error('Failed to send verification email:', err);
    }

    return { message: 'A new verification email has been sent.' };
  }

  // ── Token generation helpers ────────────────────────────────────────────────

  private build2FATempResponse(
    userId: string,
    email: string,
    scope: AuthScope,
    userType: UserType,
    companyId?: string,
  ) {
    const tempToken = this.jwtService.sign<TwoFactorTempTokenPayload>(
      {
        sub: userId,
        email,
        scope,
        userType,
        companyId,
        temp: true,
        type: '2fa-temp',
      },
      { secret: this.getAccessTokenSecret(), expiresIn: '5m' },
    );
    return {
      requires2FA: true,
      tempToken,
      message: 'Password verified. Please provide your 2FA code.',
    };
  }

  private generatePlatformAuthResponse(
    user: User,
    platformContext: PlatformAccessContext,
    sessionId: string,
    refreshJti?: string,
  ) {
    const jti = refreshJti ?? randomUUID();
    const accessJti = randomUUID();
    const accessToken = this.jwtService.sign<AccessTokenPayload>(
      {
        sub: user.id,
        email: user.email,
        scope: 'platform',
        userType: platformContext.userType,
        roles: platformContext.roles,
        permissions: platformContext.permissions,
        type: 'access',
        iss: this.configService.get('jwt.issuer', 'insurance-idp.tz'),
        aud: this.configService.get('jwt.audience', 'insurance-platform'),
        sessionId,
        jti: accessJti,
      },
      {
        secret: this.getAccessTokenSecret(),
        expiresIn: this.getAccessTokenExpiration(),
      },
    );

    const refreshToken = this.jwtService.sign<RefreshTokenPayload>(
      {
        sub: user.id,
        scope: 'platform',
        userType: platformContext.userType,
        sessionId,
        type: 'refresh',
        jti,
      },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: this.getRefreshTokenExpiration(),
      },
    );

    return {
      scope: 'platform' as const,
      access_token: accessToken,
      access_expires_at: this.getTokenExpiryTimestamp(accessToken),
      refresh_token: refreshToken,
      refresh_expires_at: this.getTokenExpiryTimestamp(refreshToken),
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        roles: platformContext.roles,
        permissions: platformContext.permissions,
        isTwoFactorEnabled: user.is_two_factor_enabled,
      },
    };
  }

  private generateCompanyAuthResponse(
    user: User,
    companyContext: CompanySummary,
    companies: CompanySummary[],
    sessionId: string,
    refreshJti?: string,
  ) {
    const jti = refreshJti ?? randomUUID();
    const accessJti = randomUUID();
    const accessToken = this.jwtService.sign<AccessTokenPayload>(
      {
        sub: user.id,
        email: user.email,
        scope: 'company',
        userType: user.user_type as UserType,
        companyId: companyContext.companyId,
        companySlug: companyContext.companySlug,
        companyName: companyContext.companyName,
        companyType: companyContext.companyType,
        membershipId: companyContext.membershipId,
        activeBranchId: companyContext.activeBranchId,
        activeBranchCode: companyContext.activeBranchCode,
        activeBranchName: companyContext.activeBranchName,
        defaultSalePointId: companyContext.defaultSalePointId,
        defaultSalePointCode: companyContext.defaultSalePointCode,
        defaultSalePointName: companyContext.defaultSalePointName,
        assignedBranchIds: companyContext.assignedBranchIds,
        roles: companyContext.roles,
        permissions: companyContext.permissions,
        type: 'access',
        iss: this.configService.get('jwt.issuer', 'insurance-idp.tz'),
        aud: this.configService.get('jwt.audience', 'insurance-platform'),
        sessionId,
        jti: accessJti,
      },
      {
        secret: this.getAccessTokenSecret(),
        expiresIn: this.getAccessTokenExpiration(),
      },
    );

    const refreshToken = this.jwtService.sign<RefreshTokenPayload>(
      {
        sub: user.id,
        scope: 'company',
        userType: user.user_type as UserType,
        companyId: companyContext.companyId,
        membershipId: companyContext.membershipId,
        sessionId,
        type: 'refresh',
        jti,
      },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: this.getRefreshTokenExpiration(),
      },
    );

    return {
      scope: 'company' as const,
      access_token: accessToken,
      access_expires_at: this.getTokenExpiryTimestamp(accessToken),
      refresh_token: refreshToken,
      refresh_expires_at: this.getTokenExpiryTimestamp(refreshToken),
      company: {
        id: companyContext.companyId,
        name: companyContext.companyName,
        slug: companyContext.companySlug,
        company_type: companyContext.companyType,
      },
      companies,
      active_branch: companyContext.activeBranchId
        ? {
            id: companyContext.activeBranchId,
            code: companyContext.activeBranchCode,
            name: companyContext.activeBranchName,
          }
        : null,
      default_sale_point: companyContext.defaultSalePointId
        ? {
            id: companyContext.defaultSalePointId,
            code: companyContext.defaultSalePointCode,
            name: companyContext.defaultSalePointName,
          }
        : null,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        roles: companyContext.roles,
        permissions: companyContext.permissions,
        isTwoFactorEnabled: user.is_two_factor_enabled,
      },
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async handleFailedLogin(user: User): Promise<void> {
    const maxAttempts = this.configService.get<number>(
      'app.maxLoginAttempts',
      5,
    );
    const lockoutMinutes = this.configService.get<number>(
      'app.accountLockoutMinutes',
      15,
    );
    const newAttempts = (user.failed_login_attempts ?? 0) + 1;

    if (newAttempts >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      await this.usersService.lockAccount(user.id, lockedUntil);
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.ACCOUNT_LOCKED,
        metadata: { lockedUntil, attempts: newAttempts },
        status: 'failure',
      });
    } else {
      await this.usersService.incrementLoginAttempts(user.id);
    }
  }

  private isPlatformUser(user: Pick<User, 'user_type'>): boolean {
    return PLATFORM_USER_TYPES.includes(user.user_type as UserType);
  }

  private buildPlatformAccessContext(user: User): PlatformAccessContext {
    const permissions = new Set<string>();
    user.permissions?.forEach((p) => p?.name && permissions.add(p.name));
    user.roles?.forEach((r) =>
      r.permissions?.forEach((p) => p?.name && permissions.add(p.name)),
    );

    return {
      scope: 'platform',
      userType: user.user_type as UserType,
      roles: user.roles?.map((r) => r.name) ?? [],
      permissions: Array.from(permissions),
    };
  }

  private async resolveSingleActiveCompanyForLogin(userId: string): Promise<{
    activeCompany: CompanySummary;
    companies: CompanySummary[];
  }> {
    const companies = await this.companiesService.listUserCompanies(userId);

    if (companies.length === 0) {
      throw new ForbiddenException(
        'No active company is assigned to your account. Please contact an administrator.',
      );
    }

    if (companies.length > 1) {
      throw new ForbiddenException(
        'Multiple active companies are assigned to your account. Only one active company is allowed. Please contact an administrator.',
      );
    }

    return { activeCompany: companies[0], companies };
  }

  private getTokenExpiryTimestamp(token: string): number {
    const decoded = this.jwtService.decode(token);
    if (
      !decoded ||
      typeof decoded === 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      throw new InternalServerErrorException(
        'Failed to determine token expiry',
      );
    }
    return decoded.exp * 1000;
  }

  private getTokenBlacklistTtlSeconds(token: string, fallback: number): number {
    const decoded = this.jwtService.decode(token);
    if (
      !decoded ||
      typeof decoded === 'string' ||
      typeof decoded.exp !== 'number'
    )
      return fallback;
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    return ttl > 0 ? ttl : 1;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const decoded = this.jwtService.decode(token);
    if (!decoded || typeof decoded === 'string') {
      return null;
    }

    return decoded as Record<string, unknown>;
  }

  private getAccessTokenSecret(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private getAccessTokenExpiration(): StringValue {
    return (this.configService.get<string>('JWT_ACCESS_EXPIRATION') ??
      '15m') as StringValue;
  }

  private getRefreshTokenSecret(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private getRefreshTokenExpiration(): StringValue {
    return (this.configService.get<string>('JWT_REFRESH_EXPIRATION') ??
      '7d') as StringValue;
  }

  private getResetTokenSecret(): string {
    return this.configService.getOrThrow<string>('JWT_RESET_SECRET');
  }

  private buildFrontendAuthUrl(path: string): string {
    return buildUrl(
      this.getOptionalConfig('app.frontendUrl') ??
        this.getOptionalConfig('APP_FRONTEND_URL') ??
        this.getOptionalConfig('app.appUrl') ??
        this.configService.getOrThrow<string>('APP_URL'),
      path,
    );
  }

  private getOptionalConfig(key: string): string | undefined {
    try {
      return this.configService.get<string>(key);
    } catch {
      return undefined;
    }
  }

  private isFeatureEnabled(key: string, defaultValue: boolean): boolean {
    const value = this.configService.get<string | boolean>(key);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
    return defaultValue;
  }

  private isJwtError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return [
      'TokenExpiredError',
      'JsonWebTokenError',
      'NotBeforeError',
    ].includes(error.name);
  }

  private normalizeCompanySlug(slug: string): string {
    const normalized = slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
      throw new BadRequestException(
        'Company slug must use lowercase letters, numbers, and hyphens only',
      );
    }
    return normalized;
  }
}
