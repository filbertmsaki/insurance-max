import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Public } from '@insurance-max/portal-shared/decorators/public.decorator';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { LogoutDto } from './dtos/logout.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { Complete2FALoginDto } from './dtos/complete-2fa-login.dto';
import { ResendVerificationDto } from './dtos/resend-verification.dto';
import { SwitchCompanyDto } from './dtos/switch-company.dto';
import { SendPhoneOtpDto, PhoneLoginDto } from './dtos/phone-login.dto';
import { SendOtpDto } from './dtos/send-otp.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { RequestPasswordlessLinkDto } from './dtos/passwordless-login.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Registration & Email login ──────────────────────────────────────────────

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @ApiOperation({ summary: 'Register a new user against a company slug' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Email / password login' })
  login(
    @Body() dto: LoginDto,
    @Req() req: ExpressRequest,
    @Headers('x-device-token') deviceToken?: string,
  ) {
    return this.authService.login(
      dto,
      req.ip,
      req.headers['user-agent'],
      deviceToken,
    );
  }

  // ── Phone / OTP login ───────────────────────────────────────────────────────

  @Post('phone-login/send-otp')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @ApiOperation({ summary: 'Send OTP to phone number for login' })
  sendPhoneOtp(@Body() dto: SendPhoneOtpDto, @Req() req: ExpressRequest) {
    return this.authService.sendPhoneOtp(dto, req.ip);
  }

  @Post('phone-login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify phone OTP and login' })
  phoneLogin(
    @Body() dto: PhoneLoginDto,
    @Req() req: ExpressRequest,
    @Headers('x-device-token') deviceToken?: string,
  ) {
    return this.authService.phoneLogin(
      dto,
      req.ip,
      req.headers['user-agent'],
      deviceToken,
    );
  }

  // ── Generic OTP ─────────────────────────────────────────────────────────────

  @Post('send-otp')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @ApiOperation({ summary: 'Send OTP via SMS or Email for any purpose' })
  sendOtp(@Body() dto: SendOtpDto, @Req() req: ExpressRequest) {
    return this.authService.sendOtp(dto, undefined, req.ip);
  }

  @Post('verify-otp')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify an OTP code' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  // ── Passwordless login ──────────────────────────────────────────────────────

  @Post('passwordless/request')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @ApiOperation({ summary: 'Request a passwordless login link via email' })
  requestPasswordlessLink(@Body() dto: RequestPasswordlessLinkDto) {
    return this.authService.requestPasswordlessLink(dto.email);
  }

  @Post('passwordless/complete')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Complete passwordless login with the token from email',
  })
  completePasswordlessLogin(
    @Query('token') token: string,
    @Req() req: ExpressRequest,
    @Headers('x-device-token') deviceToken?: string,
  ) {
    return this.authService.completePasswordlessLogin(
      token,
      req.ip,
      req.headers['user-agent'],
      deviceToken,
    );
  }

  // ── 2FA ─────────────────────────────────────────────────────────────────────

  @Post('2fa/complete-login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Complete login with 2FA code or backup code' })
  complete2FALogin(
    @Body() dto: Complete2FALoginDto,
    @Req() req: ExpressRequest,
    @Headers('x-device-token') deviceToken?: string,
  ) {
    return this.authService.complete2FALogin(
      dto.tempToken,
      dto.code,
      dto.trustDevice,
      req.ip,
      req.headers['user-agent'],
      deviceToken,
    );
  }

  // ── Token lifecycle ─────────────────────────────────────────────────────────

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotate access + refresh tokens' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @SkipThrottle()
  @ApiOperation({ summary: 'Logout — blacklists tokens' })
  logout(
    @Body() dto: LogoutDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('authorization') authHeader: string,
  ) {
    const accessToken = authHeader?.replace('Bearer ', '');
    return this.authService.logout(dto, user.id, accessToken);
  }

  // ── Company switching ───────────────────────────────────────────────────────

  @Post('switch-company')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @SkipThrottle()
  @ApiOperation({ summary: 'Switch active company context' })
  switchCompany(
    @Body() dto: SwitchCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ExpressRequest,
    @Headers('authorization') authorization?: string,
  ) {
    return this.authService.switchCompany({
      userId: user.id,
      sessionId: user.sessionId,
      currentAccessToken: authorization?.replace(/^Bearer\s+/i, ''),
      refreshToken: dto.refresh_token,
      companyId: dto.company_id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Email verification ──────────────────────────────────────────────────────

  @Get('verify-email')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Verify email address via token from email link' })
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Resend email verification link' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  // ── Password reset ──────────────────────────────────────────────────────────

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Request password reset link' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset password using token from email' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
