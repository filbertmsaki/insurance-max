import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsMessage, SmsProvider } from './sms.provider.interface';

@Injectable()
export class AfricasTalkingProvider implements SmsProvider {
  private readonly logger = new Logger(AfricasTalkingProvider.name);
  private readonly apiKey: string;
  private readonly username: string;
  private readonly senderId: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = configService.get<string>('AT_API_KEY', '');
    this.username = configService.get<string>('AT_USERNAME', 'sandbox');
    this.senderId = configService.get<string>('AT_SENDER_ID', '');
  }

  async send(message: SmsMessage): Promise<void> {
    const isLive = this.username !== 'sandbox';
    const baseUrl = isLive
      ? 'https://api.africastalking.com'
      : 'https://api.sandbox.africastalking.com';

    const params = new URLSearchParams({
      username: this.username,
      to: message.to,
      message: message.body,
    });

    if (message.from ?? this.senderId) {
      params.set('from', message.from ?? this.senderId);
    }

    const response = await fetch(`${baseUrl}/version1/messaging`, {
      method: 'POST',
      headers: {
        apiKey: this.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Africa's Talking SMS failed: ${errorText}`);
      throw new Error(
        `Africa's Talking SMS delivery failed: ${response.status}`,
      );
    }

    this.logger.debug(`SMS sent via Africa's Talking to ${message.to}`);
  }
}
