import { ConflictException } from '@nestjs/common';
import { RatingRuleMatcherService } from './rating-rule-matcher.service';
import { PricingRateBookStatus } from '../../pricing-rate-books/enums/pricing-rate-book-status.enum';

const COMPANY_ID = 'company-1';
const RISK_ID = 'risk-1';
const PRODUCT_ID = 'product-1';

function passthroughCache() {
  return {
    getActiveRules: jest.fn(
      (
        _c: unknown,
        _r: unknown,
        _d: unknown,
        _cur: unknown,
        loader: () => unknown,
      ) => loader(),
    ),
  };
}

function rateBook(overrides: Record<string, unknown>) {
  return {
    id: 'rate-book',
    company_id: COMPANY_ID,
    product_id: PRODUCT_ID,
    status: PricingRateBookStatus.PUBLISHED,
    currency_code: null,
    effective_from: '2026-01-01',
    effective_to: null,
    ...overrides,
  };
}

function rule(overrides: Record<string, unknown>) {
  return {
    id: 'rule',
    company_id: COMPANY_ID,
    risk_id: RISK_ID,
    is_active: true,
    priority: 1,
    conditions: [],
    ...overrides,
  };
}

function createServiceFixture(options: {
  rateBooks: Record<string, unknown>[];
  rulesByRateBook: Record<string, Record<string, unknown>[]>;
}) {
  const riskRepository = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: RISK_ID, company_id: COMPANY_ID, product_id: PRODUCT_ID }),
  };
  const rateBookRepository = {
    find: jest.fn().mockResolvedValue(options.rateBooks),
  };
  const ruleRepository = {
    find: jest.fn().mockImplementation(({ where }) => {
      const rateBookId = where.rate_book_id;
      if (typeof rateBookId === 'string') {
        return Promise.resolve(options.rulesByRateBook[rateBookId] ?? []);
      }
      // rate_book_id: IsNull() (legacy, non-versioned rules) resolves here.
      return Promise.resolve(options.rulesByRateBook['LEGACY'] ?? []);
    }),
  };

  const service = new RatingRuleMatcherService(
    ruleRepository as any,
    riskRepository as any,
    rateBookRepository as any,
    passthroughCache() as any,
  );

  return { service };
}

describe('RatingRuleMatcherService — rate book currency scoping', () => {
  it('resolves the TZS rate book when two currency-specific published books overlap for the same product/date', async () => {
    const tzsBook = rateBook({ id: 'book-tzs', currency_code: 'TZS', version: '2026.1' });
    const usdBook = rateBook({ id: 'book-usd', currency_code: 'USD', version: '2026.1-usd' });

    const { service } = createServiceFixture({
      rateBooks: [tzsBook, usdBook],
      rulesByRateBook: {
        'book-tzs': [rule({ id: 'rule-tzs', rate_book_id: 'book-tzs' })],
        'book-usd': [rule({ id: 'rule-usd', rate_book_id: 'book-usd' })],
      },
    });

    const rules = await service.findActiveRules(
      COMPANY_ID,
      RISK_ID,
      '2026-06-01',
      'TZS',
    );

    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('rule-tzs');
  });

  it('resolves the USD rate book when queried with USD, from the same overlapping pair', async () => {
    const tzsBook = rateBook({ id: 'book-tzs', currency_code: 'TZS', version: '2026.1' });
    const usdBook = rateBook({ id: 'book-usd', currency_code: 'USD', version: '2026.1-usd' });

    const { service } = createServiceFixture({
      rateBooks: [tzsBook, usdBook],
      rulesByRateBook: {
        'book-tzs': [rule({ id: 'rule-tzs', rate_book_id: 'book-tzs' })],
        'book-usd': [rule({ id: 'rule-usd', rate_book_id: 'book-usd' })],
      },
    });

    const rules = await service.findActiveRules(
      COMPANY_ID,
      RISK_ID,
      '2026-06-01',
      'USD',
    );

    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('rule-usd');
  });

  it('still throws MULTIPLE_EFFECTIVE_RATE_BOOKS when two books for the SAME currency genuinely overlap', async () => {
    const bookA = rateBook({ id: 'book-a', currency_code: 'TZS', version: '2026.1' });
    const bookB = rateBook({ id: 'book-b', currency_code: 'TZS', version: '2026.2' });

    const { service } = createServiceFixture({
      rateBooks: [bookA, bookB],
      rulesByRateBook: {},
    });

    await expect(
      service.findActiveRules(COMPANY_ID, RISK_ID, '2026-06-01', 'TZS'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('still throws MULTIPLE_EFFECTIVE_RATE_BOOKS when a currency-agnostic book overlaps a currency-specific one', async () => {
    const genericBook = rateBook({ id: 'book-generic', currency_code: null, version: '2026.1' });
    const tzsBook = rateBook({ id: 'book-tzs', currency_code: 'TZS', version: '2026.2' });

    const { service } = createServiceFixture({
      rateBooks: [genericBook, tzsBook],
      rulesByRateBook: {},
    });

    await expect(
      service.findActiveRules(COMPANY_ID, RISK_ID, '2026-06-01', 'TZS'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
