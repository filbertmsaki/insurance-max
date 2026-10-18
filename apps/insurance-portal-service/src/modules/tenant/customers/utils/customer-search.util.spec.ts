import { CUSTOMER_SEARCH_INDEX_EXPRESSION } from '../../../../database/migrations/1794600000000-WizardRecordSearch';
import {
  containsPattern,
  customerSearchDocumentSql,
  maskIdentifier,
  parseCustomerSearchTerm,
} from './customer-search.util';

describe('parseCustomerSearchTerm', () => {
  it('ignores terms shorter than two characters', () => {
    expect(parseCustomerSearchTerm('')).toBeNull();
    expect(parseCustomerSearchTerm(' a ')).toBeNull();
    expect(parseCustomerSearchTerm(undefined)).toBeNull();
  });

  it('matches every word of a full name', () => {
    expect(parseCustomerSearchTerm('  John   MWITA ')?.tokens).toEqual([
      ['john'],
      ['mwita'],
    ]);
  });

  it.each([
    ['0712 345 678'],
    ['+255 712 345 678'],
    ['255712345678'],
    ['(0712) 345-678'],
  ])('reduces the phone number %s to its significant digits', (term) => {
    const parsed = parseCustomerSearchTerm(term);
    expect(parsed?.phone).toBe('712345678');
    expect(parsed?.tokens).toEqual([['712345678']]);
  });

  it('accepts identifiers typed with or without separators', () => {
    const parsed = parseCustomerSearchTerm('19900101-12345-00001-12');
    // An all-digit ID is also tried as a phone suffix; the ID ranking uses
    // the compact form.
    expect(parsed?.compact).toBe('19900101123450000112');

    expect(parseCustomerSearchTerm('AB-12/34')?.tokens).toEqual([
      ['ab-12/34', 'ab1234'],
    ]);
  });

  it('keeps customer numbers searchable as typed', () => {
    const parsed = parseCustomerSearchTerm('CUST-2026-000001');
    expect(parsed?.tokens[0]).toContain('cust-2026-000001');
    expect(parsed?.exact).toBe('cust-2026-000001');
  });

  it('caps the number of words', () => {
    expect(parseCustomerSearchTerm('a b c d e f g')?.tokens).toHaveLength(5);
  });
});

describe('customer search helpers', () => {
  it('escapes LIKE wildcards typed by the user', () => {
    expect(containsPattern('50%_off')).toBe('%50\\%\\_off%');
  });

  it('masks all but the last four characters', () => {
    expect(maskIdentifier('19900101123450000112')).toBe('****************0112');
    expect(maskIdentifier('123')).toBe('****123');
    expect(maskIdentifier(null)).toBeNull();
  });

  it('matches the expression indexed by IDX_customers_search_trgm', () => {
    expect(
      customerSearchDocumentSql('customer').replace(/customer\./g, ''),
    ).toBe(CUSTOMER_SEARCH_INDEX_EXPRESSION);
  });

  it('builds the document from qualified columns', () => {
    const sql = customerSearchDocumentSql('customer');
    expect(sql.startsWith('lower(coalesce(customer.customer_no')).toBe(true);
    expect(sql).toContain(
      "regexp_replace(coalesce(customer.phone, ''), '[^0-9]', '', 'g')",
    );
    expect(sql).toContain(
      "regexp_replace(coalesce(customer.id_number, ''), '[^A-Za-z0-9]', '', 'g')",
    );
  });
});
