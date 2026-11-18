import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { FinanceAccount } from '../foundation/chart-of-accounts/entities/finance-account.entity';
import { FinanceOutboxEvent } from '../integrations/finance-events/entities/finance-outbox-event.entity';
import { FinanceOutboxService } from '../integrations/finance-events/finance-outbox.service';
import { FinanceJournalEntry } from './journal-entries/entities/finance-journal-entry.entity';
import { FinanceJournalLine } from './journal-entries/entities/finance-journal-line.entity';
import { FinanceJournalService } from './journal-entries/finance-journal.service';
import { FinancePostingPolicyService } from './posting-rules/finance-posting-policy.service';
import { FinancialReversal } from './reversals/entities/financial-reversal.entity';

/**
 * Lowest operational Finance layer: balanced journal posting under the posting
 * policy, and the transactional outbox writer for accounting events. Callers pass
 * their EntityManager, so postings join the caller's transaction and locks.
 * Depends on no other Finance or insurance module.
 */
@Module({
  imports: [
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
