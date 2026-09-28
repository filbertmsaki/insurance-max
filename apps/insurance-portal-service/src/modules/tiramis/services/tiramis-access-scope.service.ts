import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { DataScopePermissions } from '../../shared/authorization/data-scope.constants';
import { ClaimAssessment } from '../../tenant/claims/entities/claim-assessment.entity';
import { ClaimDischargeVoucher } from '../../tenant/claims/entities/claim-discharge-voucher.entity';
import { InsuranceClaim } from '../../tenant/claims/entities/claim.entity';
import { ClaimIntimation } from '../../tenant/claims/entities/claim-intimation.entity';
import { ClaimPayment } from '../../tenant/claims/entities/claim-payment.entity';
import { ClaimRejection } from '../../tenant/claims/entities/claim-rejection.entity';
import { Customer } from '../../tenant/customers/entities/customer.entity';
import { MotorFleet } from '../../tenant/motor/entities/motor-fleet.entity';
import { MotorPolicyDetail } from '../../tenant/motor/entities/motor-policy-detail.entity';
import { MotorVehicle } from '../../tenant/motor/entities/motor-vehicle.entity';
import { NonMotorPolicyDetail } from '../../tenant/non-motor/entities/non-motor-policy-detail.entity';
import { Policy } from '../../tenant/policies/entities/policy.entity';
import { Quotation } from '../../tenant/quotations/entities/quotation.entity';
import { ReinsuranceDeclaration } from '../../tenant/reinsurance/entities/reinsurance-declaration.entity';
import {
  TiramisPermission,
  TiramisPermissions,
} from '../auth/tiramis-permissions.constant';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
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
    private readonly dataSource: DataSource,

    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,

    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,

    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,

    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,

    @InjectRepository(ClaimIntimation)
    private readonly claimIntimationRepository: Repository<ClaimIntimation>,

    @InjectRepository(ClaimAssessment)
    private readonly claimAssessmentRepository: Repository<ClaimAssessment>,

    @InjectRepository(ClaimDischargeVoucher)
    private readonly dischargeRepository: Repository<ClaimDischargeVoucher>,

    @InjectRepository(ClaimPayment)
    private readonly claimPaymentRepository: Repository<ClaimPayment>,

    @InjectRepository(ClaimRejection)
    private readonly claimRejectionRepository: Repository<ClaimRejection>,

    @InjectRepository(MotorVehicle)
    private readonly motorVehicleRepository: Repository<MotorVehicle>,

    @InjectRepository(MotorFleet)
    private readonly motorFleetRepository: Repository<MotorFleet>,

    @InjectRepository(MotorPolicyDetail)
    private readonly motorPolicyDetailRepository: Repository<MotorPolicyDetail>,

    @InjectRepository(NonMotorPolicyDetail)
    private readonly nonMotorPolicyDetailRepository: Repository<NonMotorPolicyDetail>,

    @InjectRepository(ReinsuranceDeclaration)
    private readonly reinsuranceDeclarationRepository: Repository<ReinsuranceDeclaration>,

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

    if (params.requestType === TiramisRequestType.REINSURANCE) {
      const declaration = await this.reinsuranceDeclarationRepository.findOne({
        where: { id: sourceRecordId },
        select: {
          id: true,
          company_id: true,
          branch_id: true,
          policy_id: true,
          cession_id: true,
        },
      });

      if (!declaration) {
        throw new ForbiddenException('Reinsurance declaration was not found');
      }

      this.assertCanAccessCompany(params.scope, declaration.company_id);
      this.assertCanAccessBranch(params.scope, declaration.branch_id);

      return {
        businessCompanyId: declaration.company_id,
        businessBranchId: declaration.branch_id,
        sourceModule: 'reinsurance',
        sourceRecordId: declaration.id,
        requestType: params.requestType,
      };
    }

    if (['policies', 'policy'].includes(sourceModule)) {
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

    if (['policy-transactions', 'policy-transaction'].includes(sourceModule)) {
      const rows = await this.dataSource.query(
        `
          SELECT
            tx.id,
            tx.company_id,
            policy.branch_id
          FROM policy_transactions tx
          INNER JOIN policies policy
            ON policy.id = tx.source_policy_id
          WHERE tx.id = $1
          LIMIT 1
        `,
        [sourceRecordId],
      );
      const transaction = rows?.[0] as
        | { id: string; company_id: string; branch_id: string | null }
        | undefined;

      if (!transaction) {
        throw new ForbiddenException(
          'Policy transaction source record was not found',
        );
      }

      this.assertCanAccessCompany(params.scope, transaction.company_id);
      this.assertCanAccessBranch(params.scope, transaction.branch_id);

      return {
        businessCompanyId: transaction.company_id,
        businessBranchId: transaction.branch_id,
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
        TiramisRequestType.CLAIM_NOTIFICATION,
        TiramisRequestType.CLAIM_INTIMATION,
        TiramisRequestType.CLAIM_ASSESSMENT,
        TiramisRequestType.DISCHARGE_VOUCHER,
        TiramisRequestType.CLAIM_PAYMENT,
        TiramisRequestType.CLAIM_REJECTION,
      ].includes(params.requestType as TiramisRequestType)
    ) {
      const claimAccess = await this.resolveClaimBusinessAccess({
        requestType: params.requestType as TiramisRequestType,
        sourceRecordId,
      });

      this.assertCanAccessCompany(params.scope, claimAccess.companyId);
      this.assertCanAccessBranch(params.scope, claimAccess.branchId);

      return {
        businessCompanyId: claimAccess.companyId,
        businessBranchId: claimAccess.branchId,
        sourceModule: 'claims',
        sourceRecordId,
        requestType: params.requestType,
      };
    }

    if (
      ['verifications', 'verification', 'tiramis-verifications'].includes(
        sourceModule,
      )
    ) {
      const record = await this.findVerificationBusinessRecord(
        sourceModule,
        params.requestType,
        sourceRecordId,
      );

      if (record) {
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

      return {
        businessCompanyId: params.scope.companyId,
        businessBranchId: params.scope.activeBranchId,
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

  private async findVerificationBusinessRecord(
    sourceModule: string,
    requestType: string,
    sourceRecordId: string,
  ) {
    const normalizedSourceModules = [sourceModule];

    if (sourceModule === 'verification') {
      normalizedSourceModules.push('verifications');
    }

    if (sourceModule === 'verifications') {
      normalizedSourceModules.push('verification');
    }

    const query = this.businessRecordRepository
      .createQueryBuilder('record')
      .where('record.requestType = :requestType', { requestType })
      .andWhere('record.sourceModule IN (:...sourceModules)', {
        sourceModules: normalizedSourceModules,
      })
      .andWhere('record.deletedAt IS NULL')
      .orderBy('record.createdAt', 'DESC');

    if (this.isUuid(sourceRecordId)) {
      query.andWhere(
        '(record.id = :recordId OR record.businessReference = :sourceRecordId OR CAST(record.payload AS text) ILIKE :payloadNeedle)',
        {
          recordId: sourceRecordId,
          sourceRecordId,
          payloadNeedle: `%${sourceRecordId}%`,
        },
      );
    } else {
      query.andWhere(
        '(record.businessReference = :sourceRecordId OR CAST(record.payload AS text) ILIKE :payloadNeedle)',
        {
          sourceRecordId,
          payloadNeedle: `%${sourceRecordId}%`,
        },
      );
    }

    return query.getOne();
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private async resolveClaimBusinessAccess(params: {
    requestType: TiramisRequestType;
    sourceRecordId: string;
  }): Promise<{
    companyId: string;
    branchId: string | null;
    claimId: string;
  }> {
    switch (params.requestType) {
      case TiramisRequestType.CLAIM_NOTIFICATION: {
        const claim = await this.claimRepository.findOne({
          where: { id: params.sourceRecordId },
          select: {
            id: true,
            company_id: true,
            branch_id: true,
          },
        });

        if (!claim) {
          throw new ForbiddenException('Claim source record was not found');
        }

        return {
          companyId: claim.company_id,
          branchId: claim.branch_id,
          claimId: claim.id,
        };
      }

      case TiramisRequestType.CLAIM_INTIMATION: {
        const record = await this.claimIntimationRepository.findOne({
          where: { id: params.sourceRecordId },
          select: {
            id: true,
            company_id: true,
            branch_id: true,
            claim_id: true,
          },
        });

        if (!record) {
          throw new ForbiddenException(
            'Claim intimation source record was not found',
          );
        }

        return {
          companyId: record.company_id,
          branchId: record.branch_id,
          claimId: record.claim_id,
        };
      }

      case TiramisRequestType.CLAIM_ASSESSMENT: {
        const record = await this.claimAssessmentRepository.findOne({
          where: { id: params.sourceRecordId },
          select: {
            id: true,
            company_id: true,
            branch_id: true,
            claim_id: true,
          },
        });

        if (!record) {
          throw new ForbiddenException(
            'Claim assessment source record was not found',
          );
        }

        return {
          companyId: record.company_id,
          branchId: record.branch_id,
          claimId: record.claim_id,
        };
      }

      case TiramisRequestType.DISCHARGE_VOUCHER: {
        const record = await this.dischargeRepository.findOne({
          where: { id: params.sourceRecordId },
          select: {
            id: true,
            company_id: true,
            branch_id: true,
            claim_id: true,
          },
        });

        if (!record) {
          throw new ForbiddenException(
            'Claim discharge voucher source record was not found',
          );
        }

        return {
          companyId: record.company_id,
          branchId: record.branch_id,
          claimId: record.claim_id,
        };
      }

      case TiramisRequestType.CLAIM_PAYMENT: {
        const record = await this.claimPaymentRepository.findOne({
          where: { id: params.sourceRecordId },
          select: {
            id: true,
            company_id: true,
            branch_id: true,
            claim_id: true,
          },
        });

        if (!record) {
          throw new ForbiddenException(
            'Claim payment source record was not found',
          );
        }

        return {
          companyId: record.company_id,
          branchId: record.branch_id,
          claimId: record.claim_id,
        };
      }

      case TiramisRequestType.CLAIM_REJECTION: {
        const record = await this.claimRejectionRepository.findOne({
          where: { id: params.sourceRecordId },
          select: {
            id: true,
            company_id: true,
            branch_id: true,
            claim_id: true,
          },
        });

        if (!record) {
          throw new ForbiddenException(
            'Claim rejection source record was not found',
          );
        }

        return {
          companyId: record.company_id,
          branchId: record.branch_id,
          claimId: record.claim_id,
        };
      }

      default:
        throw new ForbiddenException(
          `Unsupported claim request type: ${params.requestType}`,
        );
    }
  }
}
