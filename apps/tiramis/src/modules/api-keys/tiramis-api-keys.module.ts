import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisApiKeysController } from './controllers/tiramis-api-keys.controller';
import { TiramisApiKeyAuditEntity } from './entities/tiramis-api-key-audit.entity';
import { TiramisApiKeyEntity } from './entities/tiramis-api-key.entity';
import { TiramisApiKeyService } from './services/tiramis-api-key.service';
import { TiramisClientConfigurationEntity } from '../config/entities/tiramis-client-configuration.entity';
import { TiramisAdministratorGuard } from './guards/tiramis-administrator.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([TiramisApiKeyEntity, TiramisApiKeyAuditEntity]),
  ],
  controllers: [TiramisApiKeysController],
  providers: [TiramisApiKeyService, TiramisAdministratorGuard],
  exports: [TiramisApiKeyService, TiramisAdministratorGuard],
})
export class TiramisApiKeysModule {}
