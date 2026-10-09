import { ForbiddenException } from '@nestjs/common';
import { QuotationPolicyDataScope } from '../../../shared/authorization/quotation-policy-data-scope.enum';
import { ReportJobStatus } from '../enums/reporting.enums';
import { ReportScheduleService } from './report-schedule.service';

describe('ReportScheduleService worker claims', () => {
  it('claims pending work under a pessimistic lock and saves it within the transaction', async () => {
    const job = { status: ReportJobStatus.PENDING, attempts: 2 };
    const builder: any = {
      setLock: jest.fn(() => builder),
      setOnLocked: jest.fn(() => builder),
      where: jest.fn(() => builder),
      orderBy: jest.fn(() => builder),
      getOne: jest.fn().mockResolvedValue(job),
    };
    const save = jest.fn(async (value) => value);
    const getRepository = jest.fn(() => ({
      createQueryBuilder: jest.fn(() => builder),
      save,
    }));
    const transaction = jest.fn(async (callback) =>
      callback({ getRepository }),
    );
    const service = new ReportScheduleService(
      {} as any,
      {} as any,
      { manager: { transaction } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.claimNextPendingJob('worker-1')).resolves.toBe(job);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(builder.setOnLocked).toHaveBeenCalledWith('skip_locked');
    expect(job).toMatchObject({
      status: ReportJobStatus.RUNNING,
      claimed_by: 'worker-1',
      attempts: 3,
    });
    expect(save).toHaveBeenCalledWith(job);
  });

  it('returns no work when all pending jobs are locked by other workers', async () => {
    const builder: any = {
      setLock: jest.fn(() => builder),
      setOnLocked: jest.fn(() => builder),
      where: jest.fn(() => builder),
      orderBy: jest.fn(() => builder),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const save = jest.fn();
    const transaction = jest.fn(async (callback) =>
      callback({
        getRepository: () => ({
          createQueryBuilder: () => builder,
          save,
        }),
      }),
    );
    const service = new ReportScheduleService(
      {} as any,
      {} as any,
      { manager: { transaction } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.claimNextPendingJob()).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('ReportScheduleService claims report data scope', () => {
  const claimsDefinition = {
    id: 'definition-1',
    code: 'CLAIMS_REGISTER',
    generator_key: 'claims',
  };

  function makeService(params: { job?: any; scope?: Record<string, unknown> }) {
    const generator = {
      generate: jest.fn().mockRejectedValue(new Error('stop after context')),
    };
    const jobRepository = {
      findOneBy: jest.fn().mockResolvedValue(params.job),
      save: jest.fn(async (value) => value),
    };
    const dataAccessScopeService = {
      resolve: jest.fn().mockReturnValue(params.scope),
      assertRequestedBranchAllowed: jest.fn(),
    };
    const service = new ReportScheduleService(
      { findOneBy: jest.fn().mockResolvedValue(claimsDefinition) } as any,
      {} as any,
      jobRepository as any,
      {} as any,
      {} as any,
      {} as any,
      { getGenerator: jest.fn().mockReturnValue(generator) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataAccessScopeService as any,
    );

    return { service, generator, jobRepository };
  }

  it('limits a branch-scoped user to their branches', () => {
    const { service } = makeService({
      scope: {
        quotationPolicyDataScope: QuotationPolicyDataScope.BRANCH,
        allowedBranchIds: ['branch-a'],
      },
    });

    const scoped = (service as any).applyReportDataScope(
      { id: 'user-1', companyId: 'company-1' },
      claimsDefinition,
      {},
    );

    expect(scoped.reportingScope).toEqual({
      quotationPolicyDataScope: QuotationPolicyDataScope.BRANCH,
      branchIds: ['branch-a'],
    });
  });

  it('passes the stored branch scope to the claims generator', async () => {
    const job = {
      id: 'job-1',
      company_id: 'company-1',
      definition_id: 'definition-1',
      execution_context: {
        reportingScope: {
          quotationPolicyDataScope: QuotationPolicyDataScope.BRANCH,
          branchIds: ['branch-a'],
        },
      },
    };
    const { service, generator } = makeService({ job });

    await expect(service.executeJob('job-1')).rejects.toThrow(
      'stop after context',
    );
    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedBranchIds: ['branch-a'],
        quotationPolicyDataScope: QuotationPolicyDataScope.BRANCH,
      }),
    );
  });

  it('fails a claims job that carries no resolved scope instead of exporting the whole company', async () => {
    const job = {
      id: 'job-1',
      company_id: 'company-1',
      definition_id: 'definition-1',
      execution_context: { reportingScope: null },
    };
    const { service, generator, jobRepository } = makeService({ job });

    await expect(service.executeJob('job-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(generator.generate).not.toHaveBeenCalled();
    expect(jobRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: ReportJobStatus.FAILED }),
    );
  });
});
