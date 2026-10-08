import { ReportJob } from '../entities/report-job.entity';
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
