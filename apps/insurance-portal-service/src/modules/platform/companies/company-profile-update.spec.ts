import { CompaniesService } from './companies.service';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

describe('company profile updates', () => {
  const actor = {
    id: 'user',
    companyId: 'company',
    companyMembershipId: 'membership',
    scope: 'company',
  } as AuthenticatedUser;
  it('updates the current company and writes the changed fields to the same transaction audit', async () => {
    const company = {
      id: 'company',
      tin: 'old',
      name: 'Alliance',
      settings: {},
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(company),
      save: jest.fn(async (row) => row),
    };
    const manager = { getRepository: jest.fn().mockReturnValue(repo) };
    const audit = { logCritical: jest.fn().mockResolvedValue(undefined) };
    const service = Object.create(
      CompaniesService.prototype,
    ) as CompaniesService;
    (service as any).companyRepository = {
      manager: { transaction: (work: any) => work(manager) },
    };
    (service as any).auditService = audit;
    await service.updateCompany('company', { tin: null } as any, actor);
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'company' },
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(audit.logCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user',
        companyId: 'company',
        beforeState: { tin: 'old' },
        afterState: { tin: null },
      }),
      manager,
    );
  });
  it('does not report success if critical audit logging fails', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'company', tin: 'old' }),
      save: jest.fn(async (row) => row),
    };
    const manager = { getRepository: jest.fn().mockReturnValue(repo) };
    const service = Object.create(
      CompaniesService.prototype,
    ) as CompaniesService;
    (service as any).companyRepository = {
      manager: { transaction: (work: any) => work(manager) },
    };
    (service as any).auditService = {
      logCritical: jest.fn().mockRejectedValue(new Error('audit unavailable')),
    };
    await expect(
      service.updateCompany('company', { tin: 'new' }, actor),
    ).rejects.toThrow('audit unavailable');
  });
  it('refuses to update another company through a company session', async () => {
    const service = Object.create(
      CompaniesService.prototype,
    ) as CompaniesService;
    await expect(
      service.updateCompany('other-company', { tin: 'new' }, actor),
    ).rejects.toThrow('A current company session is required');
  });
});
