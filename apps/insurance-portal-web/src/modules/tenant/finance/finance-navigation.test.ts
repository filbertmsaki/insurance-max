import { expect, it } from 'vitest';
import {
  financeDestinations,
  financeDirectory,
  financeHref,
} from './finance-navigation';
import { findFinanceLinks } from './finance-search';
import { user } from './foundation/__tests__/fixtures';
import { names as ap } from './payables/ap-model';
import { names as ar } from './receivables/customer-account-model';
import { operations } from './assets/asset-model';

it('keeps each existing finance destination and indexes every document form once', () => {
  const links = [financeDirectory, ...financeDestinations].map(
    (entry) => entry.to,
  );
  expect(new Set(links).size).toBe(links.length);
  for (const path of [
    'fixed-assets',
    'cash-bank',
    'receivables',
    'payables',
    'my-expenses',
    'foundation',
    'setup',
    'dashboard',
    'invoices',
    'payments',
    'receipts',
    'refunds',
    'reconciliation',
    'commission-accruals',
    'commission-payments',
    'journals',
    'events',
  ]) {
    expect(links).toContain('/apps/finance/' + path);
  }
  expect(links).toContain('/apps/reinsurance');
  for (const [module, kinds] of [
    ['payables', ap],
    ['receivables', ar],
    ['fixed-assets', operations],
  ] as const) {
    for (const kind of Object.keys(kinds))
      expect(links).toContain(
        '/apps/finance/' + module + '?view=new-document&action=' + kind,
      );
  }
});

it('offers the same authorized destinations by task, module or old menu name', () => {
  const reader = { ...user, permissions: ['finance-foundation:read'] };
  expect(
    findFinanceLinks(reader, 'trial balance').map((leaf) => leaf.to),
  ).toEqual(['/apps/finance/trial-balance']);
  expect(findFinanceLinks(reader, 'credit profiles')[0].to).toBe(
    '/apps/finance/receivables?view=credit-profiles',
  );
  expect(findFinanceLinks(reader, 'supplier invoice')).toEqual([]);
  const preparer = {
    ...reader,
    permissions: [...reader.permissions, 'finance-foundation:prepare'],
  };
  expect(
    findFinanceLinks(preparer, 'supplier invoice').some((leaf) =>
      leaf.to.endsWith('action=BILL'),
    ),
  ).toBe(true);
  expect(
    findFinanceLinks({ ...user, permissions: [] }, '').every((leaf) =>
      leaf.to.startsWith('/apps/finance/my-expenses'),
    ),
  ).toBe(true);
  expect(
    findFinanceLinks({ ...reader, scope: 'platform' }, 'trial balance'),
  ).toEqual([]);
  expect(
    findFinanceLinks(
      { ...user, permissions: ['invoices:create-manual'] },
      'manual invoice',
    ).map((leaf) => leaf.to),
  ).toEqual(['/apps/finance/invoices/new']);
});

it('carries a book to a finance task while respecting an explicit destination book', () => {
  const source = '/apps/finance';
  expect(
    financeHref(
      source + '/payables?view=new-document&action=BILL',
      source,
      '?book=second',
    ),
  ).toBe(source + '/payables?view=new-document&action=BILL&book=second');
  expect(
    financeHref(source + '/trial-balance?book=first', source, '?book=second'),
  ).toBe(source + '/trial-balance?book=first');
  expect(financeHref(source + '/invoices', source, '?book=second')).toBe(
    source + '/invoices',
  );
});

it('finds an authorized destination for every FIN-01 through FIN-06 submodule code', () => {
  const permissions = [
    ...new Set(
      financeDestinations.flatMap((leaf) =>
        [
          leaf.permission,
          ...(leaf.anyPermission ?? []),
          ...(leaf.anyPermissionGroups?.flat() ?? []),
        ].filter((p): p is string => !!p),
      ),
    ),
  ];
  for (const [module, count] of [
    [1, 16],
    [2, 16],
    [3, 20],
    [4, 20],
    [5, 19],
    [6, 20],
  ]) {
    for (let i = 1; i <= count; i++) {
      const code = 'FIN-0' + module + '.' + String(i).padStart(2, '0');
      expect(
        findFinanceLinks({ ...user, permissions }, code).length,
        code,
      ).toBeGreaterThan(0);
    }
  }
});
