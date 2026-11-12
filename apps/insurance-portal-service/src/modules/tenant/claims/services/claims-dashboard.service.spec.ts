import { ClaimsDashboardService } from './claims-dashboard.service';

describe('claims dashboard access scope', () => {
  it.each([
    [['claims:read'], 'claims:read'],
    [['claims:dashboard'], 'claims:dashboard'],
  ])(
    'resolves the scope for the granted permission',
    (permissions, expected) => {
      const query: any = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
      };
      const scope = {
        resolve: jest.fn().mockReturnValue({}),
        applyClaimReadScope: jest.fn(),
      };
      const service = new ClaimsDashboardService(
        { createQueryBuilder: jest.fn().mockReturnValue(query) } as any,
        scope as any,
      );
      const user = { permissions };
      (service as any).scoped(user, {});
      expect(scope.resolve).toHaveBeenCalledWith(user, expected);
      expect(scope.applyClaimReadScope).toHaveBeenCalledWith(
        query,
        'claim',
        expect.any(Object),
      );
    },
  );
});
