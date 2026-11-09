import { PageHeader } from '@/components/shared/PageHeader';
import { useUnderwriteLineParam } from '../hooks';
import { lineTransactionSource } from '../pages/transaction-list-source';
import {
  RenewalRows,
  TransactionRows,
  TiraRows,
} from '../components/TransactionRows';
type TransactionListKind = 'renewals' | 'endorsements' | 'cancellations';
type TiraListKind = 'failed' | 'pending';

const TITLES: Record<TransactionListKind | TiraListKind, string> = {
  renewals: 'renewals',
  endorsements: 'endorsements',
  cancellations: 'cancellations',
  failed: 'TIRA failed',
  pending: 'TIRA pending',
};

export function NonMotorTransactionsPage({
  kind,
}: {
  kind: TransactionListKind;
}) {
  const line = useUnderwriteLineParam();
  if (line?.line !== 'NON_MOTOR') return null;

  return (
    <div>
      <PageHeader
        eyebrow={`Underwrite - ${line.label}`}
        title={`${line.label} ${TITLES[kind]}`}
        description={line.description}
      />
      {kind === 'renewals' ? (
        <RenewalRows source={lineTransactionSource(line)} />
      ) : (
        <TransactionRows
          key={kind}
          source={lineTransactionSource(line)}
          kind={kind}
        />
      )}
    </div>
  );
}

export function NonMotorTiraQueuePage({ kind }: { kind: TiraListKind }) {
  const line = useUnderwriteLineParam();
  if (line?.line !== 'NON_MOTOR') return null;

  return (
    <div>
      <PageHeader
        eyebrow={`Underwrite - ${line.label}`}
        title={`${line.label} ${TITLES[kind]}`}
        description={line.description}
      />
      <TiraRows source={lineTransactionSource(line)} kind={kind} />
    </div>
  );
}
