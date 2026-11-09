import { QuotationsService } from './quotations.service';

describe('fleet ID generation', () => {
  afterEach(() => jest.useRealTimers());

  it('uses the TIRA code, local date and an expanding lifetime sequence', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T12:00:00Z'));
    const nextValue = jest
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1000);
    const service = Object.create(QuotationsService.prototype);
    service.businessReferenceService = { nextValue };
    const manager = {
      query: jest
        .fn()
        .mockImplementation((sql: string) =>
          Promise.resolve(
            sql.includes('FROM companies')
              ? [{ tira_company_code: 'ICC110' }]
              : [],
          ),
        ),
    };

    expect(await service.generateFleetId(manager, 'company-1')).toBe(
      'ICC110F260729001',
    );
    expect(await service.generateFleetId(manager, 'company-1')).toBe(
      'ICC110F2607291000',
    );
    expect(nextValue).toHaveBeenCalledWith({
      companyId: 'company-1',
      documentType: 'MOTOR_FLEET_REFERENCE',
      periodKey: 'LIFETIME',
      manager,
    });
  });

  it('skips an ID already used by another company', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T12:00:00Z'));
    const service = Object.create(QuotationsService.prototype);
    service.businessReferenceService = {
      nextValue: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
    };
    const manager = {
      query: jest.fn().mockImplementation((sql: string, params: string[]) => {
        if (sql.includes('FROM companies')) {
          return Promise.resolve([{ tira_company_code: 'ICC110' }]);
        }
        if (params?.[0] === 'ICC110F261102001') {
          return Promise.resolve([{ '?column?': 1 }]);
        }
        return Promise.resolve([]);
      }),
    };

    expect(await service.generateFleetId(manager, 'company-2')).toBe(
      'ICC110F261102002',
    );
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['fleet-id:ICC110F261102'],
    );
  });
});
