import { ConflictException } from '@nestjs/common';
import type { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type { EntityManager } from 'typeorm';

import type { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { FinanceAccount } from '../entities/finance-account.entity';
import { FinanceJournalEntry } from '../entities/finance-journal-entry.entity';
import { FinanceJournalLine } from '../entities/finance-journal-line.entity';
import type { Invoice } from '../entities/invoice.entity';
import type { Receipt } from '../entities/receipt.entity';
import { FinanceJournalService } from './finance-journal.service';

// B02 characterizes current legacy behavior. These fixtures do not approve
// recognition, tax, functional currency or account-mapping policies. Repository
// doubles cannot establish database atomicity, concurrent uniqueness or bank cash.
function journalHarness() {
  const invoice = Object.freeze({
    id: 'invoice-a',
    company_id: 'company-a',
    invoice_no: 'INV-FIXTURE',
    customer_id: 'customer-a',
    currency: 'USD',
    total_amount: '110',
    gross_amount: '100',
    tax_amount: '10',
  }) as Invoice;
  const receipt = Object.freeze({
    id: 'receipt-a',
    company_id: 'company-a',
    receipt_no: 'RCT-FIXTURE',
    customer_id: 'customer-a',
    currency: 'USD',
    amount: '25.125',
  }) as Receipt;

  const existingAccounts = new Map<string, FinanceAccount>();
  for (const companyId of ['company-a', 'company-b']) {
    for (const accountCode of ['1100', '1200', '4100', '4200']) {
      existingAccounts.set(
        `${companyId}:${accountCode}`,
        Object.freeze({
          id: `${companyId}:${accountCode}`,
          company_id: companyId,
          account_code: accountCode,
          is_active: true,
          account_type:
            accountCode === '4100'
              ? 'INCOME'
              : accountCode === '4200'
                ? 'LIABILITY'
                : 'ASSET',
        }) as FinanceAccount,
      );
    }
  }

  let nextEntry = 0;
  const entries = {
    findOne: jest.fn(
      async (_query: unknown): Promise<FinanceJournalEntry | null> => null,
    ),
    save: jest.fn(
      async (entry: Partial<FinanceJournalEntry>) =>
        ({
          ...entry,
          id: `journal-${++nextEntry}`,
        }) as FinanceJournalEntry,
    ),
  };
  const lines = {
    create: jest.fn(
      (line: Partial<FinanceJournalLine>) => line as FinanceJournalLine,
    ),
    save: jest.fn(async (line: FinanceJournalLine) => line),
  };
  const accounts = {
    findOne: jest.fn(
      async (query: {
        where: { company_id: string; account_code: string };
      }) => {
        const key = `${query.where.company_id}:${query.where.account_code}`;
        const account = existingAccounts.get(key);
        if (!account) throw new Error(`Unexpected fixture account ${key}`);
        return account;
      },
    ),
    create: jest.fn(),
    save: jest.fn(),
  };
  const getRepository = jest.fn((entity: unknown) => {
    if (entity === FinanceJournalEntry) return entries;
    if (entity === FinanceJournalLine) return lines;
    if (entity === FinanceAccount) return accounts;
    throw new Error('Unexpected journal repository');
  });
  const manager = { getRepository } as unknown as EntityManager;
  const generateRequestId = jest.fn(
    async (_companyId: string, _manager: EntityManager) => 'JRN-FIXTURE',
  );
  const hashDefinition = jest.fn(
    (_definition: Record<string, unknown>) => 'fixture-hash',
  );
  const service = new FinanceJournalService(
    { generateRequestId } as unknown as IdentifierGeneratorService,
    { hashDefinition } as unknown as ProductDefinitionHashService,
    // Synthetic posting-vector fixture only; real policy eligibility is tested separately.
    { requireEligible: async () => undefined },
  );

  return {
    service,
    manager,
    invoice,
    receipt,
    entries,
    lines,
    accounts,
    getRepository,
    generateRequestId,
    hashDefinition,
  };
}

function savedLines(harness: ReturnType<typeof journalHarness>) {
  return harness.lines.save.mock.calls.map(([line]) => line);
}

describe('FinanceJournalService legacy characterization (B02)', () => {
  let h: ReturnType<typeof journalHarness>;

  beforeEach(() => {
    h = journalHarness();
  });

  afterEach(() => {
    jest.useRealTimers();
    // Every case uses pre-existing synthetic accounts, never auto-provisioning.
    expect(h.accounts.create).not.toHaveBeenCalled();
    expect(h.accounts.save).not.toHaveBeenCalled();
  });

  it('FC01 records the legacy invoice vector and source metadata', async () => {
    const result = await h.service.postInvoice(
      h.manager,
      h.invoice,
      'invoice-event',
      'actor-a',
    );

    expect(result.id).toBe('journal-1');
    expect(h.entries.save).toHaveBeenCalledTimes(1);
    expect(h.entries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'company-a',
        source_type: 'INVOICE',
        source_id: 'invoice-a',
        source_event_id: 'invoice-event',
        currency_code: 'USD',
        posted_by: 'actor-a',
      }),
    );
    expect(savedLines(h)).toEqual([
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:1200',
        customer_id: 'customer-a',
        intermediary_company_id: null,
        description: null,
        debit: '110.0000',
        credit: '0.0000',
      },
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:4100',
        customer_id: null,
        intermediary_company_id: null,
        description: null,
        debit: '0.0000',
        credit: '100.0000',
      },
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:4200',
        customer_id: null,
        intermediary_company_id: null,
        description: null,
        debit: '0.0000',
        credit: '10.0000',
      },
    ]);
  });

  it('FC02 records the inverse invoice vector with a separate reversal event and reason', async () => {
    const original = { ...h.invoice };
    await h.service.reverseInvoice(
      h.manager,
      h.invoice,
      'invoice-reversal-event',
      'actor-b',
      'fixture correction',
    );

    expect(h.invoice).toEqual(original);
    expect(h.entries.save).toHaveBeenCalledTimes(1);
    expect(h.entries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: 'WRITE_OFF',
        source_id: 'invoice-a',
        source_event_id: 'invoice-reversal-event',
        description: 'Invoice INV-FIXTURE reversed: fixture correction',
        posted_by: 'actor-b',
      }),
    );
    expect(savedLines(h)).toEqual([
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:4100',
        customer_id: null,
        intermediary_company_id: null,
        description: null,
        debit: '100.0000',
        credit: '0.0000',
      },
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:4200',
        customer_id: null,
        intermediary_company_id: null,
        description: null,
        debit: '10.0000',
        credit: '0.0000',
      },
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:1200',
        customer_id: 'customer-a',
        intermediary_company_id: null,
        description: null,
        debit: '0.0000',
        credit: '110.0000',
      },
    ]);
  });

  it('FC03 records the legacy receipt vector with four-decimal legs', async () => {
    await h.service.postReceipt(
      h.manager,
      h.receipt,
      'receipt-event',
      'actor-a',
    );

    expect(h.entries.save).toHaveBeenCalledTimes(1);
    expect(h.entries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'company-a',
        source_type: 'RECEIPT',
        source_id: 'receipt-a',
        source_event_id: 'receipt-event',
        currency_code: 'USD',
      }),
    );
    expect(savedLines(h)).toEqual([
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:1100',
        customer_id: null,
        intermediary_company_id: null,
        description: null,
        debit: '25.1250',
        credit: '0.0000',
      },
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:1200',
        customer_id: 'customer-a',
        intermediary_company_id: null,
        description: null,
        debit: '0.0000',
        credit: '25.1250',
      },
    ]);
  });

  it('FC04 records the inverse receipt vector without mutating the input', async () => {
    const original = { ...h.receipt };
    await h.service.reverseReceipt(
      h.manager,
      h.receipt,
      'receipt-reversal-event',
      'actor-b',
      'fixture correction',
    );

    expect(h.receipt).toEqual(original);
    expect(h.entries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: 'RECEIPT_REVERSAL',
        source_id: 'receipt-a',
        source_event_id: 'receipt-reversal-event',
        description: 'Receipt RCT-FIXTURE reversed: fixture correction',
      }),
    );
    expect(savedLines(h)).toEqual([
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:1200',
        customer_id: 'customer-a',
        intermediary_company_id: null,
        description: null,
        debit: '25.1250',
        credit: '0.0000',
      },
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:1100',
        customer_id: null,
        intermediary_company_id: null,
        description: null,
        debit: '0.0000',
        credit: '25.1250',
      },
    ]);
  });

  it('FC05 verifies a sequential duplicate fingerprint without identifiers or writes', async () => {
    const existing = Object.freeze({
      id: 'existing-journal',
      company_id: 'company-a',
      source_type: 'RECEIPT',
      source_event_id: 'same-event',
      source_id: h.receipt.id,
      currency_code: h.receipt.currency,
      entry_hash: 'fixture-hash',
    }) as FinanceJournalEntry;
    h.entries.findOne.mockResolvedValueOnce(existing);

    expect(
      await h.service.postReceipt(
        h.manager,
        h.receipt,
        'same-event',
        'actor-a',
      ),
    ).toBe(existing);
    expect(h.entries.findOne).toHaveBeenCalledTimes(1);
    expect(h.entries.findOne).toHaveBeenCalledWith({
      where: {
        company_id: 'company-a',
        source_type: 'RECEIPT',
        source_event_id: 'same-event',
      },
    });
    expect(h.generateRequestId).not.toHaveBeenCalled();
    expect(h.hashDefinition).toHaveBeenCalledTimes(1);
    expect(h.entries.save).not.toHaveBeenCalled();
    expect(h.lines.create).not.toHaveBeenCalled();
    expect(h.lines.save).not.toHaveBeenCalled();
    expect(h.accounts.findOne).not.toHaveBeenCalled();
  });

  it('FC06 retains each supplied company in source lookups and journal payloads', async () => {
    // Argument propagation only; this is not an authorization/isolation test.
    await h.service.postReceipt(h.manager, h.receipt, 'same-event', 'actor-a');
    await h.service.postReceipt(
      h.manager,
      { ...h.receipt, company_id: 'company-b' },
      'same-event',
      'actor-a',
    );

    expect(h.entries.findOne.mock.calls).toEqual([
      [
        {
          where: {
            company_id: 'company-a',
            source_type: 'RECEIPT',
            source_event_id: 'same-event',
          },
        },
      ],
      [
        {
          where: {
            company_id: 'company-b',
            source_type: 'RECEIPT',
            source_event_id: 'same-event',
          },
        },
      ],
    ]);
    expect(
      h.entries.save.mock.calls.map(([entry]) => entry.company_id),
    ).toEqual(['company-a', 'company-b']);
    expect(h.generateRequestId.mock.calls).toEqual([
      ['company-a', h.manager],
      ['company-b', h.manager],
    ]);
    expect(savedLines(h).map((line) => line.account_id)).toEqual([
      'company-a:1100',
      'company-a:1200',
      'company-b:1100',
      'company-b:1200',
    ]);
  });

  it('FC07 distinguishes invoice and receipt source types for the same event key', async () => {
    // This legacy lookup distinction does not approve duplicate economic effects.
    await h.service.postInvoice(h.manager, h.invoice, 'same-event', 'actor-a');
    await h.service.postReceipt(h.manager, h.receipt, 'same-event', 'actor-a');

    expect(h.entries.findOne.mock.calls).toEqual([
      [
        {
          where: {
            company_id: 'company-a',
            source_type: 'INVOICE',
            source_event_id: 'same-event',
          },
        },
      ],
      [
        {
          where: {
            company_id: 'company-a',
            source_type: 'RECEIPT',
            source_event_id: 'same-event',
          },
        },
      ],
    ]);
    expect(
      h.entries.save.mock.calls.map(([entry]) => [
        entry.source_type,
        entry.source_id,
        entry.source_event_id,
      ]),
    ).toEqual([
      ['INVOICE', 'invoice-a', 'same-event'],
      ['RECEIPT', 'receipt-a', 'same-event'],
    ]);
    expect(
      savedLines(h).map((line) => [
        line.journal_entry_id,
        line.account_id,
        line.debit,
        line.credit,
      ]),
    ).toEqual([
      ['journal-1', 'company-a:1200', '110.0000', '0.0000'],
      ['journal-1', 'company-a:4100', '0.0000', '100.0000'],
      ['journal-1', 'company-a:4200', '0.0000', '10.0000'],
      ['journal-2', 'company-a:1100', '25.1250', '0.0000'],
      ['journal-2', 'company-a:1200', '0.0000', '25.1250'],
    ]);
  });

  it('FC08 rejects an unbalanced invoice before generating an identifier or saving', async () => {
    const result = h.service.postInvoice(
      h.manager,
      { ...h.invoice, total_amount: '111' },
      'unbalanced-event',
      'actor-a',
    );

    await expect(result).rejects.toBeInstanceOf(ConflictException);
    await expect(result).rejects.toMatchObject({
      response: { code: 'UNBALANCED_FINANCE_JOURNAL' },
    });
    expect(h.generateRequestId).not.toHaveBeenCalled();
    expect(h.hashDefinition).not.toHaveBeenCalled();
    expect(h.entries.save).not.toHaveBeenCalled();
    expect(h.lines.create).not.toHaveBeenCalled();
    expect(h.lines.save).not.toHaveBeenCalled();
    expect(h.accounts.findOne).not.toHaveBeenCalled();
  });

  it('FC09 supplies literal four-decimal account and party legs to the hash dependency', async () => {
    await h.service.postReceipt(
      h.manager,
      h.receipt,
      'receipt-event',
      'actor-a',
    );

    expect(h.hashDefinition).toHaveBeenCalledTimes(1);
    expect(h.hashDefinition).toHaveBeenCalledWith([
      {
        accountCode: '1100',
        debit: '25.1250',
        credit: '0.0000',
        customerId: null,
        intermediaryCompanyId: null,
      },
      {
        accountCode: '1200',
        debit: '0.0000',
        credit: '25.1250',
        customerId: 'customer-a',
        intermediaryCompanyId: null,
      },
    ]);
    expect(h.entries.save).toHaveBeenCalledWith(
      expect.objectContaining({ entry_hash: 'fixture-hash' }),
    );
  });

  it('FC10 records the legacy UTC date and the supplied source, actor and currency', async () => {
    // Already the next local day in Dar es Salaam; no book-date policy elected.
    const instant = new Date('2026-11-15T22:30:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(instant);

    await h.service.postReceipt(
      h.manager,
      h.receipt,
      'clock-event',
      'actor-clock',
    );

    expect(h.entries.save).toHaveBeenCalledTimes(1);
    expect(h.entries.save).toHaveBeenCalledWith({
      company_id: 'company-a',
      journal_no: 'JRN-FIXTURE',
      journal_date: '2026-11-15',
      source_type: 'RECEIPT',
      source_id: 'receipt-a',
      source_event_id: 'clock-event',
      description: 'Receipt RCT-FIXTURE posted',
      currency_code: 'USD',
      posted_by: 'actor-clock',
      posted_at: instant,
      entry_hash: 'fixture-hash',
    });
  });

  it('FC11 propagates a later line save failure after the attempted entry and first line', async () => {
    const failure = new Error('second fixture line failed');
    h.lines.save
      .mockImplementationOnce(async (line) => line)
      .mockRejectedValueOnce(failure);

    await expect(
      h.service.postReceipt(
        h.manager,
        h.receipt,
        'line-failure-event',
        'actor-a',
      ),
    ).rejects.toBe(failure);
    expect(h.entries.save).toHaveBeenCalledTimes(1);
    expect(h.lines.create).toHaveBeenCalledTimes(2);
    expect(h.lines.save).toHaveBeenCalledTimes(2);
    expect(h.entries.save.mock.invocationCallOrder[0]).toBeLessThan(
      h.lines.save.mock.invocationCallOrder[0],
    );
    expect(savedLines(h)).toEqual([
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:1100',
        customer_id: null,
        intermediary_company_id: null,
        description: null,
        debit: '25.1250',
        credit: '0.0000',
      },
      {
        journal_entry_id: 'journal-1',
        account_id: 'company-a:1200',
        customer_id: 'customer-a',
        intermediary_company_id: null,
        description: null,
        debit: '0.0000',
        credit: '25.1250',
      },
    ]);
    // Attempts in doubles are not persisted rows or evidence of a DB rollback.
  });

  it('FC12 propagates identifier failure without hashing or entry and line saves', async () => {
    const failure = new Error('fixture identifier unavailable');
    h.generateRequestId.mockRejectedValueOnce(failure);

    await expect(
      h.service.postReceipt(
        h.manager,
        h.receipt,
        'identifier-failure-event',
        'actor-a',
      ),
    ).rejects.toBe(failure);
    expect(h.generateRequestId).toHaveBeenCalledTimes(1);
    expect(h.generateRequestId).toHaveBeenCalledWith('company-a', h.manager);
    expect(h.hashDefinition).not.toHaveBeenCalled();
    expect(h.entries.save).not.toHaveBeenCalled();
    expect(h.lines.create).not.toHaveBeenCalled();
    expect(h.lines.save).not.toHaveBeenCalled();
    expect(h.accounts.findOne).not.toHaveBeenCalled();
  });
  it.each([
    { source_id: 'other' },
    { currency_code: 'TZS' },
    { entry_hash: 'changed-vector' },
  ])(
    'FC13 rejects source-event reuse with changed fingerprint %p',
    async (patch) => {
      h.entries.findOne.mockResolvedValueOnce({
        source_id: h.receipt.id,
        currency_code: h.receipt.currency,
        entry_hash: 'fixture-hash',
        ...patch,
      } as FinanceJournalEntry);
      await expect(
        h.service.postReceipt(h.manager, h.receipt, 'same-event', 'actor-a'),
      ).rejects.toMatchObject({
        response: { code: 'FINANCE_JOURNAL_SOURCE_CONFLICT' },
      });
      expect(h.entries.save).not.toHaveBeenCalled();
      expect(h.lines.save).not.toHaveBeenCalled();
    },
  );
  it.each(['0.00005', 'NaN', '-1', '10000000000000000'])(
    'FC14 rejects nonrepresentable journal amount %s before writing',
    async (amount) => {
      await expect(
        h.service.postReceipt(
          h.manager,
          { ...h.receipt, amount },
          'bad-amount',
          'actor-a',
        ),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_FINANCE_JOURNAL_AMOUNT' },
      });
      expect(h.entries.save).not.toHaveBeenCalled();
      expect(h.lines.save).not.toHaveBeenCalled();
    },
  );
});
