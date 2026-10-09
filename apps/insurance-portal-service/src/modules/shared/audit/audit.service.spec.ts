import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestContextService } from '@insurance-max/shared-kernel';

import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let saved: Partial<AuditLog> | undefined;
  let lockQueries: string[];

  beforeEach(async () => {
    saved = undefined;
    lockQueries = [];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: (() => {
            const repository = {
              create: (input: Partial<AuditLog>) => input,
              findOne: jest.fn().mockResolvedValue(null),
              save: (entity: Partial<AuditLog>) => {
                saved = entity;
                return Promise.resolve(entity);
              },
              manager: {
                transaction: (work: (manager: unknown) => Promise<unknown>) =>
                  work({
                    query: (sql: string) => {
                      lockQueries.push(sql);
                      return Promise.resolve([]);
                    },
                    getRepository: () => repository,
                  }),
              },
            };
            return repository;
          })(),
        },
        {
          provide: RequestContextService,
          useValue: {
            getContext: () => ({ requestId: 'req-1', correlationId: 'corr-1' }),
          },
        },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  it('redacts sensitive keys such as passwords and tokens', async () => {
    await service.log({
      action: 'user.updated',
      userId: 'user-1',
      beforeState: { email: 'a@b.com', password: 'super-secret' },
      afterState: {
        email: 'a@b.com',
        password: 'super-secret-2',
        access_token: 'abc.def.ghi',
      },
    });

    expect(saved?.before_state).toEqual({
      email: 'a@b.com',
      password: '[REDACTED]',
    });

    expect(saved?.after_state).toEqual({
      email: 'a@b.com',
      password: '[REDACTED]',
      access_token: '[REDACTED]',
    });
  });

  it('redacts sensitive keys nested inside metadata objects', async () => {
    await service.log({
      action: 'auth.login_success',
      metadata: {
        request: { secret: 'top-secret', note: 'ok' },
      },
    });

    expect(saved?.metadata).toEqual({
      request: { secret: '[REDACTED]', note: 'ok' },
    });
  });

  it('records changed_fields between before and after state', async () => {
    await service.log({
      action: 'role.assigned',
      beforeState: { roles: ['STAFF'] },
      afterState: { roles: ['ADMINISTRATOR'] },
    });

    expect(saved?.changed_fields).toEqual(['roles']);
  });

  it('builds an audit hash chain for written events', async () => {
    await service.log({
      action: 'role.assigned',
      metadata: { role: 'ADMINISTRATOR' },
    });

    expect(saved?.event_no).toBe('1');
    expect(saved?.previous_event_hash).toBeNull();
    expect(saved?.event_hash).toEqual(expect.any(String));
    expect(lockQueries).toEqual(['SELECT pg_advisory_xact_lock($1)']);
  });
});

describe('AuditService.verifyChain', () => {
  // In-memory audit table that honours the find() options verifyChain uses.
  async function buildService(eventCount: number) {
    const rows: AuditLog[] = [];
    const repository = {
      create: (input: Partial<AuditLog>) => ({ ...input }) as AuditLog,
      findOne: () =>
        Promise.resolve(rows.length ? rows[rows.length - 1] : null),
      save: (entity: AuditLog) => {
        rows.push({ ...entity, id: `id-${rows.length + 1}` });
        return Promise.resolve(entity);
      },
      find: (options: {
        where: { event_no: { _type: string; _value?: string } };
        take: number;
      }) => {
        const after =
          options.where.event_no._type === 'moreThan'
            ? Number(options.where.event_no._value)
            : 0;
        return Promise.resolve(
          rows
            .filter((row) => Number(row.event_no) > after)
            .slice(0, options.take),
        );
      },
      manager: {
        transaction: (work: (manager: unknown) => Promise<unknown>) =>
          work({
            query: () => Promise.resolve([]),
            getRepository: () => repository,
          }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: repository },
        {
          provide: RequestContextService,
          useValue: { getContext: () => undefined },
        },
      ],
    }).compile();
    const service = module.get(AuditService);

    for (let i = 0; i < eventCount; i += 1) {
      await service.log({ action: 'role.assigned', metadata: { i } });
    }
    return { service, rows };
  }

  it('verifies a chain that spans several batches', async () => {
    const { service } = await buildService(2_501);

    await expect(service.verifyChain()).resolves.toEqual({
      valid: true,
      totalEvents: 2_501,
      brokenEventId: null,
      brokenEventNo: null,
      reason: null,
    });
  });

  it('reports tampering found in a later batch', async () => {
    const { service, rows } = await buildService(1_500);
    rows[1_200].metadata = { i: 'tampered' };

    await expect(service.verifyChain()).resolves.toMatchObject({
      valid: false,
      brokenEventNo: '1201',
      reason: 'EVENT_HASH_MISMATCH',
    });
  });
});
