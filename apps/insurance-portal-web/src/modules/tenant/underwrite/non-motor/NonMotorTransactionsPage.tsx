import { useUnderwriteLineParam } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';
import { lineTransactionSource } from '../pages/transaction-list-source';
import {
  RenewalRows,
  TransactionRows,
  TiraRows,
  type RegisterHeader,
} from '../components/TransactionRows';

type TransactionListKind = 'renewals' | 'endorsements' | 'cancellations';
type TiraListKind = 'failed' | 'pending';

const TITLES: Record<TransactionListKind | TiraListKind, string> = {
  renewals: 'Renewals',
  endorsements: 'Endorsements',
  cancellations: 'Cancellations',
  failed: 'TIRA failed',
  pending: 'TIRA pending',
};

function headerFor(
  line: UnderwriteLineMeta,
  kind: TransactionListKind | TiraListKind,
): RegisterHeader {
  return {
    title: `${line.label} ${TITLES[kind].replace(/^\w/, (c) => c.toLowerCase())}`,
    description: line.description,
    breadcrumb: [
      { label: line.label, href: underwritePaths.lineDashboard(line.slug) },
      { label: TITLES[kind] },
    ],
    stateKey: `${line.slug}-${kind}`,
  };
}

export function NonMotorTransactionsPage({
  kind,
}: {
  kind: TransactionListKind;
}) {
  const line = useUnderwriteLineParam();
  if (line?.line !== 'NON_MOTOR') return null;
  const header = headerFor(line, kind);

  return kind === 'renewals' ? (
    <RenewalRows
      key={line.slug}
      source={lineTransactionSource(line)}
      header={header}
    />
  ) : (
    <TransactionRows
      key={`${line.slug}-${kind}`}
      source={lineTransactionSource(line)}
      kind={kind}
      header={header}
    />
  );
}

export function NonMotorTiraQueuePage({ kind }: { kind: TiraListKind }) {
  const line = useUnderwriteLineParam();
  if (line?.line !== 'NON_MOTOR') return null;

  return (
    <TiraRows
      key={`${line.slug}-${kind}`}
      source={lineTransactionSource(line)}
      kind={kind}
      header={headerFor(line, kind)}
    />
  );
}
