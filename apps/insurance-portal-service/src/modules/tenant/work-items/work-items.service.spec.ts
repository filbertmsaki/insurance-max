import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { WorkItemsService } from './work-items.service';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

const user = {
  id: 'user-1',
  companyId: 'company-1',
  roles: ['CLAIMS_OFFICER'],
} as any;
const otherUser = {
  id: 'user-2',
  companyId: 'company-1',
  roles: ['CLAIMS_OFFICER'],
} as any;

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    company_id: 'company-1',
    branch_id: 'branch-1',
    status: 'OPEN',
    priority: 'MEDIUM',
    assigned_user_id: null,
    assigned_role: 'CLAIMS_OFFICER',
    claimed_at: null,
    started_at: null,
    completed_by: null,
    completed_at: null,
    cancelled_by: null,
    cancelled_at: null,
    cancellation_reason: null,
    ...overrides,
  } as any;
}

type Clause = { method: string; sql: string; params?: any; nested?: Clause[] };

function isBrackets(
  value: unknown,
): value is { whereFactory: (qb: any) => any } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).whereFactory === 'function'
  );
}

function makeRecordingBuilder(clauses: Clause[]) {
  const record =
    (method: string) =>
    (condition: any, params?: any): any => {
      if (isBrackets(condition)) {
        const nested: Clause[] = [];
        condition.whereFactory(makeRecordingBuilder(nested));
        clauses.push({ method, sql: '<brackets>', nested });
      } else {
        clauses.push({ method, sql: condition, params });
      }
      return builder;
    };
  const builder: any = {
    where: record('where'),
    andWhere: record('andWhere'),
    orWhere: record('orWhere'),
    select: jest.fn(() => builder),
    addSelect: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    addOrderBy: jest.fn(() => builder),
    groupBy: jest.fn(() => builder),
    setLock: jest.fn(() => builder),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  };
  return builder;
}

function makeHarness(
  params: {
    item?: any;
    scope?: Partial<{
      companyId: string;
      canViewAllBranches: boolean;
      allowedBranchIds: string[];
    }>;
    existingByKey?: any;
    transactionError?: Error;
    membership?: any;
  } = {},
) {
  const clauses: Clause[] = [];
  const queryBuilder = makeRecordingBuilder(clauses);

  const companyUserRepo = {
    findOne: jest.fn().mockResolvedValue(params.membership ?? null),
  };

  const workItemRepository = {
    findOne: jest.fn().mockImplementation(async ({ where }: any) => {
      if (where.idempotency_key !== undefined) {
        return params.existingByKey ?? null;
      }
      const item = params.item;
      if (!item) return null;
      if (where.id !== item.id || where.company_id !== item.company_id) {
        return null;
      }
      return item;
    }),
    save: jest.fn().mockImplementation(async (value) => value),
    createQueryBuilder: jest.fn(() => queryBuilder),
    manager: {
      getRepository: (entity: any) => {
        if (entity?.name === 'CompanyUser') return companyUserRepo;
        throw new Error(`Unexpected entity ${entity?.name}`);
      },
    },
  } as any;

  const workItemEventRepository = {
    create: jest.fn((value) => value),
    save: jest.fn().mockImplementation(async (value) => value),
    find: jest.fn().mockResolvedValue([]),
  } as any;

  // Row lock used by status transitions: returns the item only when both
  // the id and the company in the query match it.
  const lockFilter: Record<string, unknown> = {};
  const lockBuilder: any = {
    setLock: jest.fn(() => lockBuilder),
    where: jest.fn((_sql: string, p: any) => {
      Object.assign(lockFilter, p);
      return lockBuilder;
    }),
    andWhere: jest.fn((_sql: string, p: any) => {
      Object.assign(lockFilter, p);
      return lockBuilder;
    }),
    getOne: jest.fn(async () => {
      const item = params.item;
      return item &&
        item.id === lockFilter.id &&
        item.company_id === lockFilter.companyId
        ? item
        : null;
    }),
  };
  const txWorkItemRepo = {
    create: jest.fn((value) => value),
    createQueryBuilder: jest.fn(() => lockBuilder),
    save: jest
      .fn()
      .mockImplementation(async (value) => ({ id: 'item-new', ...value })),
  };
  const txEventRepo = {
    create: jest.fn((value) => value),
    save: jest.fn().mockImplementation(async (value) => value),
  };
  const manager = {
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'WorkItem':
          return txWorkItemRepo;
        case 'WorkItemEvent':
          return txEventRepo;
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (fn: any) => {
      if (params.transactionError) throw params.transactionError;
      return fn(manager);
    }),
  } as any;

  const scope = {
    companyId: 'company-1',
    canViewAllBranches: false,
    allowedBranchIds: ['branch-1'],
    ...params.scope,
  };
  const scopeService = { resolve: jest.fn(() => scope) } as any;

  const service = new WorkItemsService(
    workItemRepository,
    workItemEventRepository,
    scopeService,
    dataSource,
  );

  return {
    service,
    clauses,
    queryBuilder,
    workItemRepository,
    workItemEventRepository,
    txWorkItemRepo,
    txEventRepo,
    lockBuilder,
    dataSource,
    companyUserRepo,
  };
}

function flatten(clauses: Clause[]): Clause[] {
  return clauses.flatMap((c) => [c, ...flatten(c.nested ?? [])]);
}

function findClause(clauses: Clause[], fragment: string) {
  return flatten(clauses).find((c) => c.sql.includes(fragment));
}

/** Events written outside (comment/assign) or inside (transitions) a transaction. */
function eventTypes(h: ReturnType<typeof makeHarness>) {
  return [
    ...h.workItemEventRepository.save.mock.calls,
    ...h.txEventRepo.save.mock.calls,
  ].map(([event]: any[]) => event.event_type);
}

const baseCreate = {
  companyId: 'company-1',
  domain: 'claims',
  resourceType: 'claim',
  resourceId: 'claim-1',
  title: 'Review claim',
};

describe('WorkItemsService', () => {
  describe('create', () => {
    it('defaults priority, queue, assignment type and leaves due date unset', async () => {
      const h = makeHarness();

      const item = await h.service.create(baseCreate);

      expect(h.dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(item).toMatchObject({
        id: 'item-new',
        company_id: 'company-1',
        branch_id: null,
        priority: 'MEDIUM',
        status: 'OPEN',
        sla_status: 'ON_TRACK',
        queue_code: 'claims',
        source_module: 'claims',
        work_item_type: 'CLAIM',
        assignment_type: 'QUEUE',
        assigned_user_id: null,
        due_at: null,
        idempotency_key: null,
      });
      expect(item.work_item_no).toMatch(/^WIT-[0-9A-F-]{8}$/);
      expect(h.workItemRepository.findOne).not.toHaveBeenCalled();
    });

    it('honours explicit priority, due date, queue and user assignment', async () => {
      const h = makeHarness();
      const dueAt = new Date('2026-10-10T00:00:00Z');

      const item = await h.service.create({
        ...baseCreate,
        branchId: 'branch-1',
        priority: 'CRITICAL',
        dueAt,
        queueCode: 'claims-approval',
        assignedUserId: 'user-9',
      });

      expect(item).toMatchObject({
        branch_id: 'branch-1',
        priority: 'CRITICAL',
        due_at: dueAt,
        queue_code: 'claims-approval',
        assignment_type: 'USER',
        assigned_user_id: 'user-9',
      });
    });

    it('records a CREATED event inside the same transaction', async () => {
      const h = makeHarness();

      await h.service.create({ ...baseCreate, createdBy: 'user-1' });

      expect(h.txEventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: 'company-1',
          work_item_id: 'item-new',
          event_type: 'CREATED',
          actor_id: 'user-1',
          metadata: { priority: 'MEDIUM', queueCode: 'claims' },
        }),
      );
      expect(h.workItemEventRepository.save).not.toHaveBeenCalled();
    });

    it('rejects titles longer than 180 characters', async () => {
      const h = makeHarness();

      await expect(
        h.service.create({ ...baseCreate, title: 'x'.repeat(181) }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('returns the existing item for a repeated idempotency key without inserting', async () => {
      const existing = makeItem({ id: 'item-existing' });
      const h = makeHarness({ existingByKey: existing });

      const item = await h.service.create({
        ...baseCreate,
        idempotencyKey: 'claim-1:review',
      });

      expect(item).toBe(existing);
      expect(h.workItemRepository.findOne).toHaveBeenCalledWith({
        where: { company_id: 'company-1', idempotency_key: 'claim-1:review' },
      });
      expect(h.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('falls back to dedupeKey as the idempotency key', async () => {
      const h = makeHarness();

      const item = await h.service.create({
        ...baseCreate,
        dedupeKey: 'sla:claim-1',
      });

      expect(h.workItemRepository.findOne).toHaveBeenCalledWith({
        where: { company_id: 'company-1', idempotency_key: 'sla:claim-1' },
      });
      expect(item).toMatchObject({
        idempotency_key: 'sla:claim-1',
        dedupe_key: 'sla:claim-1',
      });
    });

    it('prefers idempotencyKey over dedupeKey', async () => {
      const h = makeHarness();

      const item = await h.service.create({
        ...baseCreate,
        idempotencyKey: 'idem-1',
        dedupeKey: 'dedupe-1',
      });

      expect(item).toMatchObject({
        idempotency_key: 'idem-1',
        dedupe_key: 'dedupe-1',
      });
    });

    it('returns the concurrently-inserted item when the insert loses a unique-key race', async () => {
      const winner = makeItem({ id: 'item-winner' });
      const h = makeHarness({ transactionError: new Error('duplicate key') });
      h.workItemRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(winner);

      const item = await h.service.create({
        ...baseCreate,
        idempotencyKey: 'race-key',
      });

      expect(item).toBe(winner);
      expect(h.workItemRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('rethrows transaction errors when there is no idempotency key', async () => {
      const h = makeHarness({ transactionError: new Error('boom') });

      await expect(h.service.create(baseCreate)).rejects.toThrow('boom');
      expect(h.workItemRepository.findOne).not.toHaveBeenCalled();
    });

    it('rethrows when the keyed insert fails and no existing item is found', async () => {
      const h = makeHarness({ transactionError: new Error('boom') });

      await expect(
        h.service.create({ ...baseCreate, idempotencyKey: 'k' }),
      ).rejects.toThrow('boom');
    });
  });

  describe('findOne scoping', () => {
    it('hides items from another company', async () => {
      const h = makeHarness({ item: makeItem({ company_id: 'company-2' }) });

      await expect(h.service.findOne(user, 'item-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('hides items from a branch outside the user scope', async () => {
      const h = makeHarness({ item: makeItem({ branch_id: 'branch-2' }) });

      await expect(h.service.findOne(user, 'item-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('allows company-wide (null branch) items and all-branch viewers', async () => {
      const nullBranch = makeHarness({ item: makeItem({ branch_id: null }) });
      await expect(
        nullBranch.service.findOne(user, 'item-1'),
      ).resolves.toMatchObject({ id: 'item-1', branch_id: null });

      const allBranches = makeHarness({
        item: makeItem({ branch_id: 'branch-2' }),
        scope: { canViewAllBranches: true },
      });
      await expect(
        allBranches.service.findOne(user, 'item-1'),
      ).resolves.toMatchObject({ id: 'item-1' });
    });
  });

  describe('claim', () => {
    it('assigns an open unassigned item to the caller and records CLAIMED', async () => {
      const h = makeHarness({ item: makeItem() });

      const item = await h.service.claim(user, 'item-1');

      expect(item.assigned_user_id).toBe('user-1');
      expect(item.claimed_at).toBeInstanceOf(Date);
      expect(item.status).toBe('OPEN');
      expect(h.txWorkItemRepo.save).toHaveBeenCalledWith(item);
      expect(eventTypes(h)).toEqual(['CLAIMED']);
    });

    it('rejects claiming an item already assigned to another user', async () => {
      const h = makeHarness({
        item: makeItem({ assigned_user_id: 'user-2' }),
      });

      await expect(h.service.claim(user, 'item-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(h.txWorkItemRepo.save).not.toHaveBeenCalled();
    });

    it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'BLOCKED'])(
      'rejects claiming a %s item',
      async (status) => {
        const h = makeHarness({ item: makeItem({ status }) });

        await expect(h.service.claim(user, 'item-1')).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(h.txWorkItemRepo.save).not.toHaveBeenCalled();
      },
    );

    it('rejects claiming an out-of-branch item', async () => {
      const h = makeHarness({ item: makeItem({ branch_id: 'branch-2' }) });

      await expect(h.service.claim(user, 'item-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // Real concurrency is proven against PostgreSQL in
    // test/work-items/work-item-claim-race.e2e-spec.ts.
    it('claims under a pessimistic write lock inside a transaction', async () => {
      const h = makeHarness({ item: makeItem() });

      await h.service.claim(user, 'item-1');

      expect(h.dataSource.transaction).toHaveBeenCalled();
      expect(h.lockBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('re-checks assignment under the lock so a later claimer loses', async () => {
      const item = makeItem();
      const h = makeHarness({ item });

      await h.service.claim(user, 'item-1');

      await expect(h.service.claim(otherUser, 'item-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(item.assigned_user_id).toBe('user-1');
    });
  });

  describe('start', () => {
    it('moves an OPEN unassigned item to IN_PROGRESS and auto-assigns the caller', async () => {
      const h = makeHarness({ item: makeItem() });

      const item = await h.service.start(user, 'item-1');

      expect(item).toMatchObject({
        status: 'IN_PROGRESS',
        assigned_user_id: 'user-1',
      });
      expect(item.started_at).toBeInstanceOf(Date);
      expect(item.claimed_at).toBeInstanceOf(Date);
      expect(eventTypes(h)).toEqual(['STARTED']);
    });

    it('keeps the original claimed_at when the caller already claimed the item', async () => {
      const claimedAt = new Date('2026-01-01T00:00:00Z');
      const h = makeHarness({
        item: makeItem({ assigned_user_id: 'user-1', claimed_at: claimedAt }),
      });

      const item = await h.service.start(user, 'item-1');

      expect(item.claimed_at).toBe(claimedAt);
    });

    it('resumes a BLOCKED item', async () => {
      const h = makeHarness({
        item: makeItem({ status: 'BLOCKED', assigned_user_id: 'user-1' }),
      });

      await expect(h.service.start(user, 'item-1')).resolves.toMatchObject({
        status: 'IN_PROGRESS',
      });
    });

    it('forbids starting an item assigned to another user', async () => {
      const h = makeHarness({
        item: makeItem({ assigned_user_id: 'user-2' }),
      });

      await expect(h.service.start(user, 'item-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(h.txWorkItemRepo.save).not.toHaveBeenCalled();
    });

    it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'])(
      'rejects starting a %s item',
      async (status) => {
        const h = makeHarness({
          item: makeItem({ status, assigned_user_id: 'user-1' }),
        });

        await expect(h.service.start(user, 'item-1')).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(h.txWorkItemRepo.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('execute', () => {
    it('completes an IN_PROGRESS item owned by the caller', async () => {
      const h = makeHarness({
        item: makeItem({ status: 'IN_PROGRESS', assigned_user_id: 'user-1' }),
      });

      const item = await h.service.execute(user, 'item-1');

      expect(item).toMatchObject({
        status: 'COMPLETED',
        completed_by: 'user-1',
      });
      expect(item.completed_at).toBeInstanceOf(Date);
      expect(eventTypes(h)).toEqual(['EXECUTED']);
    });

    it('forbids completing an item assigned to another user', async () => {
      const h = makeHarness({
        item: makeItem({ status: 'IN_PROGRESS', assigned_user_id: 'user-2' }),
      });

      await expect(h.service.execute(user, 'item-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(h.txWorkItemRepo.save).not.toHaveBeenCalled();
    });

    it.each(['OPEN', 'BLOCKED', 'COMPLETED', 'CANCELLED'])(
      'rejects completing a %s item (not idempotent on repeat)',
      async (status) => {
        const h = makeHarness({
          item: makeItem({ status, assigned_user_id: 'user-1' }),
        });

        await expect(h.service.execute(user, 'item-1')).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(h.txWorkItemRepo.save).not.toHaveBeenCalled();
      },
    );

    it('complete() delegates to execute()', async () => {
      const h = makeHarness({
        item: makeItem({ status: 'IN_PROGRESS', assigned_user_id: 'user-1' }),
      });

      await expect(h.service.complete(user, 'item-1')).resolves.toMatchObject({
        status: 'COMPLETED',
      });
    });
  });

  describe('cancel', () => {
    it.each(['OPEN', 'IN_PROGRESS', 'BLOCKED'])(
      'cancels a %s item with a reason',
      async (status) => {
        const h = makeHarness({ item: makeItem({ status }) });

        const item = await h.service.cancel(user, 'item-1', {
          reason: 'Duplicate',
        });

        expect(item).toMatchObject({
          status: 'CANCELLED',
          cancelled_by: 'user-1',
          cancellation_reason: 'Duplicate',
        });
        expect(h.txEventRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'CANCELLED',
            comment: 'Duplicate',
          }),
        );
      },
    );

    it.each(['COMPLETED', 'CANCELLED'])(
      'rejects cancelling a %s item',
      async (status) => {
        const h = makeHarness({ item: makeItem({ status }) });

        await expect(
          h.service.cancel(user, 'item-1', { reason: 'x' } as any),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(h.txWorkItemRepo.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('listForUser', () => {
    it('rejects unsupported views', async () => {
      const h = makeHarness();

      await expect(h.service.listForUser(user, 'bogus')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('always filters by the scoped company id', async () => {
      const h = makeHarness({ scope: { companyId: 'company-1' } });

      await h.service.listForUser(user, 'all');

      expect(h.clauses[0]).toEqual({
        method: 'where',
        sql: 'item.company_id = :companyId',
        params: { companyId: 'company-1' },
      });
    });

    it('limits branch-scoped users to their branches plus company-wide items', async () => {
      const h = makeHarness({ scope: { allowedBranchIds: ['branch-1'] } });

      await h.service.listForUser(user, 'all');

      expect(findClause(h.clauses, 'item.branch_id IS NULL')).toBeDefined();
      expect(
        findClause(h.clauses, 'item.branch_id IN (:...branchIds)')?.params,
      ).toEqual({ branchIds: ['branch-1'] });
    });

    it('uses an impossible branch id when the user has no branches', async () => {
      const h = makeHarness({ scope: { allowedBranchIds: [] } });

      await h.service.listForUser(user, 'all');

      expect(
        findClause(h.clauses, 'item.branch_id IN (:...branchIds)')?.params,
      ).toEqual({ branchIds: [ZERO_UUID] });
    });

    it('skips branch and assignment filters for all-branch viewers', async () => {
      const h = makeHarness({ scope: { canViewAllBranches: true } });

      await h.service.listForUser(user, 'all');

      expect(findClause(h.clauses, 'branch_id')).toBeUndefined();
      expect(findClause(h.clauses, 'assigned_user_id')).toBeUndefined();
    });

    it('"all" view restricts to own, unassigned or own-role items and excludes cancelled', async () => {
      const h = makeHarness();

      await h.service.listForUser(user, 'all');

      expect(findClause(h.clauses, "item.status <> 'CANCELLED'")).toBeDefined();
      expect(
        findClause(h.clauses, 'item.assigned_user_id = :viewerId')?.params,
      ).toEqual({ viewerId: 'user-1' });
      expect(
        findClause(h.clauses, 'item.assigned_role IN (:...viewerRoles)')
          ?.params,
      ).toEqual({ viewerRoles: ['CLAIMS_OFFICER'] });
    });

    it('"my" view matches the user id or their roles and only active statuses', async () => {
      const h = makeHarness();

      await h.service.listForUser(user, 'my');

      expect(
        findClause(h.clauses, 'item.assigned_user_id = :userId')?.params,
      ).toEqual({ userId: 'user-1' });
      expect(
        findClause(h.clauses, 'item.assigned_role IN (:...viewerRoles)')
          ?.params,
      ).toEqual({ viewerRoles: ['CLAIMS_OFFICER'] });
      expect(
        findClause(
          h.clauses,
          "item.status IN ('OPEN', 'IN_PROGRESS', 'BLOCKED')",
        ),
      ).toBeDefined();
    });

    it('"team" view uses a NO_ROLE sentinel for users without roles', async () => {
      const h = makeHarness();

      await h.service.listForUser({ ...user, roles: [] }, 'team');

      expect(
        findClause(h.clauses, 'item.assigned_role IN (:...roles)')?.params,
      ).toEqual({ roles: ['NO_ROLE'] });
    });

    it.each([
      'overdue',
      'high-priority',
      'due-today',
      'completed',
      'delegated',
    ])(
      '"%s" view applies the same assignee/role restriction as "all"',
      async (view) => {
        const h = makeHarness();

        await h.service.listForUser(user, view);

        expect(
          findClause(h.clauses, 'item.assigned_user_id = :viewerId'),
        ).toBeDefined();
      },
    );

    it('lets all-branch viewers see every assignment in filtered views', async () => {
      const h = makeHarness({ scope: { canViewAllBranches: true } });

      await h.service.listForUser(user, 'overdue');

      expect(
        findClause(h.clauses, 'item.assigned_user_id = :viewerId'),
      ).toBeUndefined();
    });
  });
});
