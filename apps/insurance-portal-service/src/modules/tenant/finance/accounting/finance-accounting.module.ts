import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { FinanceAccount } from '../foundation/chart-of-accounts/entities/finance-account.entity';
import { FinanceOutboxEvent } from '../integrations/finance-events/entities/finance-outbox-event.entity';
import { FinanceOutboxService } from '../integrations/finance-events/finance-outbox.service';
import { FinanceJournalEntry } from './journal-entries/entities/finance-journal-entry.entity';
import { FinanceJournalLine } from './journal-entries/entities/finance-journal-line.entity';
import { FinanceJournalService } from './journal-entries/finance-journal.service';
import { FinanceFoundationModule } from '../foundation/finance-foundation.module';
import { FinancePostingPolicyService } from './posting-rules/finance-posting-policy.service';
import { FinancialReversal } from './reversals/entities/financial-reversal.entity';

/**
 * Posts journals under the book's approved policy and writes accounting events
 * to the transactional outbox. The Finance foundation supplies the ledger and
 * approval services. Callers pass their transaction's EntityManager.
 */
@Module({
  imports: [
    FinanceFoundationModule,
    TypeOrmModule.forFeature([
      FinanceAccount,
      FinanceJournalEntry,
      FinanceJournalLine,
      FinancialReversal,
      FinanceOutboxEvent,
    ]),
  ],
  providers: [
    IdentifierGeneratorService,
    FinancePostingPolicyService,
    FinanceJournalService,
    FinanceOutboxService,
  ],
  exports: [
    IdentifierGeneratorService,
    FinancePostingPolicyService,
    FinanceJournalService,
    FinanceOutboxService,
  ],
})
export class FinanceAccountingModule {}
