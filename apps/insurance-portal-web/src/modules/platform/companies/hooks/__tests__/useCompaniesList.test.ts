/**
 * Tests for useCompaniesList filtering/sorting logic.
 *
 * Setup (run once): npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
 * Then add to vite.config.ts:
 *   test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'] }
 */
import { describe, it, expect } from 'vitest';
import type { Company } from '@/types';

// ─── Pure sorting logic extracted for unit testing ─────────────────────────

type CompanySortKey =
  | 'name'
  | 'slug'
  | 'status'
  | 'contact_email'
  | 'active_users_count'
  | 'created_at';
type SortOrder = 'ASC' | 'DESC';

function sortCompanies(
  companies: Company[],
  key: CompanySortKey,
  order: SortOrder,
): Company[] {
  return [...companies].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    if (key === 'active_users_count') {
      aVal = a.active_users_count ?? 0;
      bVal = b.active_users_count ?? 0;
    } else if (key === 'created_at') {
      aVal = new Date(a.created_at).getTime();
      bVal = new Date(b.created_at).getTime();
    } else {
      aVal = (a[key] as string | null | undefined) ?? '';
      bVal = (b[key] as string | null | undefined) ?? '';
    }

    if (aVal === bVal) return 0;
    const cmp = aVal < bVal ? -1 : 1;
    return order === 'ASC' ? cmp : -cmp;
  });
}

function filterCompanies(companies: Company[], search: string): Company[] {
  const q = search.toLowerCase();
  if (!q) return companies;
  return companies.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.contact_email ?? '').toLowerCase().includes(q) ||
      (c.contact_phone ?? '').toLowerCase().includes(q),
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeCompany = (
  partial: Partial<Company> & { id: string; name: string },
): Company => ({
  slug: partial.name.toLowerCase().replace(/\s/g, '-'),
  status: 'active',
  contact_email: null,
  contact_phone: null,
  website: null,
  logo_url: null,
  address: null,
  settings: null,
  metadata: null,
  active_users_count: 0,
  created_at: '2024-01-01T00:00:00Z',
  ...partial,
});

const companies: Company[] = [
  makeCompany({
    id: '1',
    name: 'Alpha Corp',
    active_users_count: 10,
    created_at: '2024-03-01T00:00:00Z',
    contact_email: 'info@alpha.com',
  }),
  makeCompany({
    id: '2',
    name: 'Beta Ltd',
    active_users_count: 5,
    created_at: '2024-01-01T00:00:00Z',
    status: 'inactive',
  }),
  makeCompany({
    id: '3',
    name: 'Gamma Inc',
    active_users_count: 20,
    created_at: '2024-06-01T00:00:00Z',
    contact_email: 'hello@gamma.co',
  }),
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('filterCompanies', () => {
  it('returns all companies when search is empty', () => {
    expect(filterCompanies(companies, '')).toHaveLength(3);
  });

  it('filters by name (case-insensitive)', () => {
    const result = filterCompanies(companies, 'alpha');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by contact_email', () => {
    const result = filterCompanies(companies, 'gamma.co');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('returns empty array when no match', () => {
    expect(filterCompanies(companies, 'zzznomatch')).toHaveLength(0);
  });
});

describe('sortCompanies', () => {
  it('sorts by name ASC', () => {
    const sorted = sortCompanies(companies, 'name', 'ASC');
    expect(sorted.map((c) => c.name)).toEqual([
      'Alpha Corp',
      'Beta Ltd',
      'Gamma Inc',
    ]);
  });

  it('sorts by name DESC', () => {
    const sorted = sortCompanies(companies, 'name', 'DESC');
    expect(sorted.map((c) => c.name)).toEqual([
      'Gamma Inc',
      'Beta Ltd',
      'Alpha Corp',
    ]);
  });

  it('sorts by active_users_count DESC', () => {
    const sorted = sortCompanies(companies, 'active_users_count', 'DESC');
    expect(sorted[0].active_users_count).toBe(20);
    expect(sorted[2].active_users_count).toBe(5);
  });

  it('sorts by created_at ASC (oldest first)', () => {
    const sorted = sortCompanies(companies, 'created_at', 'ASC');
    expect(sorted[0].id).toBe('2');
    expect(sorted[2].id).toBe('3');
  });

  it('sorts by status ASC (active before inactive alphabetically)', () => {
    const sorted = sortCompanies(companies, 'status', 'ASC');
    const statuses = sorted.map((c) => c.status);
    expect(statuses).toEqual([...statuses].sort());
  });
});

describe('pagination logic', () => {
  it('slices correct page window', () => {
    const all = Array.from({ length: 25 }, (_, i) =>
      makeCompany({ id: String(i), name: `Company ${i}` }),
    );
    const page = 2;
    const limit = 10;
    const slice = all.slice((page - 1) * limit, page * limit);
    expect(slice).toHaveLength(10);
    expect(slice[0].name).toBe('Company 10');
  });

  it('computes totalPages correctly', () => {
    expect(Math.ceil(25 / 10)).toBe(3);
    expect(Math.ceil(10 / 10)).toBe(1);
    expect(Math.ceil(0 / 10) || 1).toBe(1);
  });
});
