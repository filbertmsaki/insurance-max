import { Module } from '@nestjs/common';
import { FinanceFoundationModule } from '../../../foundation/finance-foundation.module';
import { FinanceSetupModule } from '../../../foundation/finance-setup/finance-setup.module';
import { FinanceIndependentAccessController } from './finance-independent-access.controller';
import { FinanceIndependentAccessService } from './finance-independent-access.service';

/** Source-association-scoped ledger reads and inactive journal candidates. Grants no posting authority. */
@Module({
  imports: [FinanceFoundationModule, FinanceSetupModule],
  controllers: [FinanceIndependentAccessController],
  providers: [FinanceIndependentAccessService],
})
export class FinanceIndependentAccessModule {}
