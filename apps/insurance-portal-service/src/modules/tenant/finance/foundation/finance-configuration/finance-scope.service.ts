import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FinanceAccountingBook } from '../entities/finance-accounting-book.entity';
import { FinanceLegalEntity } from '../entities/finance-legal-entity.entity';
import { FinanceScopeMembership } from '../entities/finance-scope-membership.entity';

/** Internal input from a trusted identity adapter, not an HTTP request DTO. */
export interface FinancePrincipal {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly kind: 'USER' | 'WORKER';
}

export interface FinanceBookSelection {
  readonly legalEntityId: string;
  readonly bookId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class FinanceScopeService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** No legacy company/admin fallback and no posting/activation capability. */
  async resolveDraftRead(
    principal: FinancePrincipal | null | undefined,
    selection: FinanceBookSelection,
  ) {
    const deny = () =>
      new ForbiddenException({
        code: 'FINANCE_SCOPE_DENIED',
        message: 'The requested Finance draft scope is not available.',
      });
    if (
      !principal ||
      !['USER', 'WORKER'].includes(principal.kind) ||
      ![
        principal.tenantId,
        principal.subjectId,
        selection?.legalEntityId,
        selection?.bookId,
      ].every((value) => typeof value === 'string' && UUID.test(value))
    )
      throw deny();

    // Statement time is authoritative. A stale client timestamp cannot extend
    // membership validity. A resolved read scope is not a posting authority.
    const scope = await this.dataSource
      .getRepository(FinanceAccountingBook)
      .createQueryBuilder('book')
      .innerJoin(
        FinanceLegalEntity,
        'entity',
        'entity.tenant_id = book.tenant_id AND entity.id = book.legal_entity_id',
      )
      .innerJoin(
        FinanceScopeMembership,
        'membership',
        'membership.tenant_id = book.tenant_id AND membership.legal_entity_id = book.legal_entity_id AND membership.book_id = book.id',
      )
      .select('book.tenant_id', 'tenant_id')
      .addSelect('book.legal_entity_id', 'legal_entity_id')
      .addSelect('book.id', 'book_id')
      .addSelect('book.book_code', 'book_code')
      .addSelect('entity.entity_code', 'entity_code')
      .addSelect('entity.business_profile', 'business_profile')
      .where('book.tenant_id = :tenantId', {
        tenantId: principal.tenantId.toLowerCase(),
      })
      .andWhere('book.legal_entity_id = :entityId', {
        entityId: selection.legalEntityId.toLowerCase(),
      })
      .andWhere('book.id = :bookId', { bookId: selection.bookId.toLowerCase() })
      .andWhere('book.state IN (:...draft) AND entity.state IN (:...draft)', {
        draft: ['DRAFT', 'ACTIVE'],
      })
      .andWhere('membership.subject_id = :subjectId', {
        subjectId: principal.subjectId.toLowerCase(),
      })
      .andWhere('membership.subject_kind = :kind', { kind: principal.kind })
      .andWhere(
        'membership.state = :enabled AND membership.permission = :permission',
        { enabled: 'ENABLED', permission: 'READ_DRAFT' },
      )
      .andWhere('membership.revoked_at IS NULL')
      .andWhere('membership.valid_from <= statement_timestamp()')
      .andWhere(
        '(membership.valid_to IS NULL OR membership.valid_to > statement_timestamp())',
      )
      .getRawOne<{
        tenant_id: string;
        legal_entity_id: string;
        book_id: string;
        book_code: string;
        entity_code: string;
        business_profile: string;
      }>();
    if (!scope) throw deny();
    return Object.freeze({
      tenantId: scope.tenant_id,
      legalEntityId: scope.legal_entity_id,
      bookId: scope.book_id,
      entityCode: scope.entity_code,
      bookCode: scope.book_code,
      businessProfile: scope.business_profile,
      mode: 'DRAFT_READ_ONLY' as const,
    });
  }
}
