import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  FINANCE_UUID,
  financeConfigurationHash,
} from '../../../foundation/finance-configuration/finance-configuration.types';
import { FinancePermissions } from '../../../governance/finance-permissions/finance.permissions';
import { FinancePortalIdentityService } from '../../../foundation/finance-setup/finance-portal-identity.service';

export interface IndependentReadScope {
  legalEntityId: string;
  bookId: string;
  associationId: string;
  associationHash: string;
}

export type IndependentAccessPurpose = 'read' | 'prepare' | 'review';

export const INDEPENDENT_ACCESS_PERMISSION: Record<
  IndependentAccessPurpose,
  string
> = {
  read: FinancePermissions.FOUNDATION_READ,
  prepare: FinancePermissions.FOUNDATION_PREPARE,
  review: FinancePermissions.FOUNDATION_REVIEW,
};

/**
 * Book-scoped ledger access bound to one reviewed source association.
 * Formerly the standalone Finance Service's human-read layer, which verified the
 * portal session over HTTP; identity is now resolved in-process from the same
 * session and re-confirmed before prepare/review work completes.
 */
@Injectable()
export class FinanceIndependentAccessService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    private readonly identity: FinancePortalIdentityService,
  ) {}

  async withRead<T>(
    user: AuthenticatedUser,
    query: IndependentReadScope,
    work: (
      m: EntityManager,
      identity: {
        tenantId: string;
        companyId: string;
        subjectId: string;
        naturalPersonId: string;
        sourceUserId: string;
        legalEntityId: string;
        bookId: string;
      },
    ) => Promise<T>,
    purpose: IndependentAccessPurpose = 'read',
  ) {
    if (
      !query ||
      ![query.legalEntityId, query.bookId, query.associationId].every(
        (id) => typeof id === 'string' && FINANCE_UUID.test(id),
      ) ||
      typeof query.associationHash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(query.associationHash)
    )
      throw new BadRequestException(
        'Exact Finance book and source association are required.',
      );
    const permission = INDEPENDENT_ACCESS_PERMISSION[purpose];
    const scope = {
      legalEntityId: query.legalEntityId.toLowerCase(),
      bookId: query.bookId.toLowerCase(),
    };
    const resolved = await this.identity.identityFor(user, scope, permission);
    const fields = [
      'tenantId',
      'companyId',
      'sourceUserId',
      'subjectId',
      'naturalPersonId',
      'legalEntityId',
      'bookId',
    ] as const;
    if (
      resolved.postingAuthorized !== false ||
      !fields.every(
        (key) =>
          typeof resolved[key] === 'string' &&
          FINANCE_UUID.test(resolved[key]) &&
          resolved[key] === resolved[key].toLowerCase(),
      ) ||
      resolved.legalEntityId !== scope.legalEntityId ||
      resolved.bookId !== scope.bookId
    )
      throw new ForbiddenException(
        'Portal identity does not match the requested Finance scope.',
      );
    const identity = resolved as typeof resolved & {
      companyId: string;
      sourceUserId: string;
    };
    return this.source.transaction(async (m) => {
      const ids = [identity.tenantId, identity.legalEntityId, identity.bookId];
      const grants = await m.query(
        `SELECT g.id FROM finance_scope_memberships g JOIN finance_accounting_books b ON b.tenant_id=g.tenant_id AND b.legal_entity_id=g.legal_entity_id AND b.id=g.book_id JOIN finance_legal_entities e ON e.tenant_id=b.tenant_id AND e.id=b.legal_entity_id WHERE g.tenant_id=$1 AND g.legal_entity_id=$2 AND g.book_id=$3 AND g.subject_id=$4 AND g.subject_kind='USER' AND g.permission='READ_DRAFT' AND g.state='ENABLED' AND g.revoked_at IS NULL AND g.valid_from<=statement_timestamp() AND (g.valid_to IS NULL OR g.valid_to>statement_timestamp()) AND b.state IN ('DRAFT','ACTIVE') AND e.state IN ('DRAFT','ACTIVE') FOR SHARE OF g,b,e`,
        [...ids, identity.subjectId],
      );
      if (grants.length !== 1)
        throw new ForbiddenException(
          'A current independent Finance read grant is required.',
        );
      const [association] = await m.query(
        `SELECT *,effective_from::text AS start_date,effective_to::text AS end_date FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND kind='SOURCE_ASSOCIATIONS' AND state='REVIEWED_INACTIVE' FOR SHARE`,
        [...ids, query.associationId.toLowerCase()],
      );
      const [clock] = await m.query(
        'SELECT statement_timestamp()::date::text AS day',
      );
      const maps = association?.payload?.sourceMaps;
      if (
        !association ||
        association.release_hash !== query.associationHash ||
        association.start_date > clock.day ||
        (association.end_date && association.end_date <= clock.day) ||
        !Array.isArray(maps)
      )
        throw new ForbiddenException(
          'An effective reviewed source association is required.',
        );
      const owned = maps.filter(
        (map: any) =>
          map.sourceSystem === 'INSURANCE_PORTAL_FINANCE' &&
          map.sourceCompanyId === identity.companyId,
      );
      if (owned.length !== 1)
        throw new ForbiddenException(
          'The reviewed source association does not uniquely own this company.',
        );
      if (
        maps.some(
          (map: any) =>
            map.sourceSystem === 'INSURANCE_PORTAL_FINANCE' &&
            map.sourceCompanyId !== identity.companyId,
        )
      )
        throw new ForbiddenException(
          'Independent access requires a book associated with exactly one source company.',
        );
      const otherAssociations = await m.query(
        `SELECT payload FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND kind='SOURCE_ASSOCIATIONS' AND state='REVIEWED_INACTIVE' FOR SHARE`,
        ids,
      );
      if (
        otherAssociations.some(
          (row: any) =>
            !Array.isArray(row.payload?.sourceMaps) ||
            row.payload.sourceMaps.some(
              (map: any) =>
                map.sourceSystem === 'INSURANCE_PORTAL_FINANCE' &&
                map.sourceCompanyId !== identity.companyId,
            ),
        )
      )
        throw new ForbiddenException(
          'Independent access requires a book associated with exactly one source company.',
        );
      const [current] = await m.query(
        `SELECT id::text,tenant_id::text AS "tenantId",legal_entity_id::text AS "legalEntityId",source_system AS "sourceSystem",source_company_id AS "sourceCompanyId",legal_role AS "legalRole",business_profile AS "businessProfile",mapping_version AS version,valid_from::text AS "validFrom",valid_to::text AS "validTo" FROM finance_legal_entity_source_maps WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3 AND state='DRAFT' FOR SHARE`,
        [ids[0], ids[1], owned[0].id],
      );
      if (
        !current ||
        financeConfigurationHash(current) !== financeConfigurationHash(owned[0])
      )
        throw new ForbiddenException(
          'The company source association has changed.',
        );
      const result = await work(m, {
        tenantId: identity.tenantId,
        companyId: identity.companyId,
        sourceUserId: identity.sourceUserId,
        subjectId: identity.subjectId,
        naturalPersonId: identity.naturalPersonId,
        legalEntityId: identity.legalEntityId,
        bookId: identity.bookId,
      });
      if (purpose !== 'read') {
        const [current] = await m.query(
          `SELECT id FROM finance_scope_memberships WHERE id=$1 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp())`,
          [grants[0].id],
        );
        const [today] = await m.query(
          'SELECT statement_timestamp()::date::text AS day',
        );
        if (
          !current ||
          association.start_date > today.day ||
          (association.end_date && association.end_date <= today.day)
        )
          throw new ForbiddenException(
            'Independent access expired before completion.',
          );
        const check = await this.identity.identityFor(user, scope, permission);
        if (
          financeConfigurationHash(check) !== financeConfigurationHash(identity)
        )
          throw new ForbiddenException(
            'Portal identity changed before completion.',
          );
      }
      return result;
    });
  }
}
