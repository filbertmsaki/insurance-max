import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataScopePermissions } from '@insurance-max/contracts';

import { TENANT_BOUNDARY_KEY } from '../decorators/authorization.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class TenantBoundaryGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const enforceBoundary = this.reflector.getAllAndOverride<boolean>(
      TENANT_BOUNDARY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!enforceBoundary) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      headers: Record<string, string | string[] | undefined>;
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    }>();

    const user = request.user;

    if (
      !user ||
      user.scope !== 'company' ||
      !user.companyId ||
      !user.companyMembershipId
    ) {
      throw new ForbiddenException({
        code: 'ACTIVE_COMPANY_REQUIRED',
        message: 'An active company membership is required.',
      });
    }

    const requestedCompanyIds = this.readIdentifiers(request, [
      'company_id',
      'companyId',
    ]);

    for (const requestedCompanyId of requestedCompanyIds) {
      if (requestedCompanyId !== user.companyId) {
        throw new ForbiddenException({
          code: 'CROSS_TENANT_ACCESS_DENIED',
          message: 'The requested resource belongs to another company.',
        });
      }
    }

    const requestedMembershipIds = this.readIdentifiers(request, [
      'company_user_id',
      'companyUserId',
      'membership_id',
      'membershipId',
    ]);

    for (const membershipId of requestedMembershipIds) {
      if (membershipId !== user.companyMembershipId) {
        /*
         * Membership-management endpoints must validate the target
         * membership in their service. They should not use
         * @TenantScoped() with target membership IDs.
         */
        throw new ForbiddenException({
          code: 'MEMBERSHIP_SCOPE_MISMATCH',
          message: 'The requested membership is outside the current context.',
        });
      }
    }

    const requestedBranchIds = this.readIdentifiers(request, [
      'branch_id',
      'branchId',
    ]);

    const canAccessAllBranches = (user.permissions ?? []).includes(
      DataScopePermissions.COMPANY_ALL,
    );

    if (!canAccessAllBranches) {
      const allowedBranches = new Set([
        ...(user.assignedBranchIds ?? []),
        ...(user.activeBranchId ? [user.activeBranchId] : []),
      ]);

      for (const branchId of requestedBranchIds) {
        if (!allowedBranches.has(branchId)) {
          throw new ForbiddenException({
            code: 'BRANCH_ACCESS_DENIED',
            message: 'You are not permitted to access the requested branch.',
          });
        }
      }
    }

    return true;
  }

  private readIdentifiers(
    request: {
      headers: Record<string, string | string[] | undefined>;
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    },
    keys: string[],
  ): string[] {
    const values = new Set<string>();

    for (const source of [request.params, request.query, request.body]) {
      if (!source) {
        continue;
      }

      for (const key of keys) {
        const value = source[key];

        if (typeof value === 'string' && value.trim()) {
          values.add(value.trim());
        }
      }
    }

    const headerCompanyId = request.headers['x-company-id'];

    if (
      keys.includes('companyId') &&
      typeof headerCompanyId === 'string' &&
      headerCompanyId.trim()
    ) {
      values.add(headerCompanyId.trim());
    }

    return [...values];
  }
}
