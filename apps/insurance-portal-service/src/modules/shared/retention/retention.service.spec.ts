import {
  DataRetentionAction,
  DataRetentionStatus,
} from '@insurance-max/contracts';

import { RetentionService } from './retention.service';

describe('RetentionService enforcement', () => {
  function makeService(options: {
    legalHold?: boolean;
    dryRunDefault?: boolean;
  }) {
    const policyRepository = {
      find: jest.fn().mockResolvedValue([
        {
          policy_code: 'DOCUMENT_RETENTION',
          resource_type: 'documents',
          status: DataRetentionStatus.ACTIVE,
          action: DataRetentionAction.DELETE,
          retention_days: 30,
          archive_before_delete: true,
          version_number: 1,
          company_id: 'company-1',
        },
      ]),
    };
    const legalHoldRepository = {
      find: jest.fn(),
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        const predicates = Array.isArray(where) ? where : [where];
        return options.legalHold &&
          predicates.some((item) => item.resource_id === 'held-id')
          ? { id: 'hold-1' }
          : null;
      }),
      count: jest.fn().mockResolvedValue(1),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'DATA_RETENTION_ENABLED') {
          return true;
        }
        if (key === 'DATA_RETENTION_DRY_RUN_DEFAULT') {
          return options.dryRunDefault ?? true;
        }
        if (key === 'DATA_RETENTION_ENFORCEMENT_LIMIT') {
          return '500';
        }
        return undefined;
      }),
    };
    const dataSource = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('information_schema.columns')) {
          return [
            { column_name: 'id' },
            { column_name: 'company_id' },
            { column_name: 'created_at' },
            { column_name: 'archived_at' },
            { column_name: 'deleted_at' },
          ];
        }
        if (sql.includes('SELECT id')) {
          return [{ id: 'held-id' }, { id: 'free-id' }];
        }
        if (sql.includes('UPDATE')) {
          return [[], 1];
        }
        return [];
      }),
    };

    const service = new RetentionService(
      policyRepository as any,
      legalHoldRepository as any,
      configService as any,
      dataSource as any,
    );

    return { service, dataSource, legalHoldRepository };
  }

  it('dry-runs matched rows without mutating retained resources', async () => {
    const { service, dataSource } = makeService({ legalHold: false });

    const result = await service.dryRun('company-1');

    expect(result.dryRun).toBe(true);
    expect(result.itemsMatched).toBe(2);
    expect(result.itemsDeleted).toBe(0);
    expect(dataSource.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.anything(),
    );
  });

  it('enforces archive-before-delete while blocking legally held rows', async () => {
    const { service, dataSource, legalHoldRepository } = makeService({
      legalHold: true,
      dryRunDefault: false,
    });

    const result = await service.enforce('company-1', { dryRun: false });

    expect(result.itemsMatched).toBe(2);
    expect(result.itemsBlockedByHold).toBe(1);
    expect(result.itemsArchived).toBe(1);
    expect(result.itemsDeleted).toBe(1);
    expect(legalHoldRepository.findOne).toHaveBeenCalledWith({
      where: [
        expect.objectContaining({
          resource_type: 'documents',
          resource_id: 'held-id',
          company_id: 'company-1',
        }),
        expect.objectContaining({
          resource_type: 'documents',
          resource_id: 'held-id',
        }),
      ],
    });
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('SET archived_at = NOW()'),
      [['free-id']],
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('SET deleted_at = NOW()'),
      [['free-id']],
    );
  });
});
