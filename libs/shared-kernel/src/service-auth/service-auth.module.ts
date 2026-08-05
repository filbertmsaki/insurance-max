import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { ServiceAuthGuard } from './service-auth.guard';
import { ServiceTokenService } from './service-token.service';

@Global()
@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [ServiceTokenService, ServiceAuthGuard],
  exports: [ServiceTokenService, ServiceAuthGuard],
})
export class ServiceAuthModule {}
