import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsMessage, SmsProvider } from './sms.provider.interface';

@Injectable()
export class NextSmsProvider implements SmsProvider {
  private readonly logger = new Logger(NextSmsProvider.name);
  private readonly username: string;
  private readonly password: string;
  private readonly senderId: string;

  constructor(private readonly configService: ConfigService) {
    this.username = configService.get<string>('NEXTSMS_USERNAME', '');
    this.password = configService.get<string>('NEXTSMS_PASSWORD', '');
    this.senderId = configService.get<string>('NEXTSMS_SENDER_ID', 'INFO');
  }

  async send(message: SmsMessage): Promise<void> {
    const credentials = Buffer.from(
      `${this.username}:${this.password}`,
    ).toString('base64');

    const body = JSON.stringify({
      from: message.from ?? this.senderId,
      to: message.to,
      text: message.body,
    });

    const response = await fetch(
      'https://messaging.nextsms.co.tz/api/sms/v1/text/single',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`NextSMS failed: ${errorText}`);
      throw new Error(`NextSMS delivery failed: ${response.status}`);
    }

    this.logger.debug(`SMS sent via NextSMS to ${message.to}`);
  }
}
