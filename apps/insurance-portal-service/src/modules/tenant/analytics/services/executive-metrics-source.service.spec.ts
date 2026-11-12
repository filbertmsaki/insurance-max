import { ExecutiveMetricsSourceService } from './executive-metrics-source.service';

describe('executive metric data scope', () => {
  it.each([
    'premium.gross_written',
    'premium.commission',
    'tiramis.success_rate',
  ])(
    'does not return company-wide %s to a branch-scoped user',
    async (metric) => {
      const service = new ExecutiveMetricsSourceService(
        {} as any,
        {} as any,
        {} as any,
        {
          resolve: jest.fn().mockReturnValue({
            quotationPolicyDataScope: 'BRANCH',
            ownRecordsOnly: false,
          }),
        } as any,
      );
      await expect(
        service.compute(
          metric,
          { permissions: [] } as any,
          '2026-01-01',
          '2026-01-31',
        ),
      ).resolves.toBeNull();
    },
  );
});
