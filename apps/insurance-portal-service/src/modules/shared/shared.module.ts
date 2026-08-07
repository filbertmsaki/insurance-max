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
import { AnalyticsCoreModule } from './analytics/analytics-core.module';
import { SecurityPoliciesModule } from './security-policies/security-policies.module';
import { RetentionModule } from './retention/retention.module';

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
    AnalyticsCoreModule,
    SecurityPoliciesModule,
    RetentionModule,
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
    AnalyticsCoreModule,
    SecurityPoliciesModule,
    RetentionModule,
  ],
})
export class SharedModule {}
