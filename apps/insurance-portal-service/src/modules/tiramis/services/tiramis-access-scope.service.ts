import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DataScopePermissions } from '../../shared/authorization/data-scope.constants';
import { Customer } from '../../tenant/customers/entities/customer.entity';
import { MotorFleet } from '../../tenant/motor/entities/motor-fleet.entity';
import { MotorPolicyDetail } from '../../tenant/motor/entities/motor-policy-detail.entity';
import { MotorVehicle } from '../../tenant/motor/entities/motor-vehicle.entity';
import { NonMotorPolicyDetail } from '../../tenant/non-motor/entities/non-motor-policy-detail.entity';
import { Policy } from '../../tenant/policies/entities/policy.entity';
import { Quotation } from '../../tenant/quotations/entities/quotation.entity';
import {
  TiramisPermission,
  TiramisPermissions,
} from '../auth/tiramis-permissions.constant';
import { TiramisBusinessRecordEntity } from '../entities/tiramis-business-record.entity';

export interface TiramisAccessScope {
  userId: string;
  authScope: 'platform' | 'company';
  companyId: string | null;
  activeBranchId: string | null;
  assignedBranchIds: string[];
  canAccessAllCompanies: boolean;
  canAccessAllCompanyBranches: boolean;
  permissions: string[];
}

@Injectable()
export class TiramisAccessScopeService {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,

    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,

    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,

    @InjectRepository(MotorVehicle)
    private readonly motorVehicleRepository: Repository<MotorVehicle>,

    @InjectRepository(MotorFleet)
    private readonly motorFleetRepository: Repository<MotorFleet>,

    @InjectRepository(MotorPolicyDetail)
    private readonly motorPolicyDetailRepository: Repository<MotorPolicyDetail>,

    @InjectRepository(NonMotorPolicyDetail)
    private readonly nonMotorPolicyDetailRepository: Repository<NonMotorPolicyDetail>,

    @InjectRepository(TiramisBusinessRecordEntity)
    private readonly businessRecordRepository: Repository<TiramisBusinessRecordEntity>,
  ) {}

  resolveScope(
    authContext?: Partial<AuthenticatedUser> & Record<string, any>,
  ): TiramisAccessScope {
    if (!authContext) {
      throw new UnauthorizedException('Authentication is required');
    }

    const permissions = this.extractPermissions(authContext);

    const authScope = authContext.scope === 'platform' ? 'platform' : 'company';

    const userType = authContext.userType ?? authContext.user_type ?? null;

    const isPlatformAdministrator =
      authScope === 'platform' &&
      ['OWNER', 'SUPER_ADMIN'].includes(String(userType).toUpperCase());

    const companyId =
      authContext.companyId ??
      authContext.activeCompanyId ??
      authContext.active_company_id ??
      null;

    if (authScope === 'company' && !companyId) {
      throw new UnauthorizedException('Active company context is required');
    }

    return {
      userId: authContext.id ?? authContext.sub ?? authContext.userId ?? '',
      authScope,
      companyId,
      activeBranchId:
        authContext.activeBranchId ??
        authContext.branchId ??
        authContext.active_branch_id ??
        null,
      assignedBranchIds: Array.from(
        new Set(
          authContext.assignedBranchIds ??
            authContext.assigned_branch_ids ??
            [],
        ),
      ),

      /*
       * tiramis.admin is administrative access inside the active
       * company. It must never provide cross-company access.
       */
      canAccessAllCompanies: isPlatformAdministrator,

      canAccessAllCompanyBranches:
        isPlatformAdministrator ||
        permissions.includes(DataScopePermissions.COMPANY_ALL),

      permissions,
    };
  }

  assertHasPermission(
    scope: TiramisAccessScope,
    permission: TiramisPermission,
  ): void {
    if (scope.canAccessAllCompanies) {
      return;
    }

    const allowed =
      scope.permissions.includes(permission) ||
      scope.permissions.includes(TiramisPermissions.ADMIN);

    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to perform this TIRAMIS action',
        requiredPermission: permission,
      });
    }
  }

  assertCanAccessCompany(
    scope: TiramisAccessScope,
    requestedCompanyId: string,
  ): void {
    if (!requestedCompanyId) {
      throw new ForbiddenException('A company identifier is required');
    }

    if (scope.canAccessAllCompanies) {
      return;
    }

    if (
      scope.companyId &&
      String(scope.companyId) === String(requestedCompanyId)
    ) {
      return;
    }

    throw new ForbiddenException(
      'You cannot access TIRAMIS records for another company',
    );
  }

  assertCanAccessBranch(
    scope: TiramisAccessScope,
    branchId?: string | null,
  ): void {
    if (!branchId || scope.canAccessAllCompanies) {
      return;
    }

    if (scope.canAccessAllCompanyBranches) {
      return;
    }

    const allowedBranchIds = new Set([
      ...(scope.assignedBranchIds ?? []),
      ...(scope.activeBranchId ? [scope.activeBranchId] : []),
    ]);

    if (!allowedBranchIds.has(branchId)) {
      throw new ForbiddenException(
        'You cannot access TIRAMIS records for this branch',
      );
    }
  }

  async assertCanAccessBusinessRecord(params: {
    scope: TiramisAccessScope;
    requestType: string;
    sourceModule: string;
    sourceRecordId: string;
  }) {
    const sourceModule = String(params.sourceModule)
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');

    const sourceRecordId = params.sourceRecordId?.trim();

    if (!sourceRecordId) {
      throw new ForbiddenException('A source record identifier is required');
    }

    if (['quotations', 'quotation'].includes(sourceModule)) {
      const quotation = await this.quotationRepository.findOne({
        where: { id: sourceRecordId },
        select: {
          id: true,
          company_id: true,
          branch_id: true,
          created_by: true,
        },
      });

      if (!quotation) {
        throw new ForbiddenException('Quotation source record was not found');
      }

      this.assertCanAccessCompany(params.scope, quotation.company_id);
      this.assertCanAccessBranch(params.scope, quotation.branch_id);

      return {
        businessCompanyId: quotation.company_id,
        businessBranchId: quotation.branch_id,
        sourceModule,
        sourceRecordId,
        requestType: params.requestType,
      };
    }

    if (['policies', 'policy', 'reinsurance'].includes(sourceModule)) {
      const policy = await this.policyRepository.findOne({
        where: { id: sourceRecordId },
        select: {
          id: true,
          company_id: true,
          branch_id: true,
          created_by: true,
        },
      });

      if (!policy) {
        throw new ForbiddenException('Policy source record was not found');
      }

      this.assertCanAccessCompany(params.scope, policy.company_id);
      this.assertCanAccessBranch(params.scope, policy.branch_id);

      return {
        businessCompanyId: policy.company_id,
        businessBranchId: policy.branch_id,
        sourceModule,
        sourceRecordId,
        requestType: params.requestType,
      };
    }

    if (['customers', 'customer'].includes(sourceModule)) {
      const customer = await this.customerRepository.findOne({
        where: { id: sourceRecordId },
        select: {
          id: true,
          company_id: true,
          created_by: true,
        },
      });

      if (!customer) {
        throw new ForbiddenException('Customer source record was not found');
      }

      this.assertCanAccessCompany(params.scope, customer.company_id);

      /*
       * Until customer branch ownership exists, only company-wide
       * users or the creator may submit verification for a customer.
       */
      if (
        !params.scope.canAccessAllCompanies &&
        !params.scope.canAccessAllCompanyBranches &&
        customer.created_by !== params.scope.userId
      ) {
        throw new ForbiddenException(
          'You cannot submit this customer record to TIRAMIS',
        );
      }

      return {
        businessCompanyId: customer.company_id,
        businessBranchId: null,
        sourceModule,
        sourceRecordId,
        requestType: params.requestType,
      };
    }

    if (
      ['motor-vehicles', 'motor-vehicle', 'vehicles'].includes(sourceModule)
    ) {
      const vehicle = await this.motorVehicleRepository.findOne({
        where: { id: sourceRecordId },
        select: {
          id: true,
          company_id: true,
        },
      });

      if (!vehicle) {
        throw new ForbiddenException(
          'Motor vehicle source record was not found',
        );
      }

      this.assertCanAccessCompany(params.scope, vehicle.company_id);

      if (
        !params.scope.canAccessAllCompanies &&
        !params.scope.canAccessAllCompanyBranches
      ) {
        throw new ForbiddenException(
          'Company-wide access is required for motor-vehicle verification until vehicle branch ownership is implemented',
        );
      }

      return {
        businessCompanyId: vehicle.company_id,
        businessBranchId: null,
        sourceModule,
        sourceRecordId,
        requestType: params.requestType,
      };
    }

    if (['motor-fleet', 'motor-fleets'].includes(sourceModule)) {
      const fleet = await this.motorFleetRepository.findOne({
        where: { id: sourceRecordId },
        relations: {
          quotation: true,
        },
      });

      if (!fleet) {
        throw new ForbiddenException('Motor fleet source record was not found');
      }

      this.assertCanAccessCompany(params.scope, fleet.company_id);
      this.assertCanAccessBranch(
        params.scope,
        fleet.quotation?.branch_id ?? null,
      );

      return {
        businessCompanyId: fleet.company_id,
        businessBranchId: fleet.quotation?.branch_id ?? null,
        sourceModule,
        sourceRecordId,
        requestType: params.requestType,
      };
    }

    if (
      ['cover-notes', 'motor', 'motor-policy-details'].includes(sourceModule)
    ) {
      const detail = await this.motorPolicyDetailRepository.findOne({
        where: { id: sourceRecordId },
        relations: {
          policy: true,
        },
      });

      if (detail?.policy) {
        this.assertCanAccessCompany(params.scope, detail.policy.company_id);
        this.assertCanAccessBranch(params.scope, detail.policy.branch_id);

        return {
          businessCompanyId: detail.policy.company_id,
          businessBranchId: detail.policy.branch_id,
          sourceModule,
          sourceRecordId,
          requestType: params.requestType,
        };
      }
    }

    if (
      ['cover-notes', 'non-motor', 'non-motor-policy-details'].includes(
        sourceModule,
      )
    ) {
      const detail = await this.nonMotorPolicyDetailRepository.findOne({
        where: { id: sourceRecordId },
        relations: {
          policy: true,
        },
      });

      if (detail?.policy) {
        this.assertCanAccessCompany(params.scope, detail.policy.company_id);
        this.assertCanAccessBranch(params.scope, detail.policy.branch_id);

        return {
          businessCompanyId: detail.policy.company_id,
          businessBranchId: detail.policy.branch_id,
          sourceModule,
          sourceRecordId,
          requestType: params.requestType,
        };
      }
    }

    if (
      [
        'claims',
        'claim-records',
        'tiramis-claims',
        'verifications',
        'verification',
        'tiramis-verifications',
      ].includes(sourceModule)
    ) {
      const record = await this.businessRecordRepository.findOne({
        where: {
          id: sourceRecordId,
        },
      });

      if (!record) {
        throw new ForbiddenException('TIRAMIS business record was not found');
      }

      this.assertCanAccessCompany(params.scope, record.companyId);
      this.assertCanAccessBranch(params.scope, record.branchId);

      return {
        businessCompanyId: record.companyId,
        businessBranchId: record.branchId,
        sourceModule,
        sourceRecordId,
        requestType: params.requestType,
      };
    }

    throw new ForbiddenException(
      `Unsupported TIRAMIS source module: ${sourceModule}`,
    );
  }

  private extractPermissions(authContext: Record<string, any>): string[] {
    const values = [
      ...(Array.isArray(authContext.permissions)
        ? authContext.permissions
        : []),
      ...(Array.isArray(authContext.permissionCodes)
        ? authContext.permissionCodes
        : []),
      ...(Array.isArray(authContext.permission_codes)
        ? authContext.permission_codes
        : []),
    ];

    return Array.from(
      new Set(
        values
          .map((permission) => {
            if (typeof permission === 'string') {
              return permission;
            }

            return (
              permission?.name ??
              permission?.code ??
              permission?.permission_code ??
              null
            );
          })
          .filter(Boolean)
          .map((permission) => String(permission).trim()),
      ),
    );
  }
}
