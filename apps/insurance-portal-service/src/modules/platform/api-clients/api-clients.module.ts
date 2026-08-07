import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaasBillingModule } from '../saas-billing/saas-billing.module';
import { ApiClient } from './entities/api-client.entity';
import { ApiClientUsageEvent } from './entities/api-client-usage-event.entity';
import { ApiClientsService } from './api-clients.service';
import { ApiClientsController } from './api-clients.controller';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiClient, ApiClientUsageEvent]),
    SaasBillingModule,
  ],
  providers: [ApiClientsService, ApiKeyGuard],
  controllers: [ApiClientsController],
  exports: [ApiClientsService, ApiKeyGuard],
})
export class ApiClientsModule {}
