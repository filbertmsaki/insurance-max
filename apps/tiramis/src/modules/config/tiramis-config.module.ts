import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisClientConfigurationEntity } from './entities/tiramis-client-configuration.entity';
import { TiramisServiceEndpointEntity } from './entities/tiramis-service-endpoint.entity';
import { TiramisConfigService } from './services/tiramis-config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisClientConfigurationEntity,
      TiramisServiceEndpointEntity,
    ]),
  ],
  providers: [TiramisConfigService],
  exports: [TiramisConfigService, TypeOrmModule],
})
export class TiramisConfigModule {}
