export interface SmsMessage {
  to: string;
  body: string;
  from?: string;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';
