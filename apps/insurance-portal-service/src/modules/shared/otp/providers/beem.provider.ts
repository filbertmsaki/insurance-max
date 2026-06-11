import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsMessage, SmsProvider } from './sms.provider.interface';

@Injectable()
export class BeemProvider implements SmsProvider {
  private readonly logger = new Logger(BeemProvider.name);
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly senderName: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = configService.get<string>('BEEM_API_KEY', '');
    this.secretKey = configService.get<string>('BEEM_SECRET_KEY', '');
    this.senderName = configService.get<string>(
      'BEEM_SENDER_NAME',
      'INSURANCE',
    );
  }

  async send(message: SmsMessage): Promise<void> {
    const credentials = Buffer.from(
      `${this.apiKey}:${this.secretKey}`,
    ).toString('base64');

    const body = JSON.stringify({
      source_addr: message.from ?? this.senderName,
      encoding: 0,
      schedule_time: '',
      message: message.body,
      recipients: [{ recipient_id: 1, dest_addr: message.to }],
    });

    const response = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Beem SMS failed: ${errorText}`);
      throw new Error(`Beem SMS delivery failed: ${response.status}`);
    }

    this.logger.debug(`SMS sent via Beem to ${message.to}`);
  }
}
