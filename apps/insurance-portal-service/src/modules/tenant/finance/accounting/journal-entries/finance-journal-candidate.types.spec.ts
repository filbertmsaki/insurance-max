import {
  candidateAmount,
  normalizeJournalCandidate,
  type JournalCandidateInput,
} from './finance-journal-candidate.types';

const candidate = (): JournalCandidateInput => ({
  schema: 'FINANCE_JOURNAL_CANDIDATE_V1',
  periodId: '10000000-0000-4000-8000-000000000001',
  periodRevision: 2,
  accountingDate: '2026-11-15',
  chartReleaseId: '20000000-0000-4000-8000-000000000001',
  chartReleaseHash: 'a'.repeat(64),
  currency: 'USD',
  decimalScale: 3,
  economicOrigin: 'SYNTHETIC',
  economicSourceId: 'fixture-1',
  economicComponent: 'CASH',
  sourceRevision: '1',
  correctionOf: null,
  lines: [
    {
      lineKey: 'DR',
      roleCode: 'BANK',
      debit: '25.125',
      credit: '0',
      dimensions: { CURRENCY: 'USD' },
    },
    {
      lineKey: 'CR',
      roleCode: 'CLEARING',
      debit: '0',
      credit: '25.125',
      dimensions: { CURRENCY: 'USD' },
    },
  ],
});
describe('Exact inactive journal candidate values', () => {
  it('normalizes without floating point or rounding and detaches the complete input', () => {
    const original = candidate(),
      normalized = normalizeJournalCandidate(original);
    expect(normalized.lines.map((l) => [l.debit, l.credit])).toEqual([
      ['0.000000000000', '25.125000000000'],
      ['25.125000000000', '0.000000000000'],
    ]);
    original.lines[0].dimensions.CURRENCY = 'EUR';
    expect(normalized.lines[1].dimensions.CURRENCY).toBe('USD');
    expect(normalizeJournalCandidate(normalized)).toEqual(normalized);
  });
  it('preserves the numeric(38,12) maximum and smallest unit independently', () => {
    expect(
      candidateAmount('99999999999999999999999999.999999999999', 12),
    ).toEqual({
      units: 99999999999999999999999999999999999999n,
      stored: '99999999999999999999999999.999999999999',
    });
    expect(candidateAmount('0.000000000001', 12).units).toBe(1n);
  });
  it.each([
    'NaN',
    'Infinity',
    '1e3',
    '-1',
    '-0',
    '+1',
    '.1',
    '01',
    ' 1',
    '1 ',
    '1.',
    '0.0000000000001',
    '100000000000000000000000000',
  ])('rejects unsafe decimal %s', (amount) => {
    expect(() => candidateAmount(amount, 12)).toThrow();
  });
  it.each([1, NaN, Infinity, null, undefined])(
    'rejects non-string amount %s',
    (amount) => {
      expect(() => candidateAmount(amount, 12)).toThrow();
    },
  );
  it.each([
    [
      'unbalanced',
      (p: JournalCandidateInput) => {
        p.lines[1].credit = '25.126';
      },
    ],
    [
      'rounding',
      (p: JournalCandidateInput) => {
        p.lines[0].debit = '25.1251';
      },
    ],
    [
      'two positive sides',
      (p: JournalCandidateInput) => {
        p.lines[0].credit = '1';
      },
    ],
    [
      'zero line',
      (p: JournalCandidateInput) => {
        p.lines[0].debit = '0';
      },
    ],
    [
      'duplicate line key',
      (p: JournalCandidateInput) => {
        p.lines[0].lineKey = 'CR';
      },
    ],
    [
      'empty dimension',
      (p: JournalCandidateInput) => {
        p.lines[0].dimensions.CURRENCY = '';
      },
    ],
    [
      'bad date',
      (p: JournalCandidateInput) => {
        p.accountingDate = '2026-02-30';
      },
    ],
    [
      'unapproved default scale',
      (p: JournalCandidateInput) => {
        p.decimalScale = -1;
      },
    ],
    [
      'out-of-capacity scale',
      (p: JournalCandidateInput) => {
        p.decimalScale = 13;
      },
    ],
    [
      'implicit period',
      (p: JournalCandidateInput) => {
        p.periodId = '';
      },
    ],
    [
      'zero revision',
      (p: JournalCandidateInput) => {
        p.periodRevision = 0;
      },
    ],
    [
      'unsupported FX envelope',
      (p: JournalCandidateInput) => {
        Object.assign(p, { exchangeRate: '1' });
      },
    ],
  ])('rejects %s', (_name, mutate) => {
    const p = candidate();
    mutate(p);
    expect(() => normalizeJournalCandidate(p)).toThrow();
  });
});
