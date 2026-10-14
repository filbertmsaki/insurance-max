import { ConflictException } from '@nestjs/common';
import { TiramisRetryService } from './tiramis-retry.service';

describe('TiramisRetryService', () => {
  const makeService = () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'tracking-1',
        status: 'FINAL_SUCCESS',
        isRetryable: true,
      }),
      markRetryScheduled: jest.fn(),
      acquireRetryLock: jest.fn(),
    };
    const service = new TiramisRetryService(
      repository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, repository };
  };

  it('blocks manual retry of an accepted submission', async () => {
    const { service, repository } = makeService();
    await expect(service.retryOne('tracking-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.acquireRetryLock).not.toHaveBeenCalled();
  });

  it('does not schedule a retry after final success', async () => {
    const { service, repository } = makeService();
    await expect(service.scheduleRetry('tracking-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.markRetryScheduled).not.toHaveBeenCalled();
  });
});
