import { ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  FinanceScopeService,
  type FinancePrincipal,
} from './finance-scope.service';

describe('Finance draft scope input boundaries', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  const selection = { legalEntityId: id, bookId: id };

  it.each([
    null,
    undefined,
    { companyId: id, scope: 'company', userType: 'SUPER_ADMIN' },
    { tenantId: id, subjectId: id, kind: 'ADMIN' },
    { tenantId: 'not-a-uuid', subjectId: id, kind: 'USER' },
    { tenantId: id, subjectId: '', kind: 'WORKER' },
  ])(
    'denies absent or legacy-only identity before querying (%j)',
    async (principal) => {
      const getRepository = jest.fn();
      const service = new FinanceScopeService({
        getRepository,
      } as unknown as DataSource);
      await expect(
        service.resolveDraftRead(principal as FinancePrincipal, selection),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(getRepository).not.toHaveBeenCalled();
    },
  );

  it.each([
    { legalEntityId: '', bookId: id },
    { legalEntityId: id, bookId: "' OR 1=1 --" },
  ])(
    'denies malformed scope selection before querying (%j)',
    async (request) => {
      const getRepository = jest.fn();
      const service = new FinanceScopeService({
        getRepository,
      } as unknown as DataSource);
      await expect(
        service.resolveDraftRead(
          { tenantId: id, subjectId: id, kind: 'USER' },
          request,
        ),
      ).rejects.toMatchObject({ response: { code: 'FINANCE_SCOPE_DENIED' } });
      expect(getRepository).not.toHaveBeenCalled();
    },
  );
});
