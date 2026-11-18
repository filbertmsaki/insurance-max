import { Module } from '@nestjs/common';
import { FinanceAccountingModule } from './accounting/finance-accounting.module';
import { FinanceIndependentAccessModule } from './accounting/general-ledger/independent-access/finance-independent-access.module';
import { FinanceFoundationModule } from './foundation/finance-foundation.module';
import { FinanceSetupModule } from './foundation/finance-setup/finance-setup.module';
import { FinanceInsuranceIntegrationModule } from './integrations/finance-insurance-integration.module';
import { FinancePaymentProvidersModule } from './integrations/payment-providers/finance-payment-providers.module';
import { FinanceSourceEvidenceModule } from './integrations/source-evidence/finance-source-evidence.module';
import { FinancePayablesModule } from './payables/finance-payables.module';
import { FinanceReceivablesModule } from './receivables/finance-receivables.module';
import { FinanceReconciliationModule } from './reconciliation/finance-reconciliation.module';

/**
 * Parent Finance module of the Insurance Portal Service. All Finance code runs in
 * this backend against the portal PostgreSQL database; there is no separate
 * Finance runtime or database. Importing it activates no posting, policy or worker:
 * those remain gated by their existing configuration and approvals.
 *
 * Dependency direction (no cycles inside Finance):
 *   Accounting <- Payables <- InsuranceIntegration <- Receivables <- PaymentProviders
 *   Accounting <- Reconciliation <- Receivables
 *   Foundation <- Setup <- IndependentAccess;  SourceEvidence is standalone.
 */
@Module({
  imports: [
    FinanceFoundationModule,
    FinanceSetupModule,
    FinanceAccountingModule,
    FinancePayablesModule,
    FinanceReconciliationModule,
    FinanceInsuranceIntegrationModule,
    FinanceReceivablesModule,
    FinancePaymentProvidersModule,
    FinanceSourceEvidenceModule,
    FinanceIndependentAccessModule,
  ],
  exports: [
    FinanceAccountingModule,
    FinanceReceivablesModule,
    FinanceInsuranceIntegrationModule,
  ],
})
export class FinanceModule {}
