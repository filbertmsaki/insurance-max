import { PageHeader } from '@/components/shared/PageHeader';
import {
  RenewalRows,
  TiraRows,
  TransactionRows,
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
  return (
    <div>
      <PageHeader
        eyebrow="Motor Insurance"
        title={TITLES[kind]}
        description={
          kind.startsWith('tira-')
            ? 'Regulatory submissions for Single Motor and Fleet.'
            : 'Single Motor and Fleet policy ' +
              TITLES[kind].toLowerCase() +
              '. Start a new one from the policy.'
        }
      />
      <RegisterBody kind={kind} />
    </div>
  );
}

function RegisterBody({ kind }: { kind: MotorTransactionTab }) {
  switch (kind) {
    case 'endorsements':
    case 'cancellations':
      return <TransactionRows key={kind} source={SOURCE} kind={kind} />;
    case 'renewals':
      return <RenewalRows source={SOURCE} />;
    case 'tira-pending':
      return <TiraRows key={kind} source={SOURCE} kind="pending" />;
  }
}
