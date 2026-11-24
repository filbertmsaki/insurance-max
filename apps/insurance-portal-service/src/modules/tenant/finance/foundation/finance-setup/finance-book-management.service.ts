import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ADMIN_ROLE_BY_COMPANY_TYPE } from '../../../../platform/companies/access-rules';
import { AuditService } from '../../../../shared/audit/audit.service';
import type { FinanceBookSelection } from '../finance-configuration/finance-scope.service';

import {
  createAppointedBook,
  onboardingMembers,
} from './finance-book-onboarding';

@Injectable()
export class FinanceBookManagementService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly audit: AuditService,
  ) {}

  onboardingMembers(user: AuthenticatedUser) {
    return this.db.transaction((m) => onboardingMembers(m, user));
  }

  bootstrap(
    user: AuthenticatedUser,
    input: unknown,
    scope?: FinanceBookSelection,
  ) {
    return this.db.transaction(async (m) => {
      const source = scope ? await this.authority(m, user, scope) : null;
      const book = await createAppointedBook(
        m,
        user,
        input,
        source
          ? {
              tenantId: source.tenant_id,
              legalEntityId: source.legal_entity_id,
            }
          : undefined,
      );
      await this.audit.logCritical(
        {
          action: scope ? 'FINANCE_BOOK_CREATE' : 'FINANCE_PRIMARY_BOOK_CREATE',
          userId: user.id,
          companyId: user.companyId,
          resource: 'finance_accounting_book',
          resourceId: book.bookId,
          afterState: { book, input },
        },
        m,
      );
      return book;
    });
  }

  async alignLegalName(
    user: AuthenticatedUser,
    scope: FinanceBookSelection,
    expectedName: unknown,
  ) {
    return this.db.transaction(async (m) => {
      const a = await this.authority(m, user, scope);
      const [company] = await m.query(
        'SELECT name FROM companies WHERE id=$1 AND deleted_at IS NULL FOR SHARE',
        [user.companyId],
      );
      const [entity] = await m.query(
        'SELECT id,legal_name FROM finance_legal_entities WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [a.tenant_id, a.legal_entity_id],
      );
      if (!entity || !company || company.name !== expectedName)
        throw new ConflictException(
          'Refresh the registered company name before applying it.',
        );
      const other = await m.query(
        'SELECT id FROM finance_legal_entity_source_maps WHERE tenant_id=$1 AND legal_entity_id=$2 AND source_company_id<>$3 AND state<>$4 LIMIT 1',
        [a.tenant_id, a.legal_entity_id, user.companyId, 'DISABLED'],
      );
      if (other.length)
        throw new ConflictException(
          'Review the shared legal entity and its company mappings before changing its name.',
        );
      await m.query(
        'UPDATE finance_legal_entities SET legal_name=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',
        [a.tenant_id, a.legal_entity_id, company.name],
      );
      await this.audit.logCritical(
        {
          action: 'FINANCE_LEGAL_NAME_ALIGN',
          userId: user.id,
          companyId: user.companyId,
          resource: 'finance_legal_entity',
          resourceId: entity.id,
          beforeState: { legal_name: entity.legal_name },
          afterState: { legal_name: company.name },
        },
        m,
      );
      return { legalName: company.name };
    });
  }

  private async authority(
    m: EntityManager,
    user: AuthenticatedUser,
    scope: FinanceBookSelection,
  ) {
    const admin =
      user.userType === 'COMPANY_ADMIN' ||
      (user.companyType &&
        user.roles?.includes(ADMIN_ROLE_BY_COMPANY_TYPE[user.companyType]));
    if (user.scope !== 'company' || !user.companyId || !admin)
      throw new ForbiddenException('Company administrator access is required.');
    const rows = await m.query(
      `SELECT i.*,a.id AS release_authority FROM finance_foundation_identity_bindings i JOIN finance_foundation_authorities a ON a.tenant_id=i.tenant_id AND a.legal_entity_id=i.legal_entity_id AND a.book_id=i.book_id AND a.subject_id=i.subject_id AND a.natural_person_id=i.natural_person_id JOIN finance_accounting_books b ON b.tenant_id=i.tenant_id AND b.legal_entity_id=i.legal_entity_id AND b.id=i.book_id JOIN finance_legal_entities e ON e.tenant_id=i.tenant_id AND e.id=i.legal_entity_id WHERE i.source_company_id=$1 AND i.source_user_id=$2 AND i.legal_entity_id=$3 AND i.book_id=$4 AND b.state<>'DISABLED' AND e.state<>'DISABLED' AND i.revoked_at IS NULL AND i.valid_from<=now() AND (i.valid_to IS NULL OR i.valid_to>now()) AND a.capability='RELEASE' AND a.company_role='COMPANY_ADMIN' AND a.revoked_at IS NULL AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now()) FOR SHARE OF i,a,b,e`,
      [user.companyId, user.id, scope.legalEntityId, scope.bookId],
    );
    if (rows.length !== 1)
      throw new ForbiddenException(
        'A current book-specific administrator mandate is required.',
      );
    return rows[0];
  }

  private code(value: unknown) {
    if (
      typeof value !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(value)
    )
      throw new BadRequestException(
        'Book code must contain 1 to 50 letters, numbers, underscores or hyphens.',
      );
    return value;
  }

  async create(
    user: AuthenticatedUser,
    scope: FinanceBookSelection,
    value: unknown,
  ) {
    const code = this.code(value);
    return this.db.transaction(async (m) => {
      const a = await this.authority(m, user, scope);
      const [book] = await m.query(
        "INSERT INTO finance_accounting_books(tenant_id,legal_entity_id,book_code,state) VALUES($1,$2,$3,'DRAFT') RETURNING id,book_code,state",
        [a.tenant_id, a.legal_entity_id, code],
      );
      await m.query(
        `INSERT INTO finance_foundation_identity_bindings(source_company_id,source_user_id,tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),$9)`,
        [
          a.source_company_id,
          a.source_user_id,
          a.tenant_id,
          a.legal_entity_id,
          book.id,
          a.subject_id,
          a.natural_person_id,
          a.authority_reference,
          a.valid_to,
        ],
      );
      await m.query(
        `INSERT INTO finance_foundation_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,capability,company_role,authority_reference,limits,valid_from,valid_to) SELECT tenant_id,legal_entity_id,$1,subject_id,natural_person_id,capability,company_role,authority_reference,limits,now(),valid_to FROM finance_foundation_authorities WHERE tenant_id=$2 AND legal_entity_id=$3 AND book_id=$4 AND subject_id=$5 AND natural_person_id=$6 AND revoked_at IS NULL AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now())`,
        [
          book.id,
          a.tenant_id,
          a.legal_entity_id,
          scope.bookId,
          a.subject_id,
          a.natural_person_id,
        ],
      );
      await m.query(
        `INSERT INTO finance_configuration_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,state,authority_reference,valid_from,valid_to) SELECT tenant_id,legal_entity_id,$1,subject_id,natural_person_id,permission,state,authority_reference,now(),valid_to FROM finance_configuration_authorities WHERE tenant_id=$2 AND legal_entity_id=$3 AND book_id=$4 AND subject_id=$5 AND natural_person_id=$6 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now())`,
        [
          book.id,
          a.tenant_id,
          a.legal_entity_id,
          scope.bookId,
          a.subject_id,
          a.natural_person_id,
        ],
      );
      await this.audit.logCritical(
        {
          action: 'FINANCE_BOOK_CREATE',
          userId: user.id,
          companyId: user.companyId,
          resource: 'finance_accounting_book',
          resourceId: book.id,
          afterState: book,
        },
        m,
      );
      return book;
    });
  }

  async rename(
    user: AuthenticatedUser,
    scope: FinanceBookSelection,
    value: unknown,
  ) {
    const code = this.code(value);
    return this.db.transaction(async (m) => {
      const a = await this.authority(m, user, scope);
      const [before] = await m.query(
        'SELECT id,book_code,state FROM finance_accounting_books WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3 FOR UPDATE',
        [a.tenant_id, a.legal_entity_id, scope.bookId],
      );
      if (!before || before.state !== 'DRAFT')
        throw new ConflictException('Only draft books can be renamed.');
      const [book] = await m.query(
        'UPDATE finance_accounting_books SET book_code=$4,updated_at=now() WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3 RETURNING id,book_code,state',
        [a.tenant_id, a.legal_entity_id, scope.bookId, code],
      );
      await this.audit.logCritical(
        {
          action: 'FINANCE_BOOK_UPDATE',
          userId: user.id,
          companyId: user.companyId,
          resource: 'finance_accounting_book',
          resourceId: book.id,
          beforeState: before,
          afterState: book,
        },
        m,
      );
      return book;
    });
  }

  async remove(user: AuthenticatedUser, scope: FinanceBookSelection) {
    try {
      return await this.db.transaction(async (m) => {
        const a = await this.authority(m, user, scope);
        await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `finance-book-delete/${user.companyId}/${user.id}`,
        ]);
        const [book] = await m.query(
          'SELECT id,book_code,state FROM finance_accounting_books WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3 FOR UPDATE',
          [a.tenant_id, a.legal_entity_id, scope.bookId],
        );
        if (!book || book.state !== 'DRAFT')
          throw new ConflictException('Only draft books can be archived.');
        const [remaining] = await m.query(
          `SELECT count(*)::int AS n FROM finance_foundation_identity_bindings i JOIN finance_foundation_authorities x ON x.tenant_id=i.tenant_id AND x.legal_entity_id=i.legal_entity_id AND x.book_id=i.book_id AND x.subject_id=i.subject_id AND x.natural_person_id=i.natural_person_id JOIN finance_accounting_books b ON b.id=i.book_id AND b.tenant_id=i.tenant_id AND b.legal_entity_id=i.legal_entity_id WHERE i.source_company_id=$1 AND i.source_user_id=$2 AND i.book_id<>$3 AND i.revoked_at IS NULL AND i.valid_from<=now() AND (i.valid_to IS NULL OR i.valid_to>now()) AND x.capability='RELEASE' AND x.company_role='COMPANY_ADMIN' AND x.revoked_at IS NULL AND x.valid_from<=now() AND (x.valid_to IS NULL OR x.valid_to>now()) AND b.state<>'DISABLED'`,
          [user.companyId, user.id, scope.bookId],
        );
        if (!remaining.n)
          throw new ConflictException(
            'The last administrator-accessible book cannot be archived.',
          );
        await m.query(
          "UPDATE finance_accounting_books SET state='DISABLED',updated_at=now() WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3",
          [a.tenant_id, a.legal_entity_id, scope.bookId],
        );
        await this.audit.logCritical(
          {
            action: 'FINANCE_BOOK_ARCHIVE',
            userId: user.id,
            companyId: user.companyId,
            resource: 'finance_accounting_book',
            resourceId: book.id,
            beforeState: book,
            afterState: { ...book, state: 'DISABLED' },
          },
          m,
        );
        return { archived: true };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23503')
        throw new ConflictException(
          'This book has accounting records or configuration and cannot be deleted.',
        );
      throw error;
    }
  }
}
