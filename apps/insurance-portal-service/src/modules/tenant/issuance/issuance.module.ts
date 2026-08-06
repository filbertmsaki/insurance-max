import { Module } from '@nestjs/common';
import { ProductDefinitionModule } from '@insurance-max/shared-kernel';

import { IssuanceService } from './issuance.service';

@Module({
  imports: [ProductDefinitionModule],
  providers: [IssuanceService],
  exports: [IssuanceService],
})
export class IssuanceModule {}
