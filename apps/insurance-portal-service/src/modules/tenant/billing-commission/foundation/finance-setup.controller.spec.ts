import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FinanceSetupController } from './finance-setup.controller';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

describe('Finance setup API authority boundaries', () => {
  const scope = { legalEntityId: randomUUID(), bookId: randomUUID() };
  const user = {
    id: randomUUID(),
    companyId: randomUUID(),
    scope: 'company',
    userType: 'COMPANY_USER',
  } as AuthenticatedUser;
  const setup = {
      create: jest.fn(),
      transition: jest.fn(),
      overview: jest.fn(),
    },
    ledger = { resolveIdentity: jest.fn() },
    configuration = { policyDecision: jest.fn() };
  const controller = new FinanceSetupController(
    setup as any,
    ledger as any,
    configuration as any,
    {} as any,
  );
  beforeEach(() => jest.clearAllMocks());
  it.each(['ACTIVATE', 'DEACTIVATE', 'RELEASE', 'DEPLOY'])(
    'rejects %s even when a policy decision endpoint is reached',
    async (action) => {
      await expect(
        controller.decidePolicy(user, randomUUID(), {
          scope,
          subjectHash: 'a'.repeat(64),
          action,
          evidenceHash: 'b'.repeat(64),
          reason: 'Synthetic only',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(configuration.policyDecision).not.toHaveBeenCalled();
    },
  );
  it('rejects request-supplied identity, tenant or admin overrides', async () => {
    await expect(
      controller.create(user, {
        scope,
        input: {},
        reason: 'test',
        actor: { subjectId: randomUUID() },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(ledger.resolveIdentity).not.toHaveBeenCalled();
  });
  it('rejects platform identity and unauthenticated company context', async () => {
    await expect(
      controller.overview({ ...user, scope: 'platform' }, scope),
    ).rejects.toThrow(ForbiddenException);
    expect(setup.overview).not.toHaveBeenCalled();
  });
  it('resolves identity from the current user and passes only selected book identifiers', async () => {
    const actor = { subjectId: randomUUID() };
    ledger.resolveIdentity.mockResolvedValue(actor);
    setup.overview.mockResolvedValue({});
    await controller.overview(user, scope);
    expect(ledger.resolveIdentity).toHaveBeenCalledWith(user, scope);
    expect(setup.overview).toHaveBeenCalledWith(actor, scope);
  });
});
