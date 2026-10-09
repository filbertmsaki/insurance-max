import { LessThan } from 'typeorm';

import { TiramisCallbackRetentionService } from './tiramis-callback-retention.service';

describe('TiramisCallbackRetentionService', () => {
  function createService(config: Record<string, unknown> = {}) {
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) =>
        key in config ? config[key] : fallback,
      ),
    };
    const deadLetterRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    const receiptRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 3 }),
    };

    const service = new TiramisCallbackRetentionService(
      configService as any,
      deadLetterRepository as any,
      receiptRepository as any,
    );

    return { service, configService, deadLetterRepository, receiptRepository };
  }

  it('does nothing when retention is disabled', async () => {
    const { service, deadLetterRepository, receiptRepository } = createService({
      'tiramisService.callbackDiagnosticsRetentionEnabled': false,
    });

    await expect(service.purgeExpiredDiagnostics()).resolves.toBeNull();
    expect(deadLetterRepository.delete).not.toHaveBeenCalled();
    expect(receiptRepository.delete).not.toHaveBeenCalled();
  });

  it('purges callback diagnostics older than the configured retention window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-09T00:00:00Z'));
    const { service, deadLetterRepository, receiptRepository } = createService({
      'tiramisService.callbackDiagnosticsRetentionEnabled': true,
      'tiramisService.callbackDiagnosticsRetentionDays': 30,
    });

    const result = await service.purgeExpiredDiagnostics();

    expect(result).toEqual(
      expect.objectContaining({
        deadLettersDeleted: 2,
        receiptsDeleted: 3,
      }),
    );
    expect(deadLetterRepository.delete).toHaveBeenCalledWith({
      createdAt: LessThan(new Date('2026-09-09T00:00:00.000Z')),
    });
    expect(receiptRepository.delete).toHaveBeenCalledWith({
      createdAt: LessThan(new Date('2026-09-09T00:00:00.000Z')),
    });

    jest.useRealTimers();
  });
});
