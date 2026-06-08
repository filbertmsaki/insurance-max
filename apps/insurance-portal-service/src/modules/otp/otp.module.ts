import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { OtpVerification } from './entities/otp-verification.entity';
import { OtpService } from './otp.service';
import { SMS_PROVIDER } from './providers/sms.provider.interface';
import { BeemProvider } from './providers/beem.provider';
import { AfricasTalkingProvider } from './providers/africas-talking.provider';
import { NextSmsProvider } from './providers/nextsms.provider';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([OtpVerification]), MailModule],
  providers: [
    OtpService,
    BeemProvider,
    AfricasTalkingProvider,
    NextSmsProvider,
    {
      provide: SMS_PROVIDER,
      useFactory: (
        configService: ConfigService,
        beem: BeemProvider,
        at: AfricasTalkingProvider,
        next: NextSmsProvider,
      ) => {
        const provider = configService.get<string>(
          'app.otp.smsProvider',
          'beem',
        );
        switch (provider) {
          case 'africas_talking':
            return at;
          case 'nextsms':
            return next;
          default:
            return beem;
        }
      },
      inject: [
        ConfigService,
        BeemProvider,
        AfricasTalkingProvider,
        NextSmsProvider,
      ],
    },
  ],
  exports: [OtpService],
})
export class OtpModule {}
