import type { Evidence, Line, Option } from '../journals/gl-form';
export const operations = {
  GROUP: 'Asset group',
  LOCATION: 'Asset location',
  CATEGORY: 'Category and depreciation policy',
  ACQUIRE: 'Register acquisition',
  OPENING: 'Register opening balance',
  CAPITALIZE: 'Capitalize asset',
  CAPITAL_ADDITION: 'Capitalize an improvement',
  RECLASSIFY: 'Reclassify asset accounts',
  ASSIGN: 'Assign custodian',
  TRANSFER: 'Transfer asset',
  MAINTENANCE_PLAN: 'Plan maintenance',
  MAINTENANCE_COMPLETE: 'Complete maintenance',
  VERIFY: 'Physical verification',
  DEPRECIATE: 'Post depreciation',
  ESTIMATE: 'Revise depreciation estimate',
  REVALUE: 'Revalue asset',
  IMPAIR: 'Record impairment',
  RESTORE: 'Reverse impairment loss',
  DISPOSE: 'Dispose of asset',
  WRITE_OFF: 'Write off asset',
  LEASE_START: 'Recognize lease and right-of-use asset',
  LEASE_EXEMPT: 'Register exempt lease',
  LEASE_EXPENSE: 'Record exempt lease expense',
  LEASE_END: 'Terminate lease',
  LEASE_TAKE_OWNERSHIP: 'Take ownership of leased asset',
  LEASE_INTEREST: 'Accrue lease interest',
  LEASE_PAYMENT: 'Apply lease payment',
  LEASE_REMEASURE: 'Remeasure lease',
  REVERSE: 'Reverse asset transaction',
} as const;
export type Kind = keyof typeof operations;
export const requirements: Record<string, { title: string; type: string[] }> = {
  asset: { title: 'Asset cost', type: ['ASSET'] },
  clearing: { title: 'Asset clearing', type: ['ASSET'] },
  accumulated: {
    title: 'Accumulated depreciation',
    type: ['ASSET', 'CONTRA_ASSET'],
  },
  depreciation: { title: 'Depreciation expense', type: ['EXPENSE'] },
  impairment: {
    title: 'Accumulated impairment',
    type: ['ASSET', 'CONTRA_ASSET'],
  },
  loss: { title: 'Asset loss', type: ['EXPENSE'] },
  gain: { title: 'Asset gain', type: ['INCOME'] },
  surplus: { title: 'Revaluation surplus', type: ['EQUITY'] },
  retained: { title: 'Retained earnings', type: ['EQUITY'] },
  branchDueFrom: { title: 'Inter-branch due from', type: ['ASSET'] },
  branchDueTo: { title: 'Inter-branch due to', type: ['LIABILITY'] },
  liability: { title: 'Lease liability', type: ['LIABILITY'] },
  interest: { title: 'Lease interest', type: ['EXPENSE'] },
};
export const ownershipLabels = {
  LEASE_TERM: 'Contractual lease term',
  TITLE_TRANSFER: 'Ownership transfers under the agreement',
  PURCHASE_OPTION: 'Purchase option reasonably certain to be exercised',
  UNCONFIRMED: 'Review the original agreement and confirm the basis',
} as const;
export interface Asset {
  code: string;
  name: string;
  category: string;
  group: string;
  location: string;
  serial: string;
  status: string;
  custodian: string | null;
  cost: string;
  accumulated: string;
  sourceCost: string;
  impairment: string;
  residual: string;
  surplus: string;
  acquired: string;
  inService: string | null;
  through: string | null;
  end: string | null;
  policy: { method: string; life: number; rate: string };
  maintenance: { due: string; note: string } | null;
  verified: { date: string; result: string; note: string } | null;
  exemption?: { basis: string; end: string; expense: string };
  ownership?: { date: string; basis: 'TITLE_TRANSFER' | 'PURCHASE_OPTION' };
  lease: {
    ownershipBasis?: keyof typeof ownershipLabels;
    usefulLifeEnd?: string;
    index: number;
    liability: string;
    paid: string;
    accrued: boolean;
    schedule: {
      date: string;
      opening: string;
      interest: string;
      payment: string;
      closing: string;
      accrued?: boolean;
      accruedInterest?: string;
      accruedThrough?: string;
      paid?: string;
    }[];
  } | null;
}
export interface FaDocument {
  id: string;
  sequence: string;
  kind: Kind;
  code: string;
  reference: string;
  state: string;
  effective_date: string;
  maker_id: string;
  journal_id: string | null;
  candidate_id: string | null;
  reason: string | null;
  input: { note?: string; evidence: Evidence };
  plan: {
    asset: Asset | null;
    master?: {
      name: string;
      group?: string;
      branch?: string;
      policy?: {
        method: string;
        life: number;
        model: string;
        roles: Record<string, string>;
      };
    };
    lines: Line[];
    amount: string;
  };
}
export interface Register {
  leaseReview?: { code: string; reasons: string[] }[];
  ownedAssetReview?: { code: string; reasons: string[] }[];
  valuations?: {
    run_id?: string;
    missing?: string[];
    reference: string;
    category: string;
    effective_date: string;
    state: string;
    total: number;
    posted: number;
    outstanding: string[];
  }[];
  today: string;
  currency: string;
  scale: number;
  assets: Asset[];
  documents: FaDocument[];
  evidence: (Evidence & { title: string })[];
  staff: { id: string; label: string }[];
  sources: {
    journal: string;
    line: string;
    reference: string;
    account_code: string;
    role_code: string;
    debit: string;
    credit: string;
    date: string;
  }[];
  roles: { code: string; accountType: string; accountCode: string }[];
  dimensions: {
    label: string;
    code: string;
    required?: boolean;
    options?: Option[];
  }[];
  depreciation: { code: string; date: string; amount: string }[];
}
export interface Report {
  valuations?: Register['valuations'];
  currency: string;
  cost: string;
  depreciation: string;
  impairment: string;
  opening: string;
  change: string;
  closing: string;
  leaseLiability: string;
  assets: Asset[];
  activity: {
    code: string;
    kind: Kind;
    reference: string;
    effective_date: string;
    carrying_change: string;
    journal_id: string | null;
  }[];
  reconciliation: {
    account: string;
    register: string;
    ledger: string;
    difference: string;
  }[];
}
export type Save = (
  path: string,
  body: Record<string, unknown>,
) => Promise<unknown>;
export const options = (xs: string[]): Option[] =>
  xs.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
export const carrying = (a: Asset) =>
  Number(a.cost) - Number(a.accumulated) - Number(a.impairment);
export const format = (v: string | number, scale: number) =>
  Number(v).toLocaleString('en-GB', { maximumFractionDigits: scale });
export function masterChoices(w: Register, k: Kind, date: string) {
  const set = new Map<string, Option>();
  for (const d of w.documents
    .filter(
      (d) => d.kind === k && d.state === 'POSTED' && d.effective_date <= date,
    )
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))) {
    if (!set.has(d.code))
      set.set(d.code, {
        value: d.code,
        label: d.code + ' · ' + d.plan.master?.name,
      });
  }
  return [...set.values()];
}
