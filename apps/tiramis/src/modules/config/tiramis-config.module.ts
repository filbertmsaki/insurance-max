import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisClientConfigurationEntity } from './entities/tiramis-client-configuration.entity';
import { TiramisResponseCodeEntity } from './entities/tiramis-response-code.entity';
import { TiramisServiceEndpointEntity } from './entities/tiramis-service-endpoint.entity';
import { TiramisConfigService } from './services/tiramis-config.service';
import { TiramisSecurityModule } from '../security/tiramis-security.module';
import { TiramisConfigurationValidationController } from './controllers/tiramis-configuration-validation.controller';
import { TiramisPortalNotificationsModule } from '../portal-notifications/tiramis-portal-notifications.module';
import { TiramisApiKeysModule } from '../api-keys/tiramis-api-keys.module';
import { TiramisSystemProfileModule } from './tiramis-system-profile.module';
import { TiramisPlatformProfileController } from './controllers/tiramis-platform-profile.controller';
import { TiramisPlatformConnectionController } from './controllers/tiramis-platform-connection.controller';

@Module({
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      TiramisClientConfigurationEntity,
      TiramisServiceEndpointEntity,
      TiramisResponseCodeEntity,
    ]),
    TiramisSecurityModule,
    TiramisPortalNotificationsModule,
    TiramisApiKeysModule,
    TiramisSystemProfileModule,
  ],
  controllers: [
    TiramisConfigurationValidationController,
    TiramisPlatformProfileController,
    TiramisPlatformConnectionController,
  ],
  providers: [TiramisConfigService],
  exports: [TiramisConfigService, TypeOrmModule, TiramisSystemProfileModule],
})
export class TiramisConfigModule {}
