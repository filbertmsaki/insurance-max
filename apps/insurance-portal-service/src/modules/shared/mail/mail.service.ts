import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { ISendMailOptions } from '@nestjs-modules/mailer/dist/interfaces/send-mail-options.interface';
import { buildUrl } from '@insurance-max/shared-config';

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

  async sendMail(options: ISendMailOptions): Promise<void> {
    await this.mailerService.sendMail(options);
  }

  async sendPortalInvitationEmail(
    email: string,
    firstName: string,
    companyName: string,
    invitationUrl: string,
    expiresAt: Date,
  ): Promise<void> {
    const timezone = this.configService.get<string>(
      'app.timezone',
      'Africa/Dar_es_Salaam',
    );

    const formattedExpiry = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(expiresAt);

    const subject = `${companyName} portal invitation`;

    const text = [
      `Hello ${firstName},`,
      '',
      `${companyName} has invited you to access its insurance self-service portal.`,
      '',
      `Accept the invitation using this link:`,
      invitationUrl,
      '',
      `The invitation expires on ${formattedExpiry}.`,
      '',
      `Do not share this link with anyone.`,
      '',
      `If you did not expect this invitation, ignore this message or contact ${companyName}.`,
    ].join('\n');

    const html = `
      <p>Hello ${this.escapeHtml(firstName)},</p>

      <p>
        <strong>${this.escapeHtml(companyName)}</strong>
        has invited you to access its insurance self-service portal.
      </p>

      <p>
        <a href="${this.escapeHtml(invitationUrl)}" rel="noopener noreferrer">
          Accept portal invitation
        </a>
      </p>

      <p>
        The invitation expires on
        <strong>${this.escapeHtml(formattedExpiry)}</strong>.
      </p>

      <p>Do not share this invitation link with anyone.</p>

      <p>
        If you did not expect this invitation, ignore this message or
        contact ${this.escapeHtml(companyName)}.
      </p>
    `;

    await this.sendMail({
      to: email,
      subject,
      text,
      html,
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
          loginUrl: buildUrl(
            this.configService.getOrThrow<string>('app.frontendUrl'),
            'login',
          ),
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
