import { useSearchParams } from 'react-router-dom';
import { UnderwriteAction } from '@insurance-max/contracts';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  CANCELLATION_VIEW_PERMISSIONS,
  ENDORSEMENT_VIEW_PERMISSIONS,
} from '@/modules/tenant/underwrite/lines';
import {
  RenewalRows,
  TiraRows,
  TransactionRows,
} from '@/modules/tenant/underwrite/pages/UnderwriteTransactionsPage';
import type { TransactionListSource } from '@/modules/tenant/underwrite/pages/transaction-list-source';
import { motorInsuranceTransactionsApi } from '../api';
import { motorInsuranceLineGates } from '../access';
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

const TIRA_PERMISSIONS = [
  'quotations:retry-tiramis',
  'endorsements:retry-tiramis',
  'cancellations:submit-tiramis',
];

const TABS: Array<{
  id: MotorTransactionTab;
  label: string;
  action: Parameters<typeof motorInsuranceLineGates>[0];
  legacy: string[];
}> = [
  {
    id: 'endorsements',
    label: 'Endorsements',
    action: UnderwriteAction.ENDORSEMENTS_VIEW,
    legacy: ENDORSEMENT_VIEW_PERMISSIONS,
  },
  {
    id: 'cancellations',
    label: 'Cancellations',
    action: UnderwriteAction.CANCELLATIONS_VIEW,
    legacy: CANCELLATION_VIEW_PERMISSIONS,
  },
  {
    id: 'renewals',
    label: 'Renewals',
    action: UnderwriteAction.RENEWALS_VIEW,
    legacy: ['renewals:read'],
  },
  {
    id: 'tira-pending',
    label: 'TIRA pending',
    action: UnderwriteAction.TIRA_RETRY,
    legacy: TIRA_PERMISSIONS,
  },
  {
    id: 'tira-failed',
    label: 'TIRA exceptions',
    action: UnderwriteAction.TIRA_RETRY,
    legacy: TIRA_PERMISSIONS,
  },
];

/**
 * Policy transactions for Single Motor and Fleet in one place. Each tab is
 * shown only if the user may see it; the server limits rows to the lines the
 * user holds and applies the usual data scope.
 */
export function MotorTransactionsPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [searchParams, setSearchParams] = useSearchParams();
  const visible = TABS.filter(
    (tab) =>
      motorInsuranceLineGates(tab.action).some(hasPermission) &&
      tab.legacy.some(hasPermission),
  );
  const requested = searchParams.get('tab');
  const active =
    visible.find((tab) => tab.id === requested)?.id ?? visible[0]?.id;

  return (
    <div>
      <PageHeader
        eyebrow="Motor Insurance (New)"
        title="Policy Transactions"
        description="Endorsements, cancellations, renewals and TIRA work for Single Motor and Fleet policies. Start a new one from the policy."
      />
      {active ? (
        <Tabs
          value={active}
          onValueChange={(value) =>
            setSearchParams({ tab: value }, { replace: true })
          }
        >
          <div className="mb-4 overflow-x-auto">
            <TabsList>
              {visible.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {visible.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              {tab.id === active ? <TabBody tab={tab.id} /> : null}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className="text-sm text-slate-600">
          You do not have access to any policy transactions.
        </p>
      )}
    </div>
  );
}

function TabBody({ tab }: { tab: MotorTransactionTab }) {
  switch (tab) {
    case 'endorsements':
    case 'cancellations':
      return <TransactionRows key={tab} source={SOURCE} kind={tab} />;
    case 'renewals':
      return <RenewalRows source={SOURCE} />;
    case 'tira-pending':
      return <TiraRows key={tab} source={SOURCE} kind="pending" />;
    case 'tira-failed':
      return <TiraRows key={tab} source={SOURCE} kind="failed" />;
  }
}
