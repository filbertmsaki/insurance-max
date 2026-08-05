import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { CompaniesModule } from '../../platform/companies/companies.module';
import { UsersModule } from '../../tenant/users/users.module';
import { BranchesModule } from '../../tenant/branches/branches.module';
import { DepartmentsModule } from '../../tenant/departments/departments.module';
import { MailModule } from '../mail/mail.module';
import { TwoFaModule } from './2fa/2fa.module';
import { OtpModule } from '../otp/otp.module';
import { SessionsModule } from '../sessions/sessions.module';
import { DevicesModule } from '../devices/devices.module';

import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
    }),
    CompaniesModule,
    UsersModule,
    BranchesModule,
    DepartmentsModule,
    MailModule,
    TwoFaModule,
    OtpModule,
    SessionsModule,
    DevicesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRATION') ??
            '20m') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService],
})
export class AuthModule {}
