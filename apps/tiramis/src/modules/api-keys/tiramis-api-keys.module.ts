import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisApiKeysController } from './controllers/tiramis-api-keys.controller';
import { TiramisApiKeyAuditEntity } from './entities/tiramis-api-key-audit.entity';
import { TiramisApiKeyEntity } from './entities/tiramis-api-key.entity';
import { TiramisApiKeyService } from './services/tiramis-api-key.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TiramisApiKeyEntity, TiramisApiKeyAuditEntity]),
  ],
  controllers: [TiramisApiKeysController],
  providers: [TiramisApiKeyService],
  exports: [TiramisApiKeyService],
})
export class TiramisApiKeysModule {}
