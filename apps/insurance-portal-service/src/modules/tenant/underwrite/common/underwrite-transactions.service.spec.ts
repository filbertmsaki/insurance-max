import { NotFoundException } from '@nestjs/common';
import { UnderwriteLine } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { UnderwriteTransactionsService } from './underwrite-transactions.service';

function makeQueryBuilder(result: Record<string, string> | null) {
  const queryBuilder: Record<string, jest.Mock> = {};
  ['andWhere', 'innerJoin', 'select', 'where'].forEach((method) => {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  });
  queryBuilder.getRawOne = jest.fn().mockResolvedValue(result);
  return queryBuilder;
}

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  scope: 'company',
  userType: 'COMPANY_USER',
  sessionId: 'session-1',
  accessTokenId: 'token-1',
  companyId: 'company-1',
  companyMembershipId: 'membership-1',
  roles: ['UNDERWRITER'],
  permissions: ['policies:read'],
} as AuthenticatedUser;

describe('UnderwriteTransactionsService line assertions', () => {
  it('returns 404 for a policy outside the requested line', async () => {
    const policyQuery = makeQueryBuilder(null);
    const dataAccessScopeService = {
      resolve: jest.fn().mockReturnValue({ allowedBranchIds: ['branch-1'] }),
      applyPolicyReadScope: jest.fn(),
      applyPolicyTransactionReadScope: jest.fn(),
    };
    const service = new UnderwriteTransactionsService(
      {} as never,
      {} as never,
      { createQueryBuilder: jest.fn(() => policyQuery) } as never,
      {} as never,
      dataAccessScopeService as never,
    );

    await expect(
      service.assertPolicyInLine(user, UnderwriteLine.FLEET, 'policy-1'),
    ).rejects.toThrow(NotFoundException);
    expect(policyQuery.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('= :line'),
      { line: UnderwriteLine.FLEET },
    );
    expect(dataAccessScopeService.applyPolicyReadScope).toHaveBeenCalledWith(
      policyQuery,
      'policy',
      { allowedBranchIds: ['branch-1'] },
    );
  });

  it('accepts a transaction in the requested line and applies data scope', async () => {
    const transactionQuery = makeQueryBuilder({ id: 'transaction-1' });
    const dataAccessScopeService = {
      resolve: jest.fn().mockReturnValue({ allowedBranchIds: ['branch-1'] }),
      applyPolicyReadScope: jest.fn(),
      applyPolicyTransactionReadScope: jest.fn(),
    };
    const service = new UnderwriteTransactionsService(
      { createQueryBuilder: jest.fn(() => transactionQuery) } as never,
      {} as never,
      {} as never,
      {} as never,
      dataAccessScopeService as never,
    );

    await expect(
      service.assertTransactionInLine(
        user,
        UnderwriteLine.MOTOR,
        'transaction-1',
        'endorsement',
      ),
    ).resolves.toBeUndefined();
    expect(
      dataAccessScopeService.applyPolicyTransactionReadScope,
    ).toHaveBeenCalledWith(
      transactionQuery,
      'policy',
      'transaction',
      { allowedBranchIds: ['branch-1'] },
      false,
    );
  });
});

function makeListQueryBuilder(result: {
  rawMany?: unknown[];
  count?: number;
  rawAndEntities?: { entities: unknown[]; raw: unknown[] };
}) {
  const queryBuilder: Record<string, jest.Mock> = {};
  [
    'addOrderBy',
    'addSelect',
    'limit',
    'andWhere',
    'innerJoin',
    'innerJoinAndSelect',
    'leftJoin',
    'orderBy',
    'select',
    'where',
  ].forEach((method) => {
    queryBuilder[method] = jest.fn(() => queryBuilder);
  });
  queryBuilder.getRawMany = jest.fn().mockResolvedValue(result.rawMany ?? []);
  queryBuilder.getCount = jest
    .fn()
    .mockResolvedValue(result.count ?? (result.rawMany ?? []).length);
  queryBuilder.getRawAndEntities = jest
    .fn()
    .mockResolvedValue(result.rawAndEntities ?? { entities: [], raw: [] });
  return queryBuilder;
}

const scope = {
  resolve: jest.fn().mockReturnValue({}),
  applyPolicyReadScope: jest.fn(),
  applyPolicyTransactionReadScope: jest.fn(),
  applyQuotationReadScope: jest.fn(),
};

const transactionRow = {
  id: 'transaction-1',
  transaction_no: 'END-1',
  transaction_type: 'ENDORSEMENT',
  submission_status: 'FAILED',
  source_policy_id: 'policy-1',
  reason: 'Add a truck',
  tiramis_request_id: 'request-1',
  tiramis_transaction_id: 'tira-1',
  updated_at: new Date('2026-10-01T10:00:00Z'),
  policy_no: 'POL-1',
  cover_note_no: 'REF-1',
  customer_snapshot: { customer_name: 'ABC Ltd' },
  endorsement_type_code: 'FLEET_ADD_VEHICLE',
  endorsement_type_name: 'Fleet - Add Vehicle',
  regulatory_status_code: 'TIRA105',
  regulatory_status_description: 'Invalid FleetId',
};

describe('UnderwriteTransactionsService lists', () => {
  it('returns the endorsement type on endorsement rows', async () => {
    const query = makeListQueryBuilder({ rawMany: [transactionRow] });
    const service = new UnderwriteTransactionsService(
      { createQueryBuilder: jest.fn(() => query) } as never,
      {} as never,
      {} as never,
      {} as never,
      scope as never,
    );

    const [row] = await service.listTransactions(
      user,
      UnderwriteLine.FLEET,
      'endorsement',
    );

    expect(row).toMatchObject({
      kind: 'endorsement',
      endorsement_type_code: 'FLEET_ADD_VEHICLE',
      endorsement_type_name: 'Fleet - Add Vehicle',
      policy_no: 'POL-1',
      customer_name: 'ABC Ltd',
    });
    expect(row).not.toHaveProperty('regulatory_status_code');
    expect(query.leftJoin).toHaveBeenCalledWith(
      expect.anything(),
      'endorsement',
      'endorsement.policy_transaction_id = transaction.id',
    );
  });

  it('adds the source policy number to renewal rows', async () => {
    const query = makeListQueryBuilder({
      rawAndEntities: {
        entities: [
          {
            id: 'renewal-1',
            renewal_no: 'REN-1',
            policy_transaction: { id: 'transaction-1' },
          },
        ],
        raw: [{ renewal_id: 'renewal-1', source_policy_no: 'POL-9' }],
      },
    });
    const service = new UnderwriteTransactionsService(
      {} as never,
      { createQueryBuilder: jest.fn(() => query) } as never,
      {} as never,
      {} as never,
      scope as never,
    );

    const [row] = await service.listRenewals(user, UnderwriteLine.FLEET);

    expect(row.policy_no).toBe('POL-9');
    expect(row.policy_transaction).toMatchObject({
      id: 'transaction-1',
      policy_no: 'POL-9',
    });
  });

  it('shows TIRA status on failed transactions and only TIRA-failed quotations', async () => {
    const transactionQuery = makeListQueryBuilder({
      rawMany: [transactionRow],
    });
    const quotationQuery = makeListQueryBuilder({ rawMany: [] });
    const service = new UnderwriteTransactionsService(
      { createQueryBuilder: jest.fn(() => transactionQuery) } as never,
      {} as never,
      {} as never,
      { createQueryBuilder: jest.fn(() => quotationQuery) } as never,
      scope as never,
    );

    const [row] = await service.listTiraQueue(
      user,
      UnderwriteLine.FLEET,
      'failed',
    );

    expect(row).toMatchObject({
      source_kind: 'policy_transaction',
      status_code: 'TIRA105',
      status_description: 'Invalid FleetId',
      endorsement_type_code: 'FLEET_ADD_VEHICLE',
    });
    expect(quotationQuery.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('quotation.status = :failedStatus'),
      { tiraStatuses: ['FAILED', 'REJECTED'], failedStatus: 'FAILED' },
    );
  });

  it('falls back to the reason when TIRA returned no status', async () => {
    const transactionQuery = makeListQueryBuilder({
      rawMany: [
        {
          ...transactionRow,
          regulatory_status_code: null,
          regulatory_status_description: null,
        },
      ],
    });
    const service = new UnderwriteTransactionsService(
      { createQueryBuilder: jest.fn(() => transactionQuery) } as never,
      {} as never,
      {} as never,
      {
        createQueryBuilder: jest.fn(() =>
          makeListQueryBuilder({ rawMany: [] }),
        ),
      } as never,
      scope as never,
    );

    const [row] = await service.listTiraQueue(
      user,
      UnderwriteLine.FLEET,
      'failed',
    );

    expect(row).toMatchObject({
      status_code: null,
      status_description: 'Add a truck',
    });
  });

  it('pages the merged TIRA queue in SQL windows', async () => {
    const older = {
      ...transactionRow,
      id: 't-1',
      updated_at: new Date('2026-01-01'),
    };
    const newer = {
      ...transactionRow,
      id: 't-2',
      updated_at: new Date('2026-03-01'),
    };
    const transactionQuery = makeListQueryBuilder({
      rawMany: [newer, older],
      count: 7,
    });
    const quotationQuery = makeListQueryBuilder({
      rawMany: [
        {
          id: 'q-1',
          reference_no: 'Q-1',
          updated_at: new Date('2026-02-01'),
          customer_snapshot: null,
          source_kind: 'quotation',
        },
      ],
      count: 3,
    });
    const service = new UnderwriteTransactionsService(
      { createQueryBuilder: jest.fn(() => transactionQuery) } as never,
      {} as never,
      {} as never,
      { createQueryBuilder: jest.fn(() => quotationQuery) } as never,
      scope as never,
    );

    const result = (await service.listTiraQueue(
      user,
      UnderwriteLine.FLEET,
      'failed',
      {
        page: 1,
        limit: 2,
        search: 'abc',
      },
    )) as { data: Array<{ id: string }>; pagination: { total: number } };

    expect(result.data.map((row) => row.id)).toEqual(['t-2', 'q-1']);
    expect(result.pagination.total).toBe(10);
    expect(transactionQuery.limit).toHaveBeenCalledWith(2);
    expect(quotationQuery.limit).toHaveBeenCalledWith(2);
    expect(quotationQuery.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE :tiraSearch'),
      { tiraSearch: '%abc%' },
    );
  });
});
