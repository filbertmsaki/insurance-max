import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FinanceController } from '../../finance.controller';
import { FinancePermissions } from '../../governance/finance-permissions/finance.permissions';
import { BillingCommissionController } from './billing-commission.controller';

describe.each([
  [
    'finance',
    FinanceController,
    FinancePermissions.INVOICES_READ,
    'listInvoices',
    'getInvoice',
  ],
  [
    'legacy billing',
    BillingCommissionController,
    'billing:read',
    'findInvoices',
    'findInvoice',
  ],
] as const)(
  '%s invoice read scope',
  (_label, Controller, permission, listMethod, detailMethod) => {
    const user = { companyId: 'company-a' } as AuthenticatedUser;
    const resolve = jest.fn();
    const findInvoices = jest.fn();
    const findInvoice = jest.fn();
    const controller = Object.assign(Object.create(Controller.prototype), {
      dataAccessScope: { resolve },
      billingCommissionService: { findInvoices, findInvoice },
    });
    beforeEach(() => jest.clearAllMocks());

    it.each([
      { canViewAllBranches: false, ownRecordsOnly: false },
      { canViewAllBranches: true, ownRecordsOnly: true },
    ])('denies restricted scopes before accessing invoices', (scope) => {
      resolve.mockReturnValue(scope);
      expect(() => controller[listMethod](user, {})).toThrow(
        'company-wide data access',
      );
      expect(() => controller[detailMethod](user, 'invoice-id')).toThrow(
        'company-wide data access',
      );
      expect(findInvoices).not.toHaveBeenCalled();
      expect(findInvoice).not.toHaveBeenCalled();
      expect(resolve).toHaveBeenCalledWith(user, permission);
    });

    it('preserves the company filter for permitted reads', () => {
      resolve.mockReturnValue({
        canViewAllBranches: true,
        ownRecordsOnly: false,
      });
      controller[listMethod](user, {});
      controller[detailMethod](user, 'invoice-id');
      expect(findInvoices).toHaveBeenCalledWith('company-a', {});
      expect(findInvoice).toHaveBeenCalledWith('company-a', 'invoice-id');
    });
  },
);
