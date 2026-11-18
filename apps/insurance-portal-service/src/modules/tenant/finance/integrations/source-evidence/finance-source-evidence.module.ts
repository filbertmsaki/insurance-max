import { Module } from '@nestjs/common';
import { FinanceSourceAttestationsService } from './finance-source-attestations.service';
import { FinanceSourceKeyChangesService } from './finance-source-key-changes.service';
import { FinanceSourceKeyChangesController } from './finance-source-key-changes.controller';
import { FinanceSourceDeliveryService } from './finance-source-delivery.service';
import { FINANCE_SOURCE_IN_PROCESS_TRANSPORT } from './finance-source-in-process.transport';

/**
 * Signed company source evidence (attestations, signing keys, key changes) and
 * the outbox delivery worker. Consolidated from the standalone Finance Service;
 * all tables live in the portal database. Grants no posting authority, and the
 * worker stays idle unless FINANCE_SOURCE_DELIVERY_WORKER_ID is configured.
 */
@Module({
  controllers: [FinanceSourceKeyChangesController],
  providers: [
    FinanceSourceAttestationsService,
    FinanceSourceKeyChangesService,
    FINANCE_SOURCE_IN_PROCESS_TRANSPORT,
    FinanceSourceDeliveryService,
  ],
  exports: [FinanceSourceAttestationsService, FinanceSourceDeliveryService],
})
export class FinanceSourceEvidenceModule {}
