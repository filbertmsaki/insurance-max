import { CASH_BANK_MODULES, FIN01_MODULES } from '@insurance-max/contracts';
import { BookOpen, Receipt } from 'lucide-react';
import type { NavLeaf } from '@/components/layout/nav-config';
import { names as payableDocuments } from './payables/ap-model';
import { names as receivableDocuments } from './receivables/customer-account-model';
import { operations as assetOperations } from './assets/asset-model';

const foundation = 'finance-foundation:read';
const prepare = 'finance-foundation:prepare';
const setup = 'Accounting setup';
const ledger = 'General ledger';
const payable = 'Accounts payable and expenses';
const receivable = 'Accounts receivable';
const assets = 'Fixed assets';
const cashBank = 'Cash and bank';
const other = 'Insurance and operations';

const submoduleTerms: Record<string, string[]> = {
  'setup?view=operating&control=FIN-01.08': ['FIN-02.01 Chart of accounts'],
  'general-ledger': ['FIN-02.02 General journals'],
  'general-ledger?view=ledger-activity': [
    'FIN-02.03 Automated journals',
    'FIN-02.15 General ledger inquiry',
  ],
  'general-ledger?view=programs': [
    'FIN-02.04 Recurring journals',
    'FIN-02.05 Journal templates',
    'FIN-02.09 Accruals',
    'FIN-02.10 Prepayments',
    'FIN-02.11 Inter-branch accounting',
    'FIN-02.12 Cost allocation',
    'FIN-02.13 Foreign currency revaluation',
    'FIN-02.14 Account reconciliation',
  ],
  'general-ledger?view=approvals': [
    'FIN-02.06 Journal approval',
    'FIN-02.07 Journal posting',
  ],
  'general-ledger?view=corrections': ['FIN-02.08 Journal reversal'],
  'trial-balance': ['FIN-02.16 Trial balance'],
  'payables?view=new-document&action=CATEGORY': [
    'FIN-03.01 Supplier categories',
  ],
  'payables?view=new-document&action=SUPPLIER': [
    'FIN-03.02 Supplier master data',
    'FIN-03.04 Supplier payment terms',
  ],
  'payables?view=new-document&action=BANK': [
    'FIN-03.03 Supplier bank accounts',
  ],
  'payables?view=new-document&action=BILL': [
    'FIN-03.05 Purchase invoice registration',
    'FIN-03.06 Purchase order matching',
  ],
  'payables?view=new-document&action=CREDIT': [
    'FIN-03.07 Supplier credit notes',
  ],
  'payables?view=new-document&action=DEBIT': ['FIN-03.08 Supplier debit notes'],
  'payables?view=new-document&action=ADVANCE': ['FIN-03.09 Supplier advances'],
  'payables?view=new-document&action=EXPENSE': [
    'FIN-03.10 Employee expense claims',
  ],
  'payables?view=new-document&action=IMPREST': [
    'FIN-03.11 Staff imprest management',
  ],
  'payables?view=new-document&action=RETIREMENT': [
    'FIN-03.12 Imprest retirement',
  ],
  'payables?view=new-document&action=PAYMENT': [
    'FIN-03.13 Payment requests',
    'FIN-03.14 Payment vouchers',
  ],
  'payables?view=new-document&action=BATCH': [
    'FIN-03.15 Payment batch processing',
  ],
  'payables?view=new-document&action=RECONCILIATION': [
    'FIN-03.16 Supplier reconciliation',
  ],
  'payables?view=statements-and-aging': [
    'FIN-03.17 Accounts payable aging',
    'FIN-03.18 Supplier statements',
  ],
  'payables?view=payment-schedule': [
    'FIN-03.19 Payment scheduling',
    'FIN-03.20 Early payment discounts',
  ],
  'receivables?view=new-document&action=CATEGORY': [
    'FIN-04.01 Customer categories',
  ],
  'receivables?view=credit-profiles': [
    'FIN-04.02 Customer financial profiles',
    'FIN-04.03 Credit limits',
    'FIN-04.04 Customer payment terms',
  ],
  invoices: ['FIN-04.05 Customer invoices', 'FIN-04.06 Premium billing'],
  'receivables?view=new-document&action=DEBIT_NOTE': ['FIN-04.07 Debit notes'],
  'receivables?view=new-document&action=CREDIT_NOTE': [
    'FIN-04.08 Credit notes',
  ],
  receipts: ['FIN-04.09 Receipt vouchers'],
  'receivables?view=receipts-and-refunds': [
    'FIN-04.10 Payment allocation',
    'FIN-04.11 Unallocated receipts',
  ],
  'receivables?view=new-document&action=ADVANCE': [
    'FIN-04.12 Customer advances',
  ],
  refunds: ['FIN-04.13 Refund management'],
  receivables: ['FIN-04.14 Outstanding balances'],
  'receivables?view=statements-and-aging': [
    'FIN-04.15 Receivable aging',
    'FIN-04.18 Customer statements',
    'FIN-04.20 Customer reconciliation',
  ],
  'receivables?view=collections': [
    'FIN-04.16 Collection management',
    'FIN-04.17 Payment reminders',
  ],
  'receivables?view=new-document&action=IMPAIRMENT': [
    'FIN-04.19 Impairment and bad debt management',
  ],
  'fixed-assets?view=setup': [
    'FIN-05.01 Asset categories',
    'FIN-05.02 Asset groups',
    'FIN-05.03 Asset locations',
  ],
  'fixed-assets?view=new-document&action=CATEGORY': [
    'FIN-05.04 Depreciation configuration',
  ],
  'fixed-assets': ['FIN-05.05 Asset register'],
  'fixed-assets?view=new-document&action=ACQUIRE': [
    'FIN-05.06 Asset acquisition',
  ],
  'fixed-assets?view=new-document&action=CAPITALIZE': [
    'FIN-05.07 Asset capitalization',
  ],
  'fixed-assets?view=new-document&action=ASSIGN': [
    'FIN-05.08 Asset assignment',
  ],
  'fixed-assets?view=new-document&action=TRANSFER': [
    'FIN-05.09 Asset transfer',
  ],
  'fixed-assets?view=new-document&action=MAINTENANCE_PLAN': [
    'FIN-05.10 Asset maintenance',
  ],
  'fixed-assets?view=new-document&action=DEPRECIATE': [
    'FIN-05.11 Depreciation processing',
  ],
  'fixed-assets?view=class-revaluation': ['FIN-05.12 Asset revaluation'],
  'fixed-assets?view=new-document&action=IMPAIR': [
    'FIN-05.13 Asset impairment',
  ],
  'fixed-assets?view=new-document&action=VERIFY': [
    'FIN-05.14 Physical asset verification',
  ],
  'fixed-assets?view=new-document&action=DISPOSE': ['FIN-05.15 Asset disposal'],
  'fixed-assets?view=new-document&action=WRITE_OFF': [
    'FIN-05.16 Asset write-off',
  ],
  'fixed-assets?view=new-document&action=LEASE_START': [
    'FIN-05.17 Lease accounting',
    'FIN-05.18 Right-of-use assets',
  ],
  'fixed-assets?view=reports': ['FIN-05.19 Asset reporting'],
};

function link(
  group: string,
  label: string,
  path: string,
  permission?: string,
  extra: Partial<NavLeaf> = {},
): NavLeaf {
  return {
    kind: 'link',
    subgroup: group,
    label,
    to: '/apps/finance/' + path,
    icon: group === setup || group === ledger ? BookOpen : Receipt,
    permission,
    ...(permission === foundation
      ? { allowedScopes: ['company' as const] }
      : {}),
    ...extra,
    keywords: [...(extra.keywords ?? []), ...(submoduleTerms[path] ?? [])],
  };
}

function views(
  group: string,
  path: string,
  entries: [string, string, string?][],
): NavLeaf[] {
  return entries.map(([view, label, aliases]) =>
    link(group, label, path + '?view=' + view, foundation, {
      directoryOnly: true,
      keywords: aliases ? [aliases] : [],
    }),
  );
}

function documents(
  group: string,
  path: string,
  types: Record<string, string>,
  prominent: string[],
  employee = false,
): NavLeaf[] {
  return Object.entries(types).map(([kind, label]) =>
    link(
      group,
      label,
      path + '?view=new-document&action=' + kind,
      employee ? undefined : foundation,
      {
        directoryOnly: !prominent.includes(kind),
        allowedScopes: ['company'],
        anyPermission: employee ? undefined : [prepare],
        keywords: [kind.replaceAll('_', ' '), 'New document'],
      },
    ),
  );
}

export const financeDestinations: NavLeaf[] = [
  link('', 'Finance dashboard', 'dashboard', 'finance:dashboard'),
  link('', 'My expenses and imprests', 'my-expenses', undefined, {
    allowedScopes: ['company'],
  }),
  link(setup, 'Accounting setup', 'setup', foundation, {
    keywords: ['FIN-01', 'onboarding', 'first book'],
  }),
  link(setup, 'Foundation review', 'foundation', foundation, {
    keywords: ['book review', 'supporting documents'],
  }),
  ...views(setup, 'setup', [
    [
      'steps',
      'Setup steps',
      'financial books currencies exchange rates financial years periods accounts dimensions numbering payment terms payment methods posting rules opening balances',
    ],
    ['company', 'Company legal records', 'company financial profile Tanzania'],
    [
      'configuration',
      'Configurations and policies',
      'financial configuration approval',
    ],
    ['allocations', 'Recurring allocations'],
    ['operating', 'FIN-01 readiness', 'configuration validation'],
  ]),
  ...FIN01_MODULES.map(([code, name]) =>
    link(setup, name, 'setup?view=operating&control=' + code, foundation, {
      directoryOnly: true,
      keywords: [code],
    }),
  ),
  link(ledger, 'General ledger workspace', 'general-ledger', foundation, {
    keywords: ['FIN-02', 'manual journals vouchers', 'insurance measurement'],
  }),
  link(ledger, 'Journal register', 'journals', 'finance-journals:read', {
    keywords: ['Journals', 'posted entries'],
  }),
  link(ledger, 'Trial balance', 'trial-balance', foundation, {
    keywords: ['account inquiry', 'debits credits'],
  }),
  ...views(ledger, 'general-ledger', [
    ['approvals', 'Journal approvals'],
    [
      'programs',
      'Journal programs',
      'recurring journals templates accruals prepayments inter-branch allocation revaluation reconciliation',
    ],
    ['corrections', 'Journal corrections', 'reversal replacement'],
    ['ledger-activity', 'Ledger activity and account history'],
    ['book-rollout', 'Book rollout'],
  ]),
  link(
    ledger,
    'Invoice write-offs',
    'general-ledger?view=write-offs',
    foundation,
    {
      directoryOnly: true,
      anyPermissionGroups: [[prepare], ['invoices:write-off']],
    },
  ),
  link(payable, 'Payables register', 'payables', foundation, {
    keywords: ['FIN-03', 'accounts payable and expenses', 'suppliers'],
  }),
  ...documents(payable, 'payables', payableDocuments, ['BILL', 'PAYMENT']),
  ...views(payable, 'payables', [
    ['payment-schedule', 'Supplier payment schedule'],
    ['statements-and-aging', 'Supplier statements and aging'],
    ['gl-approvals', 'Payables GL approvals'],
  ]),
  link(receivable, 'Customer balances', 'receivables', foundation, {
    keywords: ['FIN-04', 'accounts receivable', 'outstanding'],
  }),
  link(receivable, 'Customer invoices', 'invoices', 'invoices:read', {
    keywords: ['premium billing'],
  }),
  link(
    receivable,
    'New manual invoice',
    'invoices/new',
    'invoices:create-manual',
    { allowedScopes: ['company'] },
  ),
  link(receivable, 'Payments', 'payments', 'payments:read', {
    keywords: ['record payment', 'post receipt against payment'],
  }),
  link(receivable, 'Receipt vouchers', 'receipts', 'receipts:read', {
    keywords: ['receipts'],
  }),
  link(receivable, 'Refunds', 'refunds', 'refunds:read'),
  ...views(receivable, 'receivables', [
    ['credit-profiles', 'Credit profiles', 'credit limits payment terms'],
    ['documents', 'Customer documents'],
    [
      'receipts-and-refunds',
      'Receipt allocation and refunds',
      'unallocated receipts',
    ],
    ['collections', 'Collections and reminders'],
    ['statements-and-aging', 'Customer statements and aging'],
    ['gl-approvals', 'Receivables GL approvals'],
  ]),
  ...documents(receivable, 'receivables', receivableDocuments, []),
  link(assets, 'Asset register', 'fixed-assets', foundation, {
    keywords: ['FIN-05', 'fixed assets'],
  }),
  ...documents(assets, 'fixed-assets', assetOperations, [
    'ACQUIRE',
    'TRANSFER',
    'DEPRECIATE',
  ]),
  ...views(assets, 'fixed-assets', [
    ['setup', 'Asset setup', 'categories groups locations'],
    ['review-and-history', 'Asset review and history'],
    ['depreciation', 'Depreciation calculator'],
    ['class-revaluation', 'Class revaluation'],
    ['reports', 'Asset reports'],
    ['gl-approvals', 'Asset GL approvals'],
  ]),
  link(cashBank, 'Cash and bank workspace', 'cash-bank', foundation, {
    keywords: ['FIN-06', 'cashbook'],
  }),
  ...CASH_BANK_MODULES.map(([code, label, area, action]) =>
    link(
      cashBank,
      label,
      'cash-bank?view=' +
        area.toLowerCase().replaceAll(' ', '-') +
        (action ? '&action=' + action : ''),
      foundation,
      {
        directoryOnly: true,
        keywords: ['FIN-06.' + code, area],
      },
    ),
  ),
  ...views(cashBank, 'cash-bank', [
    ['review-and-history', 'Cash and bank document review'],
    ['gl-approvals', 'Cash and bank GL approvals'],
  ]),
  link(
    other,
    'Payment reconciliation',
    'reconciliation',
    'reconciliation:read',
  ),
  link(other, 'Commission accruals', 'commission-accruals', 'commissions:read'),
  link(other, 'Commission payments', 'commission-payments', 'commissions:read'),
  link(other, 'Event monitoring', 'events', 'finance-events:read'),
  link(other, 'Reinsurance', '', 'reinsurance:read', {
    to: '/apps/reinsurance',
  }),
  ...documents(
    'Employee self-service',
    'my-expenses',
    {
      EXPENSE: 'My expense claim',
      IMPREST: 'My imprest request',
      RETIREMENT: 'Retire my imprest',
      BANK: 'My beneficiary bank account',
    },
    [],
    true,
  ),
];

export const financeDirectory: NavLeaf = link(
  '',
  'Finance directory',
  '',
  undefined,
  {
    to: '/apps/finance',
    keywords: ['modules', 'all finance tasks'],
    anyPermission: [
      ...new Set(
        financeDestinations.flatMap((item) =>
          item.permission ? [item.permission] : [],
        ),
      ),
    ],
  },
);

const bookWorkspaces = new Set(
  [
    '',
    'setup',
    'foundation',
    'general-ledger',
    'trial-balance',
    'journals',
    'payables',
    'receivables',
    'fixed-assets',
    'cash-bank',
  ].map((path) => (path ? '/apps/finance/' + path : '/apps/finance')),
);

/** Keep the selected accounting book when moving between book-scoped Finance pages. */
export function financeHref(to: string, pathname: string, search: string) {
  if (!search || !bookWorkspaces.has(pathname)) return to;
  const book = new URLSearchParams(search).get('book');
  const [path, query] = to.split('?');
  if (!book || !bookWorkspaces.has(path)) return to;
  const next = new URLSearchParams(query);
  if (!next.has('book')) next.set('book', book);
  return path + '?' + next;
}
