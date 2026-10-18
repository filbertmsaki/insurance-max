import { escapeLike } from '@insurance-max/portal-shared/utils/paginate-query.util';

export const CUSTOMER_SEARCH_MIN_LENGTH = 2;
export const CUSTOMER_SEARCH_MAX_TOKENS = 5;

/** Significant digits of a Tanzanian number once the 0 / 255 prefix is dropped. */
const PHONE_SIGNIFICANT_DIGITS = 9;
const PHONE_MIN_DIGITS = 6;

const NAME_COLUMNS = [
  'customer_no',
  'display_name',
  'first_name',
  'middle_name',
  'last_name',
  'company_name',
] as const;

const IDENTIFIER_COLUMNS = [
  'id_number',
  'nida_no',
  'passport_no',
  'driving_license_no',
  'voter_no',
  'zanid_no',
  'tin',
  'registration_no',
] as const;

const PHONE_COLUMNS = ['phone', 'alternate_phone'] as const;

/**
 * One lower-cased text per customer holding its names, identifiers (without
 * separators) and phone digits, so a single term can match any of them.
 *
 * Keep this expression identical to the one indexed by
 * `IDX_customers_search_trgm` (migration 1794600000000); PostgreSQL only uses
 * the trigram index when the query expression matches it exactly.
 */
export function customerSearchDocumentSql(alias: string): string {
  const text = (column: string) => `coalesce(${alias}.${column}, '')`;
  const parts = [
    ...NAME_COLUMNS.map(text),
    ...IDENTIFIER_COLUMNS.map(
      (column) => `regexp_replace(${text(column)}, '[^A-Za-z0-9]', '', 'g')`,
    ),
    ...PHONE_COLUMNS.map(
      (column) => `regexp_replace(${text(column)}, '[^0-9]', '', 'g')`,
    ),
  ];
  return `lower(${parts.join(` || ' ' || `)})`;
}

export interface CustomerSearchTerms {
  /** Every token must match; each token lists its accepted spellings. */
  tokens: string[][];
  /** Lower-cased term, for exact customer-number ranking. */
  exact: string;
  /** Upper-cased term without separators, for exact ID ranking. */
  compact: string;
  /** Significant phone digits when the term is a phone number. */
  phone: string | null;
  /** First token, for "name starts with" ranking. */
  prefix: string;
}

function compactIdentifier(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '');
}

function phoneDigits(term: string): string | null {
  const stripped = term.replace(/[\s()+.-]/g, '');
  if (!/^\d+$/.test(stripped) || stripped.length < PHONE_MIN_DIGITS) {
    return null;
  }
  return stripped.slice(-PHONE_SIGNIFICANT_DIGITS);
}

/**
 * Parses the single wizard search box ("name, phone or ID number").
 * Returns null when the term is too short to search.
 */
export function parseCustomerSearchTerm(
  raw: string | null | undefined,
): CustomerSearchTerms | null {
  const term = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (term.length < CUSTOMER_SEARCH_MIN_LENGTH) return null;

  const lower = term.toLowerCase();
  const phone = phoneDigits(term);
  const tokens = phone
    ? [[phone]]
    : lower
        .split(' ')
        .slice(0, CUSTOMER_SEARCH_MAX_TOKENS)
        .map((token) => {
          const compact = compactIdentifier(token);
          return compact && compact !== token ? [token, compact] : [token];
        });

  return {
    tokens,
    exact: lower,
    compact: compactIdentifier(term).toUpperCase(),
    phone,
    prefix: lower.split(' ')[0],
  };
}

/** `%value%` with LIKE wildcards in the user's input escaped. */
export function containsPattern(value: string): string {
  return `%${escapeLike(value)}%`;
}

/** `value%` with LIKE wildcards in the user's input escaped. */
export function prefixPattern(value: string): string {
  return `${escapeLike(value)}%`;
}

/** Keeps the last four characters, as on the customer detail page. */
export function maskIdentifier(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const suffix = value.slice(-4);
  return `${'*'.repeat(Math.max(4, value.length - 4))}${suffix}`;
}
