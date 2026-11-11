import {
  RenewalRows,
  TiraRows,
  TransactionRows,
  type RegisterHeader,
} from '@/modules/tenant/underwrite/components/TransactionRows';
import type { TransactionListSource } from '@/modules/tenant/underwrite/pages/transaction-list-source';
import { motorInsuranceTransactionsApi } from '../api';
import { motorInsurancePaths, type MotorTransactionTab } from '../paths';

/**
 * Motor + Fleet rows. Retry is not offered from the combined list (the row's
 * line is not known here); opening the record offers it on its own page.
 */
const SOURCE: TransactionListSource = {
  keyPrefix: ['motor-insurance', 'transactions'],
  noun: 'motor',
  listRenewals: motorInsuranceTransactionsApi.listRenewals,
  listTransactions: motorInsuranceTransactionsApi.listTransactions,
  getTiraQueue: motorInsuranceTransactionsApi.getTiraQueue,
  paths: {
    renewal: motorInsurancePaths.policyRenewalDetail,
    endorsement: motorInsurancePaths.policyEndorsementEdit,
    cancellation: motorInsurancePaths.policyCancellationDetail,
    quotation: motorInsurancePaths.quotationDetail,
    policy: motorInsurancePaths.policyDetail,
  },
};

const TITLES: Record<MotorTransactionTab, string> = {
  endorsements: 'Endorsements',
  renewals: 'Renewals',
  cancellations: 'Cancellations',
  'tira-pending': 'TIRAMIS Pending',
};

/** One independent register page per transaction or regulatory queue. */
export function MotorTransactionRegisterPage({
  kind,
}: {
  kind: MotorTransactionTab;
}) {
  const header: RegisterHeader = {
    title: TITLES[kind],
    description: kind.startsWith('tira-')
      ? 'Regulatory submissions for Single Motor and Fleet.'
      : 'Single Motor and Fleet policy ' +
        TITLES[kind].toLowerCase() +
        '. Start a new one from the policy.',
    breadcrumb: [
      { label: 'Motor Insurance', href: motorInsurancePaths.root },
      { label: TITLES[kind] },
    ],
    stateKey: 'motor-' + kind,
    typeChips: kind.startsWith('tira-') ? undefined : TYPE_CHIPS,
  };
  switch (kind) {
    case 'endorsements':
    case 'cancellations':
      return (
        <TransactionRows
          key={kind}
          source={SOURCE}
          kind={kind}
          header={header}
        />
      );
    case 'renewals':
      return <RenewalRows source={SOURCE} header={header} />;
    case 'tira-pending':
      return (
        <TiraRows key={kind} source={SOURCE} kind="pending" header={header} />
      );
  }
}

const TYPE_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'single', label: 'Single' },
  { id: 'fleet', label: 'Fleet' },
];
