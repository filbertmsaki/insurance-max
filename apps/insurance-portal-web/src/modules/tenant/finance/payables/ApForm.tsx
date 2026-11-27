import { useState } from 'react';
import { OpeningInvoiceImport } from './OpeningInvoiceImport';
import { amountLabel } from './ap-export';
import { Button } from '@/components/ui/button';
import { Field, DocumentField } from '../journals/GlFields';
import { type Option } from '../journals/gl-form';
import {
  blank,
  choices,
  currentRows,
  makeInput,
  masterKinds,
  moneyKinds,
  names,
  partyKey,
  roleFields,
  title,
  type Controls,
  type Draft,
  type Info,
  type Register,
} from './ap-model';
interface Props {
  w: Controls;
  registry: Register;
  save: (input: ReturnType<typeof makeInput>) => Promise<void>;
  employee?: string;
  initialKind?: string;
  onKindChange?: (kind: string) => void;
}
const flags = ['matchOrder', 'disabled', 'takeDiscount'];
const ints = [
  'discountDays',
  'discountBps',
  'monthlyDueDay',
  'vatBps',
  'recoverableVatBps',
  'withholdingBps',
];

const documentGroups = {
  'Supplier setup': ['SETTINGS', 'CATEGORY', 'SUPPLIER', 'BANK'],
  'Purchases and adjustments': [
    'ORDER',
    'RECEIPT',
    'BILL',
    'CREDIT',
    'CREDIT_APPLICATION',
    'SUPPLIER_REFUND',
    'DEBIT',
    'OPENING_IMPORT',
  ],
  'Staff expenses': ['EXPENSE', 'IMPREST', 'RETIREMENT'],
  'Payments and reconciliation': [
    'ADVANCE',
    'APPLICATION',
    'PAYMENT',
    'BATCH',
    'RECONCILIATION',
    'REVERSAL',
  ],
};

export function ApForm({
  w,
  registry,
  save,
  employee,
  initialKind,
  onKindChange,
}: Props) {
  const allowed = employee
    ? ['EXPENSE', 'IMPREST', 'RETIREMENT', 'BANK']
    : Object.keys(names);
  const initial = (k: string) => ({
    ...blank(k, w.functionalCurrency),
    employeeId: employee ?? '',
  });
  const selectedKind =
    initialKind && allowed.includes(initialKind) ? initialKind : allowed[0];
  const [v, set] = useState<Draft>(() => initial(selectedKind)),
    [busy, working] = useState(false);
  if (onKindChange && v.kind !== selectedKind) set(initial(selectedKind));
  const change = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    set((s) => ({ ...s, [key]: val }));
  const detail = (key: string, val: unknown) =>
    set((s) => ({ ...s, details: { ...s.details, [key]: val } }));
  const { kind, details: d } = v,
    { records } = registry;
  const active = (k: string) => currentRows(records, k);
  const selected = records.find((r) => r.id === v.supplierId);
  const party = selected
    ? partyKey(selected)
    : v.employeeId
      ? 'E:' + v.employeeId
      : '';
  const scoped = records.filter(
    (r) => r.party === party && r.currency === v.currency,
  );
  const roles = (types: string[]) =>
    w.roles
      .filter((r) => r.accountCode && types.includes(r.accountType))
      .map((r) => ({ value: r.code, label: r.accountCode + ' · ' + r.code }));
  const cfg = active('SETTINGS')[0]?.data.details;
  const bank = choices(
    active('BANK').filter(
      (r) => r.party === party && r.currency === v.currency,
    ),
  );
  const posted = (kinds: string[]) =>
    choices(
      scoped.filter((r) => kinds.includes(r.kind) && r.status === 'POSTED'),
    );
  const selectOptions: Record<string, Option[]> = {
    categoryId: choices(active('CATEGORY')),
    termCode: registry.terms.map((t) => ({
      value: t.code,
      label: t.code + ' · ' + t.days + ' days',
    })),
    taxClass: [
      ...new Set<string>(
        (cfg?.taxRules ?? []).map((x: Info) => x.supplierClass),
      ),
    ].map((value) => ({ value, label: value })),
    bankId: bank,
    bankRole:
      kind === 'SUPPLIER_REFUND' || kind === 'RETIREMENT'
        ? (registry.receivingRoles ?? []).map((r) => ({
            value: r.code,
            label: r.accountCode + ' · ' + r.code,
          }))
        : roles(['ASSET']),
    controlRole: roles(['LIABILITY']),
    creditId: scoped
      .filter(
        (r) =>
          r.kind === 'CREDIT' &&
          r.status === 'POSTED' &&
          registry.availableCredits?.[r.id],
      )
      .map((r) => ({
        value: r.id,
        label:
          r.reference +
          ' · ' +
          r.currency +
          ' ' +
          amountLabel(registry.availableCredits![r.id]),
      })),
    payableRole: roles(['LIABILITY']),
    employeePayableRole: roles(['LIABILITY']),
    withholdingRole: roles(['LIABILITY']),
    advanceRole: roles(['ASSET']),
    imprestRole: roles(['ASSET']),
    vatRole: roles(['ASSET']),
    discountRole: roles(['INCOME', 'EXPENSE']),
    orderId: choices(
      scoped.filter((r) => r.kind === 'ORDER' && r.state === 'APPROVED'),
    ),
    advanceId: posted(['ADVANCE']),
    itemId: posted(kind === 'RETIREMENT' ? ['IMPREST'] : ['BILL']),
    originalId: choices(
      scoped.filter(
        (r) =>
          r.status === 'POSTED' &&
          r.kind !== 'REVERSAL' &&
          !r.data.details.openingImportId,
      ),
    ),
  };
  const field = (key: string) => {
    if (flags.includes(key))
      return (
        <label key={key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!d[key]}
            onChange={(e) => detail(key, e.target.checked)}
          />
          {title(key)}
        </label>
      );
    return (
      <Field
        key={key}
        label={
          key === 'bankRole' && ['RETIREMENT', 'SUPPLIER_REFUND'].includes(kind)
            ? 'Receiving account'
            : title(key)
        }
        value={String(d[key] ?? '')}
        change={(x) => detail(key, ints.includes(key) ? Number(x) : x)}
        options={selectOptions[key]}
        type={
          ['scheduledDate', 'from'].includes(key)
            ? 'date'
            : ints.includes(key)
              ? 'number'
              : 'text'
        }
      />
    );
  };
  const table = (
    key: string,
    cols: string[],
    options: Record<string, Option[]> = {},
  ) => {
    const rows: Record<string, string | number>[] = Array.isArray(d[key])
      ? d[key]
      : [];
    return (
      <fieldset className="space-y-2 rounded border p-3">
        <legend>{key === 'lines' ? 'Document lines' : title(key)}</legend>
        {rows.map((row, i) => (
          <div className="flex flex-wrap items-end gap-2" key={i}>
            {cols.map((col) => (
              <Field
                key={col}
                label={title(col)}
                value={String(row[col] ?? '')}
                options={options[col]}
                change={(value) =>
                  detail(
                    key,
                    rows.map((r, j) =>
                      i === j
                        ? {
                            ...r,
                            [col]: ints.includes(col) ? Number(value) : value,
                          }
                        : r,
                    ),
                  )
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                detail(
                  key,
                  rows.filter((_, j) => i !== j),
                )
              }
            >
              Remove line
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            detail(key, [
              ...rows,
              Object.fromEntries(
                cols.map((k) => [
                  k,
                  k === 'recoverableVatBps'
                    ? 10000
                    : k === 'withholdingBase'
                      ? 'NET'
                      : ints.includes(k)
                        ? 0
                        : k === 'quantity'
                          ? '1'
                          : '',
                ]),
              ),
            ])
          }
        >
          Add{' '}
          {key === 'taxRules'
            ? 'tax rule'
            : key === 'allocations'
              ? 'allocation'
              : 'line'}
        </Button>
      </fieldset>
    );
  };
  const master = masterKinds.includes(kind);
  const supplier = [
    'ORDER',
    'RECEIPT',
    'BILL',
    'CREDIT',
    'CREDIT_APPLICATION',
    'SUPPLIER_REFUND',
    'DEBIT',
    'ADVANCE',
    'APPLICATION',
    'RECONCILIATION',
  ].includes(kind);
  const both = ['BANK', 'PAYMENT', 'REVERSAL'].includes(kind);
  const staff = ['EXPENSE', 'IMPREST', 'RETIREMENT'].includes(kind);
  const hasLines = [
    'ORDER',
    'BILL',
    'CREDIT',
    'DEBIT',
    'EXPENSE',
    'RETIREMENT',
  ].includes(kind);
  const money = ['ADVANCE', 'IMPREST', 'PAYMENT'].includes(kind);
  const accounting =
    hasLines ||
    money ||
    ['APPLICATION', 'CREDIT_APPLICATION', 'SUPPLIER_REFUND'].includes(kind);
  const supplierInfo = selected?.data.details;
  const txnClasses: Option[] = [
    ...new Set<string>(
      (cfg?.taxRules ?? [])
        .filter((x: Info) => x.supplierClass === supplierInfo?.taxClass)
        .map((x: Info) => x.transactionClass),
    ),
  ].map((value) => ({ value, label: value }));
  function revise(id: string) {
    const r = records.find((x) => x.id === id);
    if (!r) {
      set(initial(kind));
      return;
    }
    const sup = active('SUPPLIER').find((s) => partyKey(s) === r.party);
    set({
      ...initial(kind),
      reference: r.reference,
      currency: r.currency,
      replacesId: r.id,
      supplierId: sup?.id ?? '',
      employeeId:
        employee ?? (r.party.startsWith('E:') ? r.party.slice(2) : ''),
      dimensions: r.data.dimensions,
      details: {
        ...r.data.details,
        bankId: r.data.bankId,
        orderId: r.data.orderId,
        accountNumber: '',
      },
      evidence: r.data.evidence,
    });
  }
  async function submit() {
    working(true);
    try {
      const payload = makeInput(v);
      if (kind === 'SETTINGS')
        payload.details = { ...d, taxRules: d.taxRules ?? [] };
      if (kind === 'RETIREMENT' || kind === 'RECONCILIATION')
        payload.details = { ...d, lines: d.lines ?? [] };
      await save(payload);
      set(initial(kind));
    } finally {
      working(false);
    }
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit().catch(() => {});
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label="Document type"
          optionGroups={employee ? undefined : documentGroups}
          value={kind}
          options={allowed.map((k) => ({ value: k, label: names[k] }))}
          change={onKindChange ?? ((kind) => set(initial(kind)))}
        />
        {master && (
          <Field
            label="Revise approved record"
            value={v.replacesId}
            options={choices(
              records
                .filter((r) => r.kind === kind && r.state === 'APPROVED')
                .filter(
                  (r, i, all) =>
                    all.findIndex(
                      (x) => x.reference === r.reference && x.party === r.party,
                    ) === i,
                ),
            )}
            change={revise}
          />
        )}
        {!master &&
          records.some(
            (r) => r.kind === 'REVERSAL' && r.status === 'POSTED',
          ) && (
            <Field
              label="Replace reversed document"
              value={v.replacesId}
              options={choices(
                records.filter(
                  (r) =>
                    r.kind === kind &&
                    records.some(
                      (v) =>
                        v.kind === 'REVERSAL' &&
                        v.status === 'POSTED' &&
                        v.data.details.originalId === r.id,
                    ),
                ),
              )}
              change={revise}
            />
          )}
        <Field
          label={kind === 'BILL' ? 'Supplier invoice number' : 'Reference'}
          value={v.reference}
          change={(x) => change('reference', x)}
        />
        <Field
          label={kind === 'OPENING_IMPORT' ? 'Cutover date' : 'Document date'}
          value={v.date}
          type="date"
          change={(x) => change('date', x)}
        />
        <Field
          label="Currency"
          value={v.currency}
          options={(kind === 'OPENING_IMPORT'
            ? [w.functionalCurrency]
            : Object.keys(w.currencies)
          ).map((value) => ({
            value,
            label: value,
          }))}
          change={(x) => change('currency', x)}
        />
        {!employee && (supplier || both) && (
          <Field
            label="Supplier"
            value={v.supplierId}
            options={choices(active('SUPPLIER'))}
            change={(id) => {
              const r = records.find((x) => x.id === id);
              set((s) => ({
                ...s,
                supplierId: id,
                employeeId: '',
                currency: r?.currency ?? s.currency,
                details: {},
              }));
            }}
          />
        )}
        {!employee && (staff || both) && (
          <Field
            label="Employee"
            value={v.employeeId}
            options={registry.staff.map((s) => ({
              value: s.id,
              label: s.name,
            }))}
            change={(id) =>
              set((s) => ({
                ...s,
                employeeId: id,
                supplierId: '',
                details: {},
              }))
            }
          />
        )}
        <DocumentField
          w={w}
          value={v.evidence}
          change={(e) => change('evidence', e)}
        />
        {accounting &&
          w.dimensions.map((x) => (
            <Field
              key={x.code}
              label={x.label}
              value={v.dimensions[x.code] ?? ''}
              options={x.options}
              change={(val) => {
                const dims = { ...v.dimensions };
                if (val) dims[x.code] = val;
                else delete dims[x.code];
                change('dimensions', dims);
              }}
            />
          ))}
        {kind === 'SETTINGS' && roleFields.map(field)}
        {kind === 'CATEGORY' && ['name', 'matchOrder'].map(field)}
        {kind === 'SUPPLIER' && !!registry.companies?.length && (
          <Field
            label="Registered company (optional)"
            value={d.registeredCompanyId ?? ''}
            options={registry.companies.map((x) => ({
              value: x.id,
              label: x.name,
            }))}
            change={(id) => {
              const c = registry.companies?.find((x) => x.id === id);
              set((s) => ({
                ...s,
                currency: c?.currency ?? s.currency,
                details: {
                  ...s.details,
                  ...(c
                    ? {
                        name: c.name,
                        tin: c.tin,
                        vrn: c.vrn,
                        address: c.address,
                        email: c.email,
                        phone: c.phone,
                        termCode: c.termCode,
                      }
                    : {}),
                  registeredCompanyId: id,
                },
              }));
            }}
          />
        )}
        {kind === 'SUPPLIER' &&
          [
            'name',
            'categoryId',
            'tin',
            'vrn',
            'address',
            'email',
            'phone',
            'termCode',
            'monthlyDueDay',
            'taxClass',
            'payableRole',
            'discountDays',
            'discountBps',
          ].map(field)}
        {kind === 'BANK' &&
          ['bankName', 'accountName', 'accountNumber', 'branch', 'swift'].map(
            field,
          )}
        {master && kind !== 'SETTINGS' && field('disabled')}
        {!master && kind !== 'RECONCILIATION' && field('description')}
        {['BILL', 'RECEIPT'].includes(kind) && field('orderId')}
        {['CREDIT', 'DEBIT', 'RETIREMENT'].includes(kind) && field('itemId')}
        {kind === 'APPLICATION' && field('advanceId')}
        {['SUPPLIER_REFUND', 'CREDIT_APPLICATION'].includes(kind) &&
          field('creditId')}
        {kind === 'OPENING_IMPORT' && field('controlRole')}
        {money &&
          ['bankId', 'scheduledDate', ...(!employee ? ['bankRole'] : [])].map(
            field,
          )}
        {['ADVANCE', 'IMPREST', 'SUPPLIER_REFUND'].includes(kind) &&
          field('amount')}
        {kind === 'PAYMENT' && field('takeDiscount')}
        {kind === 'RETIREMENT' && field('cashReturned')}
        {(kind === 'SUPPLIER_REFUND' ||
          (kind === 'RETIREMENT' && Number(d.cashReturned) > 0)) &&
          field('bankRole')}
        {kind === 'REVERSAL' && field('originalId')}
        {kind === 'RECONCILIATION' && ['from', 'opening', 'closing'].map(field)}
      </div>
      {kind === 'SETTINGS' &&
        table(
          'taxRules',
          [
            'supplierClass',
            'transactionClass',
            'vatBps',
            'recoverableVatBps',
            'withholdingBase',
            'withholdingBps',
          ],
          {
            withholdingBase: [
              { value: 'NET', label: 'Before VAT' },
              { value: 'GROSS', label: 'Including VAT' },
            ],
          },
        )}
      {hasLines &&
        table(
          'lines',
          [
            'item',
            'description',
            'quantity',
            'unitPrice',
            'role',
            ...(!staff ? ['transactionClass'] : []),
          ],
          {
            role: roles(staff ? ['EXPENSE'] : ['ASSET', 'EXPENSE']),
            transactionClass: txnClasses,
          },
        )}
      {kind === 'RECEIPT' &&
        table('lines', ['item', 'quantity'], {
          item: (
            scoped.find((r) => r.id === d.orderId)?.data.details.lines ?? []
          ).map((l: Info) => ({
            value: l.item,
            label: l.item + ' · ' + l.description,
          })),
        })}
      {kind === 'OPENING_IMPORT' && (
        <OpeningInvoiceImport
          currency={w.functionalCurrency}
          lines={d.lines ?? []}
          change={(rows) => detail('lines', rows)}
        />
      )}
      {['APPLICATION', 'PAYMENT', 'CREDIT_APPLICATION'].includes(kind) &&
        table('allocations', ['itemId', 'amount'], {
          itemId: posted(['BILL', 'EXPENSE', 'RETIREMENT']),
        })}
      {kind === 'RECONCILIATION' && table('lines', ['reference', 'amount'])}
      {kind === 'BATCH' && (
        <fieldset>
          <legend>Approved vouchers due by the batch date</legend>
          {records
            .filter(
              (r) =>
                moneyKinds.includes(r.kind) &&
                r.status === 'APPROVED' &&
                r.currency === v.currency &&
                (r.due_date ?? '') <= v.date,
            )
            .map((r) => (
              <label className="block" key={r.id}>
                <input
                  type="checkbox"
                  checked={(d.payments ?? []).includes(r.id)}
                  onChange={(e) =>
                    detail(
                      'payments',
                      e.target.checked
                        ? [...(d.payments ?? []), r.id]
                        : (d.payments ?? []).filter((x: string) => x !== r.id),
                    )
                  }
                />{' '}
                {r.reference} · {r.currency} {r.amount}
              </label>
            ))}
        </fieldset>
      )}
      <Button
        type="submit"
        disabled={busy || (kind === 'OPENING_IMPORT' && !d.lines?.length)}
      >
        {busy ? 'Submitting…' : 'Submit for approval'}
      </Button>
    </form>
  );
}
