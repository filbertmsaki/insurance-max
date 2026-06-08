import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendPasswordResetEmail(to: string, name: string, resetLink: string) {
    await this.mailerService.sendMail({
      to,
      subject: 'Reset Your Password',
      template: 'forgot-password',
      context: {
        name: name || 'User',
        resetLink,
        appName: this.configService.get<string>('app.name') ?? 'Your App',
        year: new Date().getFullYear(),
      },
    });
  }

  async sendPasswordChangedSuccessEmail(to: string, name: string) {
    await this.mailerService.sendMail({
      to,
      subject: 'Your Password Has Been Changed',
      template: 'password-changed',
      context: {
        name: name || 'User',
        changedAt: new Date().toLocaleString(),
        appName: this.configService.get<string>('app.name') ?? 'Your App',
        year: new Date().getFullYear(),
      },
    });
  }

  async sendEmailVerification(
    to: string,
    name: string,
    verificationLink: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Verify Your Email Address',
      template: 'verification-email',
      context: {
        name: name || 'User',
        verificationLink,
        appName: this.configService.get<string>('app.name') ?? 'Your App',
        supportEmail:
          this.configService.get<string>('app.supportEmail') ??
          'support@yourapp.co.tz',
        year: new Date().getFullYear(),
      },
    });
  }

  async sendPasswordlessLoginEmail(
    to: string,
    name: string,
    link: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Your Login Link',
      template: 'passwordless-login',
      context: {
        name: name || 'User',
        loginLink: link,
        expiryMinutes: 10,
        appName: this.configService.get<string>('app.name') ?? 'Your App',
        year: new Date().getFullYear(),
      },
    });
  }

  async sendOtpEmail(
    to: string,
    otp: string,
    purpose: string,
    expirySeconds: number,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Your OTP Code',
      template: 'otp-email',
      context: {
        otp,
        purpose,
        expiryMinutes: Math.ceil(expirySeconds / 60),
        appName: this.configService.get<string>('app.name') ?? 'Your App',
        year: new Date().getFullYear(),
      },
    });
  }

  async sendWelcomeEmailAfterVerification(
    to: string,
    name: string,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to,
        subject: 'Welcome to Your App!',
        template: 'welcome-after-verification',
        context: {
          name: name || 'User',
          appName: this.configService.get<string>('app.name') ?? 'Your App',
          year: new Date().getFullYear(),
          loginUrl: `${
            this.configService.get<string>('app.frontendUrl') ??
            'http://localhost:5173'
          }/login`,
          supportEmail:
            this.configService.get<string>('app.supportEmail') ??
            'support@yourdomain.com',
        },
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }
}
