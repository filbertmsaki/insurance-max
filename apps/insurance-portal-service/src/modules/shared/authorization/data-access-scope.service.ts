import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import { DataScopePermissions } from './data-scope.constants';
import type { TenantDataScope } from './interfaces/tenant-data-scope.interface';

@Injectable()
export class DataAccessScopeService {
  resolve(user: AuthenticatedUser): TenantDataScope {
    if (
      user.scope !== 'company' ||
      !user.companyId ||
      !user.companyType ||
      !user.companyMembershipId
    ) {
      throw new UnauthorizedException(
        'An active company membership is required',
      );
    }

    const permissions = new Set(user.permissions ?? []);

    const canViewAllBranches = permissions.has(
      DataScopePermissions.COMPANY_ALL,
    );

    const canViewAssignedBranches =
      !canViewAllBranches &&
      permissions.has(DataScopePermissions.ASSIGNED_BRANCHES);

    const assignedBranchIds = Array.from(new Set(user.assignedBranchIds ?? []));

    let allowedBranchIds: string[] = [];

    if (canViewAssignedBranches) {
      allowedBranchIds = assignedBranchIds;
    } else if (!canViewAllBranches && user.activeBranchId) {
      allowedBranchIds = [user.activeBranchId];
    }

    const ownRecordsOnly =
      permissions.has(DataScopePermissions.OWN_RECORDS) ||
      ['AGENT', 'BROKER', 'CUSTOMER'].includes(user.userType);

    /*
     * Partner portfolio access is intentionally restricted to users
     * who also have company-wide access.
     *
     * Branch-level partner ownership is not yet represented by a
     * servicing_branch_id or intermediary_branch_id field.
     */
    const canViewPartnerPortfolio =
      canViewAllBranches &&
      permissions.has(DataScopePermissions.PARTNER_PORTFOLIO);

    return {
      userId: user.id,
      companyId: user.companyId,
      companyType: user.companyType,
      companyMembershipId: user.companyMembershipId,

      activeBranchId: user.activeBranchId ?? null,
      assignedBranchIds,
      allowedBranchIds,

      canViewAllBranches,
      canViewAssignedBranches,
      ownRecordsOnly,

      canViewCarrierPortfolio:
        canViewPartnerPortfolio &&
        user.companyType === CompanyType.INSURANCE_COMPANY,

      canViewIntermediaryPortfolio:
        canViewPartnerPortfolio &&
        [
          CompanyType.AGENCY,
          CompanyType.BROKER,
          CompanyType.BANCASSURANCE,
        ].includes(user.companyType),

      permissions: [...permissions],
    };
  }

  assertRequestedBranchAllowed(
    scope: TenantDataScope,
    requestedBranchId?: string | null,
  ): void {
    if (!requestedBranchId || scope.canViewAllBranches) {
      return;
    }

    if (!scope.allowedBranchIds.includes(requestedBranchId)) {
      throw new ForbiddenException(
        'You are not allowed to access the requested branch',
      );
    }
  }

  /**
   * Read access for quotations.
   *
   * Own-company records are branch restricted.
   * Partner portfolio records are available only to users with
   * company-wide partner-portfolio permission.
   */
  applyQuotationReadScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    queryBuilder.setParameters({
      scopeCompanyId: scope.companyId,
      scopeUserId: scope.userId,
      scopeBranchIds: scope.allowedBranchIds,
    });

    queryBuilder.andWhere(
      new Brackets((participationQuery) => {
        participationQuery.where(this.buildOwnedRecordCondition(alias, scope));

        if (scope.canViewCarrierPortfolio) {
          participationQuery.orWhere(
            `${alias}.insurer_company_id = :scopeCompanyId`,
          );
        }

        if (scope.canViewIntermediaryPortfolio) {
          participationQuery.orWhere(
            `${alias}.intermediary_company_id = :scopeCompanyId`,
          );
        }
      }),
    );

    /*
     * Agents and individually scoped users must not receive records
     * created by another organization through partner access.
     */
    if (scope.ownRecordsOnly) {
      queryBuilder.andWhere(`${alias}.created_by = :scopeUserId`);
    }
  }

  applyPolicyReadScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    queryBuilder.setParameters({
      scopeCompanyId: scope.companyId,
      scopeUserId: scope.userId,
      scopeBranchIds: scope.allowedBranchIds,
    });

    queryBuilder.andWhere(
      new Brackets((participationQuery) => {
        participationQuery.where(this.buildOwnedRecordCondition(alias, scope));

        if (scope.canViewCarrierPortfolio) {
          participationQuery.orWhere(
            `${alias}.insurer_company_id = :scopeCompanyId`,
          );
        }

        if (scope.canViewIntermediaryPortfolio) {
          participationQuery.orWhere(
            `${alias}.intermediary_company_id = :scopeCompanyId`,
          );
        }
      }),
    );

    if (scope.ownRecordsOnly) {
      queryBuilder.andWhere(`${alias}.created_by = :scopeUserId`);
    }
  }

  /**
   * Write operations must initially be limited to records owned by
   * the active company.
   *
   * An insurer must not directly modify an agency-owned quotation.
   * Insurer approval should later use a dedicated approval operation.
   */
  applyOwnedRecordWriteScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    queryBuilder.setParameters({
      scopeCompanyId: scope.companyId,
      scopeUserId: scope.userId,
      scopeBranchIds: scope.allowedBranchIds,
    });

    queryBuilder.andWhere(`${alias}.company_id = :scopeCompanyId`);

    if (!scope.canViewAllBranches) {
      if (!scope.allowedBranchIds.length) {
        queryBuilder.andWhere('1 = 0');
      } else {
        queryBuilder.andWhere(
          new Brackets((branchQuery) => {
            branchQuery.where(`${alias}.branch_id IN (:...scopeBranchIds)`);

            /*
             * Permit the creator to access a legacy record that does
             * not yet contain branch_id.
             */
            branchQuery.orWhere(
              `(${alias}.branch_id IS NULL AND ${alias}.created_by = :scopeUserId)`,
            );
          }),
        );
      }
    }

    if (scope.ownRecordsOnly) {
      queryBuilder.andWhere(`${alias}.created_by = :scopeUserId`);
    }
  }

  /**
   * Customers currently do not contain branch_id.
   *
   * Until customer portfolio assignments are implemented:
   * - company-wide users can view all company customers;
   * - own-record users see customers they created;
   * - branch users see customers linked to quotations/policies
   *   in their permitted branches, plus customers they created.
   */
  applyCustomerReadScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    queryBuilder
      .andWhere(`${alias}.company_id = :scopeCompanyId`)
      .setParameters({
        scopeCompanyId: scope.companyId,
        scopeUserId: scope.userId,
        scopeBranchIds: scope.allowedBranchIds,
      });

    if (scope.canViewAllBranches) {
      return;
    }

    if (scope.ownRecordsOnly) {
      queryBuilder.andWhere(`${alias}.created_by = :scopeUserId`);
      return;
    }

    if (!scope.allowedBranchIds.length) {
      queryBuilder.andWhere(`${alias}.created_by = :scopeUserId`);
      return;
    }

    queryBuilder.andWhere(
      new Brackets((customerScope) => {
        customerScope.where(`${alias}.created_by = :scopeUserId`).orWhere(`
            EXISTS (
              SELECT 1
              FROM quotations scoped_quotation
              WHERE
                scoped_quotation.customer_id = ${alias}.id
                AND scoped_quotation.company_id = :scopeCompanyId
                AND scoped_quotation.branch_id IN (:...scopeBranchIds)
                AND scoped_quotation.deleted_at IS NULL
            )
          `).orWhere(`
            EXISTS (
              SELECT 1
              FROM quotation_policy_holders scoped_holder
              INNER JOIN quotations scoped_holder_quotation
                ON scoped_holder_quotation.id = scoped_holder.quotation_id
              WHERE
                scoped_holder.customer_id = ${alias}.id
                AND scoped_holder_quotation.company_id = :scopeCompanyId
                AND scoped_holder_quotation.branch_id IN (:...scopeBranchIds)
                AND scoped_holder_quotation.deleted_at IS NULL
            )
          `).orWhere(`
            EXISTS (
              SELECT 1
              FROM policies scoped_policy
              WHERE
                scoped_policy.customer_id = ${alias}.id
                AND scoped_policy.company_id = :scopeCompanyId
                AND scoped_policy.branch_id IN (:...scopeBranchIds)
                AND scoped_policy.deleted_at IS NULL
            )
          `);
      }),
    );
  }

  applyCustomerWriteScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    queryBuilder
      .andWhere(`${alias}.company_id = :scopeCompanyId`)
      .setParameters({
        scopeCompanyId: scope.companyId,
        scopeUserId: scope.userId,
      });

    if (!scope.canViewAllBranches || scope.ownRecordsOnly) {
      queryBuilder.andWhere(`${alias}.created_by = :scopeUserId`);
    }
  }

  applyClaimReadScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    queryBuilder.setParameters({
      claimScopeCompanyId: scope.companyId,
      claimScopeUserId: scope.userId,
      claimScopeBranchIds: scope.allowedBranchIds,
    });

    queryBuilder.andWhere(
      new Brackets((participation) => {
        participation.where(`${alias}.company_id = :claimScopeCompanyId`);

        if (scope.canViewIntermediaryPortfolio) {
          participation
            .orWhere(
              `${alias}.intermediary_company_id = :claimScopeCompanyId`,
            )
            .orWhere(
              `${alias}.reported_by_company_id = :claimScopeCompanyId`,
            );
        }
      }),
    );

    if (!scope.canViewAllBranches) {
      if (!scope.allowedBranchIds.length) {
        queryBuilder.andWhere(
          `(
            ${alias}.assigned_user_id = :claimScopeUserId
            OR ${alias}.reported_by_user_id = :claimScopeUserId
            OR ${alias}.created_by = :claimScopeUserId
          )`,
        );
      } else {
        queryBuilder.andWhere(
          new Brackets((branchScope) => {
            branchScope
              .where(
                `(
                  ${alias}.company_id = :claimScopeCompanyId
                  AND ${alias}.branch_id IN (:...claimScopeBranchIds)
                )`,
              )
              .orWhere(
                `(
                  (
                    ${alias}.intermediary_company_id = :claimScopeCompanyId
                    OR ${alias}.reported_by_company_id = :claimScopeCompanyId
                  )
                  AND ${alias}.reported_branch_id IN (:...claimScopeBranchIds)
                )`,
              )
              .orWhere(`${alias}.assigned_user_id = :claimScopeUserId`)
              .orWhere(`${alias}.reported_by_user_id = :claimScopeUserId`);
          }),
        );
      }
    }

    if (scope.ownRecordsOnly) {
      queryBuilder.andWhere(
        `(
          ${alias}.assigned_user_id = :claimScopeUserId
          OR ${alias}.reported_by_user_id = :claimScopeUserId
          OR ${alias}.created_by = :claimScopeUserId
        )`,
      );
    }
  }

  applyClaimWriteScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    queryBuilder
      .andWhere(`${alias}.company_id = :claimWriteCompanyId`)
      .setParameters({
        claimWriteCompanyId: scope.companyId,
        claimWriteUserId: scope.userId,
        claimWriteBranchIds: scope.allowedBranchIds,
      });

    if (!scope.canViewAllBranches) {
      if (!scope.allowedBranchIds.length) {
        queryBuilder.andWhere(`${alias}.assigned_user_id = :claimWriteUserId`);
      } else {
        queryBuilder.andWhere(
          `(
            ${alias}.branch_id IN (:...claimWriteBranchIds)
            OR ${alias}.assigned_user_id = :claimWriteUserId
          )`,
        );
      }
    }

    if (scope.ownRecordsOnly) {
      queryBuilder.andWhere(`${alias}.assigned_user_id = :claimWriteUserId`);
    }
  }

  private buildOwnedRecordCondition(
    alias: string,
    scope: TenantDataScope,
  ): string {
    const conditions = [`${alias}.company_id = :scopeCompanyId`];

    if (!scope.canViewAllBranches) {
      if (!scope.allowedBranchIds.length) {
        conditions.push(`${alias}.created_by = :scopeUserId`);
      } else {
        conditions.push(`
          (
            ${alias}.branch_id IN (:...scopeBranchIds)
            OR (
              ${alias}.branch_id IS NULL
              AND ${alias}.created_by = :scopeUserId
            )
          )
        `);
      }
    }

    return `(${conditions.join(' AND ')})`;
  }
}
