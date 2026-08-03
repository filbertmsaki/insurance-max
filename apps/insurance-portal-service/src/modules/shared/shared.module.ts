import { Module } from '@nestjs/common';

import { AuthorizationModule } from './authorization/authorization.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { DevicesModule } from './devices/devices.module';
import { BusinessReferenceService } from './identifiers/business-reference.service';
import { MailModule } from './mail/mail.module';
import { OtpModule } from './otp/otp.module';
import { RedisModule } from './redis/redis.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    AuthorizationModule,
    RedisModule,
    AuditModule,
    AuthModule,
    MailModule,
    OtpModule,
    SessionsModule,
    DevicesModule,
  ],
  providers: [BusinessReferenceService],
  exports: [
    AuthorizationModule,
    RedisModule,
    AuditModule,
    AuthModule,
    MailModule,
    OtpModule,
    SessionsModule,
    DevicesModule,
    BusinessReferenceService,
  ],
})
export class SharedModule {}
