import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisAccessAuditEntity } from './entities/tiramis-access-audit.entity';
import { TiramisAccessAuditInterceptor } from './interceptors/tiramis-access-audit.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([TiramisAccessAuditEntity])],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TiramisAccessAuditInterceptor,
    },
  ],
})
export class TiramisAuditModule {}
