import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestContextService } from '@insurance-max/shared-kernel';

import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let saved: Partial<AuditLog> | undefined;

  beforeEach(async () => {
    saved = undefined;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: (input: Partial<AuditLog>) => input,
            findOne: jest.fn().mockResolvedValue(null),
            save: (entity: Partial<AuditLog>) => {
              saved = entity;
              return Promise.resolve(entity);
            },
          },
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
  });
});
