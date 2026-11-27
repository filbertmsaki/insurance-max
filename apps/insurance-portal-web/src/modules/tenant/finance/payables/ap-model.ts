import type { Evidence, Workspace, Option } from '../journals/gl-form';

export const names: Record<string, string> = {
  SETTINGS: 'AP settings and tax rules',
  CATEGORY: 'Supplier category',
  SUPPLIER: 'Supplier',
  BANK: 'Beneficiary bank account',
  ORDER: 'Purchase order',
  RECEIPT: 'Goods or service receipt',
  BILL: 'Supplier invoice',
  CREDIT: 'Supplier credit note',
  CREDIT_APPLICATION: 'Apply supplier credit',
  SUPPLIER_REFUND: 'Receive supplier refund',
  OPENING_IMPORT: 'Import outstanding supplier invoices',
  DEBIT: 'Supplier debit note',
  ADVANCE: 'Supplier advance',
  APPLICATION: 'Apply supplier advance',
  EXPENSE: 'Employee expense claim',
  IMPREST: 'Staff imprest',
  RETIREMENT: 'Imprest retirement',
  PAYMENT: 'Payment request and voucher',
  BATCH: 'Payment batch',
  RECONCILIATION: 'Supplier reconciliation',
  REVERSAL: 'Reverse a posting',
};
export const moneyKinds = ['PAYMENT', 'ADVANCE', 'IMPREST'];
export type Info = Record<string, string>;
export interface Details extends Record<string, unknown> {
  name?: string;
  netOpening?: string;
  rootId?: string;
  disabled?: boolean;
  taxClass?: string;
  registeredCompanyId?: string;
  description?: string;
  bankName?: string;
  accountEnding?: string;
  originalId?: string;
  orderId?: string;
  bankAmount?: string;
  taxRules?: Info[];
  lines?: Info[];
  allocations?: Info[];
  payments?: string[];
}
export interface Row {
  id: string;
  kind: string;
  reference: string;
  currency: string;
  status: string;
  state: string;
  party: string;
  sequence: string;
  revision: number;
  amount: string;
  doc_date: string;
  due_date?: string;
  candidate_id?: string;
  journal_no?: string;
  journal_id?: string;
  review_reason?: string;
  maker_id?: string;
  reviewer_user_id?: string;
  settlement?: Info;
  data: {
    details: Details;
    dimensions: Record<string, string>;
    evidence?: Evidence;
    bankId?: string;
    orderId?: string;
    batchItems?: string[];
    movements: { itemId: string; amount: string }[];
    lines: { role: string; debit: string; credit: string }[];
  };
}
export type Controls = Pick<
  Workspace,
  'dimensions' | 'documents' | 'roles' | 'currencies' | 'functionalCurrency'
>;
export interface Register {
  records: Row[];
  terms: { code: string; days: number; isDefault: boolean }[];
  staff: { id: string; name: string }[];
  companies?: Info[];
  availableCredits?: Record<string, string>;
  cashTills?: { id: string; code: string; name: string; currency: string }[];
  receivingRoles?: { code: string; accountCode?: string | null }[];
}
export function currentRows(rows: Row[], kind: string) {
  const used = new Set<string>();
  return rows.filter((r) => {
    const key = r.party + '/' + r.reference.toUpperCase();
    if (r.kind !== kind || r.state !== 'APPROVED' || used.has(key))
      return false;
    used.add(key);
    return !r.data.details.disabled;
  });
}
export const choices = (r: Row[]): Option[] =>
  r.map((x) => ({
    value: x.id,
    label:
      x.reference + (x.data.details.name ? ' · ' + x.data.details.name : ''),
  }));
export const title = (key: string) =>
  ({
    tin: 'TIN',
    vrn: 'VRN',
    swift: 'SWIFT / BIC',
    vatBps: 'Input VAT (basis points)',
    recoverableVatBps: 'Recoverable share of VAT (basis points)',
    withholdingBase: 'Withholding calculation base',
    withholdingBps: 'Withholding (basis points)',
    discountBps: 'Discount (basis points)',
    matchOrder: 'Require three-way matching',
    bankId: 'Approved beneficiary account',
    tillId: 'Pay from cash till (optional)',
    itemId: 'Original open item',
    advanceId: 'Available advance',
    creditId: 'Supplier credit note',
    availableCredit: 'Credit carried at issue',
    controlRole: 'Payable control account',
    functionalAmount: 'Carrying amount in book currency',
    supplierCode: 'Supplier code',
    monthlyDueDay: 'Monthly due day (optional)',
    termCode: 'Supplier payment term',
    taxClass: 'Supplier tax classification',
    accountEnding: 'Account ending',
    orderId: 'Purchase order',
    documentId: 'Document',
    rootId: 'Master ID',
  })[key] ??
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
export interface Draft {
  kind: string;
  reference: string;
  date: string;
  currency: string;
  supplierId: string;
  employeeId: string;
  replacesId: string;
  dimensions: Record<string, string>;
  details: Details;
  evidence?: Evidence;
  requestKey: string;
}
export function blank(kind: string, currency: string): Draft {
  return {
    kind,
    reference: kind === 'SETTINGS' ? 'AP' : '',
    date: new Date().toLocaleDateString('sv-SE'),
    currency,
    supplierId: '',
    employeeId: '',
    replacesId: '',
    dimensions: {},
    details: {},
    requestKey: crypto.randomUUID(),
  };
}
export const roleFields = [
  'payableRole',
  'employeePayableRole',
  'advanceRole',
  'imprestRole',
  'vatRole',
  'withholdingRole',
  'discountRole',
  'bankRole',
];
export const masterKinds = ['SETTINGS', 'CATEGORY', 'SUPPLIER', 'BANK'];
export function partyKey(r: Row) {
  return r.kind === 'SUPPLIER'
    ? 'S:' + (r.data.details.rootId || r.id)
    : r.party;
}
export function makeInput(d: Draft) {
  const { supplierId, employeeId, replacesId, ...rest } = d;
  return {
    ...rest,
    ...(supplierId ? { supplierId } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(replacesId ? { replacesId } : {}),
  };
}
