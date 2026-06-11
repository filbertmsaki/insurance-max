import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiClient } from './entities/api-client.entity';
import { ApiClientsService } from './api-clients.service';
import { ApiClientsController } from './api-clients.controller';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ApiClient])],
  providers: [ApiClientsService, ApiKeyGuard],
  controllers: [ApiClientsController],
  exports: [ApiClientsService, ApiKeyGuard],
})
export class ApiClientsModule {}
