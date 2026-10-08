import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisAccessAuditEntity } from './entities/tiramis-access-audit.entity';
import { TiramisAccessAuditInterceptor } from './interceptors/tiramis-access-audit.interceptor';
import { TiramisAccessAuditService } from './services/tiramis-access-audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([TiramisAccessAuditEntity])],
  providers: [
    TiramisAccessAuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TiramisAccessAuditInterceptor,
    },
  ],
  exports: [TiramisAccessAuditService],
})
export class TiramisAuditModule {}
