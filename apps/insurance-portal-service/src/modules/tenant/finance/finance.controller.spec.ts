import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FinanceController } from './finance.controller';
import { FinancePermissions } from './governance/finance-permissions/finance.permissions';

describe('Finance dashboard scope boundary', () => {
  const user = { companyId: 'company-1' } as AuthenticatedUser;
  const summary = jest.fn().mockResolvedValue({ openInvoices: [] });
  const receivableAging = jest.fn().mockResolvedValue([]);
  const resolve = jest.fn();
  const controller = Object.assign(Object.create(FinanceController.prototype), {
    financeDashboardService: { summary, receivableAging },
    dataAccessScope: { resolve },
  }) as FinanceController;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects company totals for branch-scoped and own-records users', () => {
    resolve.mockReturnValueOnce({
      canViewAllBranches: false,
      ownRecordsOnly: false,
    });
    expect(() => controller.getDashboardSummary(user)).toThrow(
      'Company-wide Finance dashboard requires company-wide data access.',
    );
    resolve.mockReturnValueOnce({
      canViewAllBranches: true,
      ownRecordsOnly: true,
    });
    expect(() => controller.getDashboardSummary(user)).toThrow(
      'Company-wide Finance dashboard requires company-wide data access.',
    );
    expect(summary).not.toHaveBeenCalled();
  });

  it('returns totals only after a company-wide scope check', async () => {
    resolve.mockReturnValue({
      canViewAllBranches: true,
      ownRecordsOnly: false,
    });
    await expect(controller.getDashboardSummary(user)).resolves.toEqual({
      openInvoices: [],
    });
    expect(resolve).toHaveBeenCalledWith(user, FinancePermissions.DASHBOARD);
    expect(summary).toHaveBeenCalledWith('company-1');
  });

  it('requires company-wide invoice access for receivable aging', async () => {
    resolve.mockReturnValueOnce({
      canViewAllBranches: false,
      ownRecordsOnly: false,
    });
    expect(() => controller.getReceivableAging(user)).toThrow(
      'Company-wide receivable aging requires company-wide data access.',
    );
    resolve.mockReturnValueOnce({
      canViewAllBranches: true,
      ownRecordsOnly: true,
    });
    expect(() => controller.getReceivableAging(user)).toThrow();
    expect(receivableAging).not.toHaveBeenCalled();
    resolve.mockReturnValueOnce({
      canViewAllBranches: true,
      ownRecordsOnly: false,
    });
    await expect(controller.getReceivableAging(user)).resolves.toEqual([]);
    expect(resolve).toHaveBeenCalledWith(
      user,
      FinancePermissions.INVOICES_READ,
    );
    expect(receivableAging).toHaveBeenCalledWith('company-1');
  });
});
