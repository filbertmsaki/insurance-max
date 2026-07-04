import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisClientConfigurationEntity } from './entities/tiramis-client-configuration.entity';
import { TiramisResponseCodeEntity } from './entities/tiramis-response-code.entity';
import { TiramisServiceEndpointEntity } from './entities/tiramis-service-endpoint.entity';
import { TiramisConfigService } from './services/tiramis-config.service';
import { TiramisSecurityModule } from '../security/tiramis-security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisClientConfigurationEntity,
      TiramisServiceEndpointEntity,
      TiramisResponseCodeEntity,
    ]),
    TiramisSecurityModule,
  ],
  providers: [TiramisConfigService],
  exports: [TiramisConfigService, TypeOrmModule],
})
export class TiramisConfigModule {}
