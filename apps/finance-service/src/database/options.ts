import { DataSourceOptions } from 'typeorm';
import { FinanceScopeFoundations1796000000000 } from '../../../insurance-portal-service/src/database/migrations/1796000000000-FinanceScopeFoundations';
import { FinanceConfigurationReviews1796100000000 } from '../../../insurance-portal-service/src/database/migrations/1796100000000-FinanceConfigurationReviews';
import { FinanceChartSourceAuthorities1796200000000 } from '../../../insurance-portal-service/src/database/migrations/1796200000000-FinanceChartSourceAuthorities';
import { FinanceJournalCandidates1796300000000 } from '../../../insurance-portal-service/src/database/migrations/1796300000000-FinanceJournalCandidates';
import { FinanceApprovalGovernance1796400000000 } from '../../../insurance-portal-service/src/database/migrations/1796400000000-FinanceApprovalGovernance';
import { FinanceEventContractPreviews1796500000000 } from '../../../insurance-portal-service/src/database/migrations/1796500000000-FinanceEventContractPreviews';
import { FinanceIntegrationReliability1796600000000 } from '../../../insurance-portal-service/src/database/migrations/1796600000000-FinanceIntegrationReliability';
import { FinanceOwnedExceptions1796700000000 } from '../../../insurance-portal-service/src/database/migrations/1796700000000-FinanceOwnedExceptions';
import { FinancePolicyGovernance1797100000000 } from '../../../insurance-portal-service/src/database/migrations/1797100000000-FinancePolicyGovernance';
import { FinanceLedgerFoundation1797200000000 } from '../../../insurance-portal-service/src/database/migrations/1797200000000-FinanceLedgerFoundation';
import { FinanceRecurringAllocationPreviews1797800000000 } from '../../../insurance-portal-service/src/database/migrations/1797800000000-FinanceRecurringAllocationPreviews';
import { FinanceAllocationPreviewReviews1797900000000 } from '../../../insurance-portal-service/src/database/migrations/1797900000000-FinanceAllocationPreviewReviews';
import { FinanceSourceAttestations1798000000000 } from './1798000000000-FinanceSourceAttestations';
import { FinanceSourceKeyChanges1798100000000 } from './1798100000000-FinanceSourceKeyChanges';

/** Explicitly configured empty Finance database; never use portal DB defaults. */
export function financeDatabaseOptions(
  env: NodeJS.ProcessEnv,
): DataSourceOptions {
  const value = env.FINANCE_DATABASE_URL;
  if (!value) throw new Error('FINANCE_DATABASE_URL is required.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('FINANCE_DATABASE_URL must be a PostgreSQL URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname ||
    url.pathname === '/'
  ) {
    throw new Error('FINANCE_DATABASE_URL must name a PostgreSQL database.');
  }
  return {
    type: 'postgres',
    url: value,
    synchronize: false,
    migrationsRun: false,
    migrations: [
      FinanceScopeFoundations1796000000000,
      FinanceConfigurationReviews1796100000000,
      FinanceChartSourceAuthorities1796200000000,
      FinanceJournalCandidates1796300000000,
      FinanceApprovalGovernance1796400000000,
      FinanceEventContractPreviews1796500000000,
      FinanceIntegrationReliability1796600000000,
      FinanceOwnedExceptions1796700000000,
      FinancePolicyGovernance1797100000000,
      FinanceLedgerFoundation1797200000000,
      FinanceRecurringAllocationPreviews1797800000000,
      FinanceAllocationPreviewReviews1797900000000,
      FinanceSourceAttestations1798000000000,
      FinanceSourceKeyChanges1798100000000,
    ],
    entities: [],
  };
}
