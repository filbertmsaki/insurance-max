import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceAccountingModule } from '../accounting/finance-accounting.module';
import { ReconciliationService } from './payment-reconciliation/reconciliation.service';
import { FinanceReconciliationBatch } from './reconciliation-batches/entities/finance-reconciliation-batch.entity';
import { FinanceReconciliationItem } from './reconciliation-batches/entities/finance-reconciliation-item.entity';

/** Payment reconciliation batches and matching. Audit is provided by the global AuditModule. */
@Module({
  imports: [
    FinanceAccountingModule,
    TypeOrmModule.forFeature([
      FinanceReconciliationBatch,
      FinanceReconciliationItem,
    ]),
  ],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class FinanceReconciliationModule {}
