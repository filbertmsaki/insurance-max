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
import { QuotationPolicyDataScope } from './quotation-policy-data-scope.enum';

@Injectable()
export class DataAccessScopeService {
  resolve(user: AuthenticatedUser, permissionName?: string): TenantDataScope {
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

    const scopedAssignments = permissionName
      ? (user.permissionDataScopes ?? []).filter(
          (assignment) =>
            assignment.permission === permissionName && assignment.explicit,
        )
      : [];
    // Direct grants take precedence. When several role assignments provide
    // the same permission, select the narrowest scope to fail closed.
    const candidates = scopedAssignments.filter(
      (item) => item.source === 'DIRECT',
    );
    const effectiveAssignments = candidates.length
      ? candidates
      : scopedAssignments;
    const scopeRank: Record<QuotationPolicyDataScope, number> = {
      [QuotationPolicyDataScope.USER]: 0,
      [QuotationPolicyDataScope.DEPARTMENT]: 1,
      [QuotationPolicyDataScope.BRANCH]: 1,
      [QuotationPolicyDataScope.COMPANY]: 2,
    };
    const selectedAssignment = effectiveAssignments.reduce(
      (selected, current) =>
        !selected ||
        scopeRank[current.dataScope] < scopeRank[selected.dataScope]
          ? current
          : selected,
      undefined as (typeof effectiveAssignments)[number] | undefined,
    );
    const hasExplicitPermissionScope = !!selectedAssignment;
    const isExternalUser = ['AGENT', 'BROKER', 'CUSTOMER'].includes(
      user.userType,
    );
    const assignedBranchIds = Array.from(new Set(user.assignedBranchIds ?? []));
    const configuredScope = this.normalizeQuotationPolicyDataScope(
      selectedAssignment?.dataScope ?? user.quotationPolicyDataScope,
    );
    // Branch team access: internal staff on the default USER scope share
    // records with colleagues in every branch they are assigned to, so they
    // can follow up on work started by someone else. External users and an
    // explicit own-records grant keep creator-only access.
    const quotationPolicyDataScope =
      configuredScope === QuotationPolicyDataScope.USER &&
      !hasExplicitPermissionScope &&
      !isExternalUser &&
      !permissions.has(DataScopePermissions.OWN_RECORDS) &&
      assignedBranchIds.length > 0
        ? QuotationPolicyDataScope.BRANCH
        : configuredScope;

    // An explicit scope for this permission takes precedence over generic
    // membership-wide scope flags. This lets a company administrator retain
    // administrative roles while limiting a specific business permission to
    // one branch.
    const canViewAllBranches =
      quotationPolicyDataScope === QuotationPolicyDataScope.COMPANY ||
      (!hasExplicitPermissionScope &&
        permissions.has(DataScopePermissions.COMPANY_ALL));

    const canViewAssignedBranches =
      !canViewAllBranches &&
      (quotationPolicyDataScope === QuotationPolicyDataScope.BRANCH ||
        (!hasExplicitPermissionScope &&
          permissions.has(DataScopePermissions.ASSIGNED_BRANCHES)));

    const assignedDepartmentIds = Array.from(
      new Set(user.assignedDepartmentIds ?? []),
    );

    let allowedBranchIds: string[] = [];

    if (canViewAssignedBranches) {
      allowedBranchIds = selectedAssignment?.branchId
        ? assignedBranchIds.filter((id) => id === selectedAssignment.branchId)
        : assignedBranchIds;
    } else if (!canViewAllBranches && user.activeBranchId) {
      allowedBranchIds = [user.activeBranchId];
    }

    const ownRecordsOnly =
      quotationPolicyDataScope === QuotationPolicyDataScope.USER ||
      (!hasExplicitPermissionScope &&
        permissions.has(DataScopePermissions.OWN_RECORDS)) ||
      isExternalUser;

    const allowedDepartmentIds =
      quotationPolicyDataScope === QuotationPolicyDataScope.DEPARTMENT
        ? selectedAssignment?.departmentId
          ? assignedDepartmentIds.filter(
              (id) => id === selectedAssignment.departmentId,
            )
          : assignedDepartmentIds
        : [];

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
      activeDepartmentId: user.activeDepartmentId ?? null,
      assignedDepartmentIds,
      allowedDepartmentIds,
      quotationPolicyDataScope,

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
    this.applyQuotationPolicyDataScope(queryBuilder, alias, scope);
  }

  applyPolicyReadScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    this.applyQuotationPolicyDataScope(queryBuilder, alias, scope);
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
            .orWhere(`${alias}.intermediary_company_id = :claimScopeCompanyId`)
            .orWhere(`${alias}.reported_by_company_id = :claimScopeCompanyId`);
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

    if (this.isClaimDepartmentScoped(scope)) {
      queryBuilder
        .setParameter('claimScopeDepartmentIds', scope.allowedDepartmentIds)
        .andWhere(
          `(
            ${alias}.department_id IN (:...claimScopeDepartmentIds)
            OR ${alias}.assigned_user_id = :claimScopeUserId
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

    if (this.isClaimDepartmentScoped(scope)) {
      queryBuilder
        .setParameter('claimWriteDepartmentIds', scope.allowedDepartmentIds)
        .andWhere(
          `(
            ${alias}.department_id IN (:...claimWriteDepartmentIds)
            OR ${alias}.assigned_user_id = :claimWriteUserId
            OR ${alias}.created_by = :claimWriteUserId
          )`,
        );
    }
  }

  /**
   * Department-scoped users see claims of their departments (plus claims
   * they handle) unless they already have company-wide access.
   */
  private isClaimDepartmentScoped(scope: TenantDataScope): boolean {
    return (
      !scope.canViewAllBranches &&
      scope.quotationPolicyDataScope === QuotationPolicyDataScope.DEPARTMENT &&
      (scope.allowedDepartmentIds ?? []).length > 0
    );
  }

  applyTreatyReadScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    queryBuilder
      .setParameters({
        reScopeCompanyId: scope.companyId,
        reScopeBranchIds: scope.allowedBranchIds,
      })
      .andWhere(
        new Brackets((access) => {
          access.where(`${alias}.company_id = :reScopeCompanyId`).orWhere(`
              EXISTS (
                SELECT 1
                FROM reinsurance_treaty_participants scoped_participant
                WHERE scoped_participant.treaty_id = ${alias}.id
                  AND scoped_participant.participant_company_id = :reScopeCompanyId
                  AND scoped_participant.deleted_at IS NULL
              )
            `);
        }),
      );

    if (!scope.canViewAllBranches) {
      if (!scope.allowedBranchIds.length) {
        queryBuilder.andWhere(
          `(${alias}.branch_id IS NULL OR ${alias}.created_by = :scopeUserId)`,
          { scopeUserId: scope.userId },
        );
      } else {
        queryBuilder.andWhere(
          new Brackets((branchScope) => {
            branchScope
              .where(`${alias}.branch_id IS NULL`)
              .orWhere(`${alias}.branch_id IN (:...reScopeBranchIds)`).orWhere(`
                EXISTS (
                  SELECT 1
                  FROM reinsurance_treaty_participants scoped_participant_branch
                  WHERE scoped_participant_branch.treaty_id = ${alias}.id
                    AND scoped_participant_branch.participant_company_id = :reScopeCompanyId
                    AND scoped_participant_branch.deleted_at IS NULL
                )
              `);
          }),
        );
      }
    }
  }

  applyReinsuranceCessionReadScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    queryBuilder
      .setParameters({
        reCessionCompanyId: scope.companyId,
        reCessionBranchIds: scope.allowedBranchIds,
        reCessionUserId: scope.userId,
      })
      .andWhere(
        new Brackets((access) => {
          access.where(`${alias}.company_id = :reCessionCompanyId`).orWhere(`
              EXISTS (
                SELECT 1
                FROM policy_cession_participants scoped_participant
                WHERE scoped_participant.cession_id = ${alias}.id
                  AND scoped_participant.participant_company_id = :reCessionCompanyId
              )
            `);
        }),
      );

    if (!scope.canViewAllBranches) {
      if (!scope.allowedBranchIds.length) {
        queryBuilder.andWhere(
          `(${alias}.branch_id IS NULL OR ${alias}.created_by = :reCessionUserId)`,
        );
      } else {
        queryBuilder.andWhere(
          new Brackets((branchScope) => {
            branchScope
              .where(`${alias}.branch_id IS NULL`)
              .orWhere(`${alias}.branch_id IN (:...reCessionBranchIds)`)
              .orWhere(`
                EXISTS (
                  SELECT 1
                  FROM policy_cession_participants scoped_participant_branch
                  WHERE scoped_participant_branch.cession_id = ${alias}.id
                    AND scoped_participant_branch.participant_company_id = :reCessionCompanyId
                )
              `);
          }),
        );
      }
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

  private applyQuotationPolicyDataScope<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    scope: TenantDataScope,
  ): void {
    queryBuilder
      .setParameters({
        scopeCompanyId: scope.companyId,
        scopeUserId: scope.userId,
        scopeBranchIds: scope.allowedBranchIds,
        scopeDepartmentIds: scope.allowedDepartmentIds ?? [],
      })
      .andWhere(`${alias}.company_id = :scopeCompanyId`);

    switch (scope.quotationPolicyDataScope ?? QuotationPolicyDataScope.USER) {
      case QuotationPolicyDataScope.COMPANY:
        return;
      case QuotationPolicyDataScope.BRANCH:
        if (!scope.allowedBranchIds.length) {
          queryBuilder.andWhere('1 = 0');
          return;
        }
        // A user always keeps their own records, including legacy rows
        // without a branch.
        queryBuilder.andWhere(
          `(${alias}.branch_id IN (:...scopeBranchIds) OR ${alias}.created_by = :scopeUserId)`,
        );
        return;
      case QuotationPolicyDataScope.DEPARTMENT:
        if (!(scope.allowedDepartmentIds ?? []).length) {
          queryBuilder.andWhere('1 = 0');
          return;
        }
        queryBuilder.andWhere(
          `${alias}.department_id IN (:...scopeDepartmentIds)`,
        );
        return;
      case QuotationPolicyDataScope.USER:
      default:
        queryBuilder.andWhere(`${alias}.created_by = :scopeUserId`);
    }
  }

  private normalizeQuotationPolicyDataScope(
    value: AuthenticatedUser['quotationPolicyDataScope'],
  ): QuotationPolicyDataScope {
    if (
      value &&
      Object.values(QuotationPolicyDataScope).includes(
        value as QuotationPolicyDataScope,
      )
    ) {
      return value as QuotationPolicyDataScope;
    }

    return QuotationPolicyDataScope.USER;
  }
}
