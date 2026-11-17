import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  FINANCE_UUID,
  financeConfigurationHash,
} from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-configuration.types';

export interface IndependentReadScope {
  legalEntityId: string;
  bookId: string;
  associationId: string;
  associationHash: string;
}

/** Authenticate online with the portal and enforce the independent Finance grant and source mapping. */
@Injectable()
export class FinanceHumanReadService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}
  async withRead<T>(
    authorization: string,
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
    purpose: 'read' | 'prepare' | 'review' = 'read',
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
    if (
      typeof authorization !== 'string' ||
      !/^Bearer [A-Za-z0-9._~-]{1,8192}$/.test(authorization)
    )
      throw new UnauthorizedException(
        'A current portal access token is required.',
      );
    let base: URL;
    try {
      base = new URL(process.env.FINANCE_PORTAL_IDENTITY_ORIGIN ?? '');
    } catch {
      throw new ServiceUnavailableException(
        'Portal identity verification is not configured.',
      );
    }
    const testLoopback =
      process.env.NODE_ENV === 'test' &&
      process.env.APP_ENV === 'test' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
    if (
      (!testLoopback && base.protocol !== 'https:') ||
      (testLoopback && !['http:', 'https:'].includes(base.protocol)) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !['', '/'].includes(base.pathname)
    )
      throw new ServiceUnavailableException(
        'Portal identity origin is not permitted.',
      );
    const prefix = process.env.FINANCE_PORTAL_IDENTITY_BASE_PATH ?? '/api/v1';
    if (!/^\/[A-Za-z0-9_-]+\/v[0-9]+$/.test(prefix))
      throw new ServiceUnavailableException(
        'Portal identity API path is not permitted.',
      );
    const endpoint = new URL(
      `${prefix}/tenant/finance/setup/${purpose === 'read' ? 'independent-identity' : `independent-identity-${purpose}`}`,
      base,
    );
    endpoint.searchParams.set(
      'legalEntityId',
      query.legalEntityId.toLowerCase(),
    );
    endpoint.searchParams.set('bookId', query.bookId.toLowerCase());
    let response: Response;
    try {
      response = await fetch(endpoint, {
        headers: { authorization },
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Portal identity verification is unavailable.',
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new UnauthorizedException(
        'Portal session or Finance access is no longer valid.',
      );
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Portal identity verification failed.',
      );
    const text = await response.text();
    if (text.length > 8192)
      throw new ServiceUnavailableException(
        'Portal identity response is invalid.',
      );
    let identity: any;
    try {
      const envelope = JSON.parse(text);
      if (!envelope || envelope.success !== true || !envelope.data)
        throw new Error('Invalid portal response envelope');
      identity = envelope.data;
    } catch {
      throw new ServiceUnavailableException(
        'Portal identity response is invalid.',
      );
    }
    const fields = [
      'tenantId',
      'companyId',
      'sourceUserId',
      'subjectId',
      'naturalPersonId',
      'legalEntityId',
      'bookId',
    ];
    if (
      !identity ||
      identity.schema !== 'FINANCE_PORTAL_IDENTITY_V1' ||
      identity.postingAuthorized !== false ||
      !fields.every(
        (key) =>
          typeof identity[key] === 'string' &&
          FINANCE_UUID.test(identity[key]) &&
          identity[key] === identity[key].toLowerCase(),
      ) ||
      identity.legalEntityId !== query.legalEntityId.toLowerCase() ||
      identity.bookId !== query.bookId.toLowerCase()
    )
      throw new ForbiddenException(
        'Portal identity does not match the requested Finance scope.',
      );
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
        let confirm: Response;
        try {
          confirm = await fetch(endpoint, {
            headers: { authorization },
            redirect: 'error',
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          throw new ServiceUnavailableException(
            'Portal identity verification is unavailable.',
          );
        }
        if (!confirm.ok)
          throw new UnauthorizedException(
            'Portal session or Finance access is no longer valid.',
          );
        const confirmText = await confirm.text();
        if (confirmText.length > 8192)
          throw new ServiceUnavailableException(
            'Portal identity response is invalid.',
          );
        let check: any;
        try {
          check = JSON.parse(confirmText);
        } catch {
          throw new ServiceUnavailableException(
            'Portal identity response is invalid.',
          );
        }
        if (
          check?.success !== true ||
          !check.data ||
          financeConfigurationHash(check.data) !==
            financeConfigurationHash(identity)
        )
          throw new ForbiddenException(
            'Portal identity changed before completion.',
          );
      }
      return result;
    });
  }
}
