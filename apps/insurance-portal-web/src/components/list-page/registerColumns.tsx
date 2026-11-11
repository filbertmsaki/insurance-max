import {
  CoverPeriodCell,
  DateCell,
  PaymentBadge,
  TiraBadge,
  ToneBadge,
  TwoLineCell,
  TypeBadge,
  type RecordKind,
  type TiraInfo,
} from './cells';
import type { PaymentState, Tone } from './tones';
import { coverHint, type DateInput } from './format';
import type { Attention, ListColumn, MobileRowView } from './types';

/**
 * Data accessors for a transaction register (quotations, policies,
 * endorsements, renewals, cancellations). The column order, the mandatory
 * Date issued / Cover period / TIRA columns, the phone row and the attention
 * bar all come from here, so every register looks and behaves the same.
 */
export interface RegisterColumnConfig<T> {
  /** e.g. 'Quotation no.' */
  recordHeader: string;
  record: (row: T) => string;
  kind?: (row: T) => RecordKind;
  recordSortKey?: string;
  customer: (row: T) => { name: string; secondary?: string | null };
  customerSortKey?: string;
  issued: (row: T) => DateInput;
  issuedSortKey?: string;
  cover: (row: T) => { start: DateInput; end: DateInput };
  coverSortKey?: string;
  status: (row: T) => { label: string; tone: Tone };
  statusSortKey?: string;
  tira: (row: T) => TiraInfo;
  /** e.g. 'Premium', 'Premium change', 'Refund' */
  amountHeader: string;
  amount: (row: T) => { text: string; payment?: PaymentState };
  amountSortKey?: string;
}

export function registerColumns<T>(config: RegisterColumnConfig<T>) {
  const columns: ListColumn<T>[] = [
    {
      key: 'record',
      header: config.recordHeader,
      sortKey: config.recordSortKey,
      mandatory: true,
      className: 'min-w-[170px]',
      cell: (row) => (
        <span className="whitespace-nowrap">{config.record(row)}</span>
      ),
      secondary: config.kind
        ? (row) => <TypeBadge kind={config.kind!(row)} />
        : undefined,
    },
    {
      key: 'customer',
      header: 'Customer',
      sortKey: config.customerSortKey,
      className: 'min-w-[160px] max-w-[240px]',
      cell: (row) => {
        const customer = config.customer(row);
        return (
          <TwoLineCell main={customer.name} secondary={customer.secondary} />
        );
      },
    },
    {
      key: 'issued',
      header: 'Date issued',
      sortKey: config.issuedSortKey,
      mandatory: true,
      className: 'min-w-[96px]',
      cell: (row) => <DateCell value={config.issued(row)} />,
    },
    {
      key: 'cover',
      header: 'Cover period',
      sortKey: config.coverSortKey,
      mandatory: true,
      className: 'min-w-[170px]',
      cell: (row) => {
        const cover = config.cover(row);
        return <CoverPeriodCell start={cover.start} end={cover.end} />;
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortKey: config.statusSortKey,
      className: 'min-w-[120px]',
      cell: (row) => {
        const status = config.status(row);
        return <ToneBadge tone={status.tone}>{status.label}</ToneBadge>;
      },
    },
    {
      key: 'tira',
      header: 'TIRA',
      mandatory: true,
      className: 'min-w-[130px] max-w-[180px]',
      cell: (row) => <TiraBadge info={config.tira(row)} />,
    },
    {
      key: 'amount',
      header: config.amountHeader,
      sortKey: config.amountSortKey,
      align: 'right',
      className: 'min-w-[130px]',
      cell: (row) => {
        const amount = config.amount(row);
        return (
          <span className="flex flex-col items-end gap-1 leading-5">
            <span className="font-semibold whitespace-nowrap tabular-nums">
              {amount.text}
            </span>
            <PaymentBadge state={amount.payment ?? null} />
          </span>
        );
      },
    },
  ];

  const getAttention = (row: T): Attention => {
    if (config.tira(row).state === 'failed') return 'danger';
    const cover = config.cover(row);
    return coverHint(cover.start, cover.end)?.kind === 'expiring'
      ? 'warning'
      : null;
  };

  const mobileRow = (row: T): MobileRowView => {
    const customer = config.customer(row);
    const status = config.status(row);
    const cover = config.cover(row);
    const amount = config.amount(row);
    const record = config.record(row);
    return {
      title: record,
      kind: config.kind?.(row),
      amount: amount.text,
      subtitle: customer.name,
      status,
      coverStart: cover.start,
      coverEnd: cover.end,
      issued: config.issued(row),
      tira: config.tira(row),
      ariaLabel: `${config.recordHeader.replace(/\.$/, '')} ${record}, ${customer.name}, ${status.label}, ${amount.text}`,
    };
  };

  return { columns, getAttention, mobileRow };
}
