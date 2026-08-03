import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';

import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { TiramisSubmissionTrackingEntity } from '../../tiramis/entities/tiramis-submission-tracking.entity';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import type { TenantDataScope } from '../../shared/authorization/interfaces/tenant-data-scope.interface';
import { CommissionTransaction } from '../billing-commission/entities/commission-transaction.entity';
import { Invoice } from '../billing-commission/entities/invoice.entity';
import { Receipt } from '../billing-commission/entities/receipt.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Policy } from '../policies/entities/policy.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let dataAccessScopeService: jest.Mocked<DataAccessScopeService>;
  let dashboardCacheService: jest.Mocked<DashboardCacheService>;

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    scope: 'company',
    userType: 'COMPANY_USER',
    companyId: 'company-1',
    companyName: 'Alliance',
    companyType: 'INSURANCE_COMPANY' as never,
    companyMembershipId: 'membership-1',
    activeBranchId: 'branch-1',
    assignedBranchIds: ['branch-1'],
    roles: ['USER'],
    permissions: ['dashboard:overview', 'dashboard:sales'],
  };

  const scope: TenantDataScope = {
    userId: 'user-1',
    companyId: 'company-1',
    companyType: 'INSURANCE_COMPANY' as never,
    companyMembershipId: 'membership-1',
    activeBranchId: 'branch-1',
    assignedBranchIds: ['branch-1'],
    allowedBranchIds: ['branch-1'],
    canViewAllBranches: false,
    canViewAssignedBranches: false,
    ownRecordsOnly: false,
    canViewCarrierPortfolio: false,
    canViewIntermediaryPortfolio: false,
    permissions: ['dashboard:overview', 'dashboard:sales'],
  };

  beforeEach(() => {
    dataAccessScopeService = {
      resolve: jest.fn().mockReturnValue(scope),
      assertRequestedBranchAllowed: jest.fn(),
    } as unknown as jest.Mocked<DataAccessScopeService>;

    dashboardCacheService = {
      getOrSet: jest.fn(
        async <T>(
          _section: string,
          _user: AuthenticatedUser,
          _query: unknown,
          factory: () => Promise<T>,
        ) => factory(),
      ),
    } as unknown as jest.Mocked<DashboardCacheService>;

    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        switch (key) {
          case 'app.timezone':
            return 'Africa/Dar_es_Salaam';
          case 'DASHBOARD_MAX_RANGE_DAYS':
            return '366';
          default:
            return fallback;
        }
      }),
    } as unknown as ConfigService;

    service = new DashboardService(
      {} as Repository<Quotation>,
      {} as Repository<Policy>,
      {} as Repository<Customer>,
      {} as Repository<Invoice>,
      {} as Repository<Receipt>,
      {} as Repository<CommissionTransaction>,
      {} as Repository<TiramisSubmissionTrackingEntity>,
      dataAccessScopeService,
      dashboardCacheService,
      configService,
    );
  });

  it('rejects date ranges that exceed DASHBOARD_MAX_RANGE_DAYS', async () => {
    await expect(
      service.getSales(user, {
        from: '2025-01-01',
        to: '2026-08-03',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects branch filters outside the allowed scope', async () => {
    dataAccessScopeService.assertRequestedBranchAllowed.mockImplementation(
      () => {
        throw new ForbiddenException(
          'You are not allowed to access the requested branch',
        );
      },
    );

    await expect(
      service.getOverview(user, {
        from: '2026-08-01',
        to: '2026-08-03',
        branch_id: 'branch-2',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
