import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { IdentifierGeneratorService } from './identifier-generator.service';
import { Company } from '../../platform/companies/entities/company.entity';

describe('IdentifierGeneratorService', () => {
  function createCompany(overrides?: Partial<Company>): Company {
    return {
      id: 'company-1',
      name: 'Alliance Insurance Corporation',
      identifier_prefix: 'AICL',
      tira_company_code: 'ICC739',
      tira_insurer_company_code: 'ICC739',
      ...overrides,
    } as Company;
  }

  function createFixture(options?: {
    company?: Company;
    /** Sequence of `current_value` results returned by successive incrementSequence calls. */
    sequenceValues?: number[];
    /** If provided, insertGeneratedIdentifier throws this on these 0-based call indexes, then succeeds. */
    duplicateOnAttempts?: number[];
  }) {
    const company = options?.company ?? createCompany();
    let sequenceCallIndex = 0;
    const sequenceValues = options?.sequenceValues ?? [1];
    let insertCallIndex = 0;
    const duplicateOnAttempts = new Set(options?.duplicateOnAttempts ?? []);

    const companyRepository = {
      findOne: jest.fn().mockResolvedValue(company),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    const managerQuery = jest.fn((sql: string) => {
      if (sql.includes('FROM identifier_sequences')) {
        const value =
          sequenceValues[
            Math.min(sequenceCallIndex, sequenceValues.length - 1)
          ];
        sequenceCallIndex += 1;
        return Promise.resolve([{ current_value: value }]);
      }

      if (sql.includes('INSERT INTO generated_identifiers')) {
        const attempt = insertCallIndex;
        insertCallIndex += 1;
        if (duplicateOnAttempts.has(attempt)) {
          return Promise.reject(
            Object.assign(new Error('duplicate key value'), {
              code: '23505',
              constraint: 'UQ_generated_identifiers_value',
            }),
          );
        }
        return Promise.resolve(undefined);
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const manager = {
      query: managerQuery,
      getRepository: jest.fn().mockReturnValue(companyRepository),
    } as unknown as EntityManager;

    const dataSource = {
      manager,
      getRepository: jest.fn().mockReturnValue(companyRepository),
    } as unknown as DataSource;

    const service = new IdentifierGeneratorService(dataSource);

    return { service, manager, companyRepository, managerQuery };
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('formats the first quotation of the day as {PREFIX}{yyMMdd}001', async () => {
    const { service, manager } = createFixture({ sequenceValues: [1] });

    const quotationNo = await service.generateQuotationNumber(
      'company-1',
      manager,
    );

    expect(quotationNo).toBe('AICL260729001');
  });

  it('increases the sequence on successive calls the same day', async () => {
    const { service, manager } = createFixture({ sequenceValues: [1, 2, 3] });

    const first = await service.generateQuotationNumber('company-1', manager);
    const second = await service.generateQuotationNumber('company-1', manager);
    const third = await service.generateQuotationNumber('company-1', manager);

    expect(first).toBe('AICL260729001');
    expect(second).toBe('AICL260729002');
    expect(third).toBe('AICL260729003');
  });

  it('expands past 3 digits instead of truncating once more than 999 are generated', async () => {
    const { service, manager } = createFixture({ sequenceValues: [1000] });

    const quotationNo = await service.generateQuotationNumber(
      'company-1',
      manager,
    );

    expect(quotationNo).toBe('AICL2607291000');
  });

  it('keeps one company sequence while the displayed date changes', async () => {
    const { service, manager, managerQuery } = createFixture({
      sequenceValues: [3, 4, 5],
    });

    const first = await service.generateQuotationNumber('company-1', manager);

    const [sequenceSql, sequenceParams] = managerQuery.mock.calls[0];
    expect(sequenceSql).toContain('FROM identifier_sequences');
    // company_id, identifier_type, sequence_date, sequence_time_bucket
    expect(sequenceParams).toEqual(['company-1', 'QUOTATION', 'LIFETIME', '']);

    // The counter scope stays fixed even though the date in the number moves.
    jest.setSystemTime(new Date('2026-07-30T10:00:00.000Z'));
    const nextDay = await service.generateQuotationNumber('company-1', manager);
    const [, nextDayParams] = managerQuery.mock.calls[2];
    expect(nextDayParams).toEqual(['company-1', 'QUOTATION', 'LIFETIME', '']);

    jest.setSystemTime(new Date('2027-01-01T10:00:00.000Z'));
    const nextYear = await service.generateQuotationNumber(
      'company-1',
      manager,
    );
    expect(managerQuery.mock.calls[4][1]).toEqual([
      'company-1',
      'QUOTATION',
      'LIFETIME',
      '',
    ]);
    expect(first).toBe('AICL260729003');
    expect(nextDay).toBe('AICL260730004');
    expect(nextYear).toBe('AICL270101005');
    expect(sequenceSql).toContain(
      'ON CONFLICT (company_id, identifier_type, sequence_date, sequence_time_bucket)',
    );
  });

  it('scopes the sequence independently per company', async () => {
    const fixtureA = createFixture({
      company: createCompany({ id: 'company-a', identifier_prefix: 'AIC' }),
      sequenceValues: [1],
    });
    const fixtureB = createFixture({
      company: createCompany({ id: 'company-b', identifier_prefix: 'ABC' }),
      sequenceValues: [1],
    });

    const numberA = await fixtureA.service.generateQuotationNumber(
      'company-a',
      fixtureA.manager,
    );
    const numberB = await fixtureB.service.generateQuotationNumber(
      'company-b',
      fixtureB.manager,
    );

    expect(numberA).toBe('AIC260729001');
    expect(numberB).toBe('ABC260729001');

    const [, paramsA] = fixtureA.managerQuery.mock.calls[0];
    const [, paramsB] = fixtureB.managerQuery.mock.calls[0];
    expect(paramsA[0]).toBe('company-a');
    expect(paramsB[0]).toBe('company-b');
  });

  it('retries with a fresh sequence value when the dedupe insert collides, avoiding a duplicate', async () => {
    const { service, manager } = createFixture({
      sequenceValues: [1, 2],
      duplicateOnAttempts: [0],
    });

    const quotationNo = await service.generateQuotationNumber(
      'company-1',
      manager,
    );

    // The first attempt (sequence 1) lost the race and was rejected as a
    // duplicate; the retry took a fresh sequence value (2) rather than
    // reusing the collided one.
    expect(quotationNo).toBe('AICL260729002');
  });

  it('gives up after repeated collisions rather than looping forever', async () => {
    const { service, manager } = createFixture({
      sequenceValues: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      duplicateOnAttempts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    });

    await expect(
      service.generateQuotationNumber('company-1', manager),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not mask or retry a non-duplicate error from the dedupe insert', async () => {
    const { service, manager, managerQuery } = createFixture({
      sequenceValues: [1],
    });
    managerQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM identifier_sequences')) {
        return Promise.resolve([{ current_value: 1 }]);
      }
      if (sql.includes('INSERT INTO generated_identifiers')) {
        return Promise.reject(new Error('connection reset'));
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      service.generateQuotationNumber('company-1', manager),
    ).rejects.toThrow('connection reset');
  });

  it('leaves the cover-note number alphanumeric with a time bucket', async () => {
    const { service, manager } = createFixture({ sequenceValues: [7] });

    const coverNoteNo = await service.generateCoverNoteNumber(
      'company-1',
      manager,
    );

    // Note: IDENTIFIER_DATE_FORMATS.coverNoteDate is nominally 'yyyyMMdd',
    // but formatDate()'s `.includes('yy')` check also matches the 'yyyy'
    // substring, so this pre-existing (unrelated to this change) behavior
    // actually produces a 2-digit year here too.
    expect(coverNoteNo).toMatch(/^ICC739CN260729\d{6}0007$/);
  });

  it('leaves the TIRAMIS request id alphanumeric', async () => {
    const { service, manager } = createFixture({ sequenceValues: [3] });

    const requestId = await service.generateRequestId('company-1', manager);

    expect(requestId).toBe('AICLREQ260729000003');
  });
});
