import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ADMIN_ROLE_BY_COMPANY_TYPE } from '../../../../platform/companies/access-rules';
import type { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { isFinanceDate } from '../finance-configuration/finance-configuration.types';
import { setupObject, setupText, setupUuid } from './finance-setup.types';

export async function onboardingCompany(
  m: EntityManager,
  user: AuthenticatedUser,
) {
  if (
    user?.scope !== 'company' ||
    !setupUuid(user.companyId) ||
    !setupUuid(user.id)
  )
    throw new ForbiddenException('Sign in as a company administrator.');
  const [company] = await m.query(
    "SELECT id,name,company_type,default_currency FROM companies WHERE id=$1 AND status='active' AND deleted_at IS NULL FOR UPDATE",
    [user.companyId],
  );
  const role =
    company && ADMIN_ROLE_BY_COMPANY_TYPE[company.company_type as CompanyType];
  const [admin] = role
    ? await m.query(
        `SELECT cu.id FROM company_users cu JOIN users u ON u.id::text=cu.user_id::text
    JOIN company_user_roles cr ON cr.company_user_id::text=cu.id::text JOIN roles r ON r.id::text=cr.role_id::text
    WHERE cu.company_id=$1 AND cu.user_id=$2 AND cu.status='active' AND u.status='active' AND u.deleted_at IS NULL
    AND r.name=$3 AND (r.company_id::text=cu.company_id::text OR (r.company_id IS NULL AND r.scope='tenant_template')) FOR SHARE OF cu,u,r`,
        [user.companyId, user.id, role],
      )
    : [];
  if (!admin)
    throw new ForbiddenException(
      'A current company administrator is required.',
    );
  return company;
}
export async function onboardingMembers(
  m: EntityManager,
  user: AuthenticatedUser,
) {
  const company = await onboardingCompany(m, user);
  const members = await m.query(
    `SELECT u.id,u.first_name AS "firstName",u.last_name AS "lastName" FROM users u
    JOIN company_users cu ON cu.user_id::text=u.id::text WHERE cu.company_id=$1 AND u.id<>$2
    AND u.status='active' AND cu.status='active' AND u.deleted_at IS NULL ORDER BY u.first_name,u.last_name,u.id`,
    [company.id, user.id],
  );
  return { members, currency: company.default_currency };
}
export async function createAppointedBook(
  m: EntityManager,
  user: AuthenticatedUser,
  input: unknown,
  source?: { tenantId: string; legalEntityId: string },
) {
  if (
    !setupObject(input) ||
    !setupUuid(input.preparerUserId) ||
    !setupText(input.bookCode, 50) ||
    !/^[A-Za-z0-9_-]+$/.test(input.bookCode) ||
    !setupText(input.businessProfile, 50) ||
    !['GENERAL_INSURER', 'INSURER', 'BROKER', 'REINSURER', 'OTHER'].includes(
      input.businessProfile,
    ) ||
    !setupText(input.authorityReference, 200) ||
    !isFinanceDate(input.validUntil) ||
    !setupText(input.approvalRole, 80) ||
    !/^[A-Z][A-Z0-9_.:-]*$/.test(input.approvalRole) ||
    !setupObject(input.limits) ||
    !Object.keys(input.limits).length ||
    Object.keys(input.limits).length > 100 ||
    Object.entries(input.limits).some(
      ([ccy, v]) =>
        !/^[A-Z]{3}$/.test(ccy) ||
        typeof v !== 'string' ||
        !/^(0|[1-9]\d{0,25})(\.\d{1,12})?$/.test(v) ||
        !/[1-9]/.test(v),
    )
  )
    throw new BadRequestException(
      'Supply the book code, business profile, preparer, appointment reference, end date, reviewer role and positive currency limits.',
    );
  const company = await onboardingCompany(m, user);
  const [existing] = await m.query(
    `SELECT 1 FROM finance_foundation_identity_bindings WHERE source_company_id=$1
    UNION ALL SELECT 1 FROM finance_legal_entity_source_maps WHERE source_company_id=$2 LIMIT 1`,
    [company.id, company.id],
  );
  if (!source && existing)
    throw new ConflictException(
      'Finance already exists for this company. Open the existing book or have its administrator restore access.',
    );
  const additional = input.additionalCheckerUserIds ?? [];
  if (
    !Array.isArray(additional) ||
    additional.length > 9 ||
    !additional.every(setupUuid)
  )
    throw new BadRequestException(
      'Select up to nine additional company journal reviewers.',
    );
  const staffIds = [user.id, input.preparerUserId, ...additional];
  if (new Set(staffIds).size !== staffIds.length)
    throw new BadRequestException(
      'Assign each appointment to a different person.',
    );
  const people = await m.query(
    `SELECT u.id FROM company_users cu JOIN users u ON u.id::text=cu.user_id::text
    WHERE cu.company_id=$1 AND u.id::text=ANY($2::text[]) AND cu.status='active' AND u.status='active' AND u.deleted_at IS NULL FOR SHARE OF cu,u`,
    [company.id, staffIds],
  );
  if (people.length !== staffIds.length)
    throw new BadRequestException(
      'Select a different active company member as preparer.',
    );
  const [time] = await m.query(
    'SELECT $1::date::timestamptz > statement_timestamp() AS valid',
    [input.validUntil],
  );
  if (!time.valid)
    throw new BadRequestException('The appointment must end in the future.');
  let tenantId: string, legalEntityId: string;
  if (source) {
    tenantId = source.tenantId;
    legalEntityId = source.legalEntityId;
    const [entity] = await m.query(
      "SELECT business_profile FROM finance_legal_entities WHERE tenant_id=$1 AND id=$2 AND state<>'DISABLED' FOR SHARE",
      [tenantId, legalEntityId],
    );
    if (entity?.business_profile !== input.businessProfile)
      throw new ConflictException(
        'Use the business profile of the selected legal entity.',
      );
  } else {
    tenantId = randomUUID();
    const [entity] = await m.query(
      `INSERT INTO finance_legal_entities(tenant_id,entity_code,legal_name,business_profile,jurisdiction_code)
      VALUES($1,'PRIMARY',$2,$3,'TZ') RETURNING id`,
      [tenantId, company.name, input.businessProfile],
    );
    legalEntityId = entity.id;
  }
  const [book] = await m.query(
    'INSERT INTO finance_accounting_books(tenant_id,legal_entity_id,book_code) VALUES($1,$2,$3) RETURNING id',
    [tenantId, legalEntityId, input.bookCode],
  );
  const ids = [tenantId, legalEntityId, book.id];
  const persons = new Set<string>();
  for (const staff of people) {
    const releaseOfficer = staff.id === user.id;
    const reviewer = staff.id !== input.preparerUserId;
    const known = await m.query(
      'SELECT DISTINCT natural_person_id FROM finance_foundation_identity_bindings WHERE source_user_id=$1',
      [staff.id],
    );
    if (known.length > 1)
      throw new ConflictException(
        'Reconcile the existing natural-person identities before making this appointment.',
      );
    const naturalPerson = known[0]?.natural_person_id ?? staff.id;
    if (persons.has(naturalPerson))
      throw new ConflictException(
        'The preparer and reviewer must be different people.',
      );
    persons.add(naturalPerson);
    const args = [
      ...ids,
      staff.id,
      naturalPerson,
      input.authorityReference,
      input.validUntil,
    ];
    await m.query(
      `INSERT INTO finance_foundation_identity_bindings(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from,valid_to,source_company_id,source_user_id)
      VALUES($1,$2,$3,$4,$5,$6,statement_timestamp(),$7::date,$8,$4)`,
      [...args, company.id],
    );
    if (releaseOfficer || !reviewer)
      await m.query(
        `INSERT INTO finance_configuration_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from,valid_to,state,permission)
      VALUES($1,$2,$3,$4,$5,$6,statement_timestamp(),$7::date,'ENABLED',$8)`,
        [...args, reviewer ? 'REVIEW_CONFIG' : 'PREPARE_CONFIG'],
      );
    await m.query(
      `INSERT INTO finance_foundation_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from,valid_to,company_role,capability,limits)
      SELECT $1,$2,$3,$4,$5,$6,statement_timestamp(),$7::date,$8,cap,CASE WHEN cap='ACCEPT' THEN $10::jsonb ELSE '{}'::jsonb END FROM unnest($9::text[]) cap`,
      [
        ...args,
        releaseOfficer ? 'COMPANY_ADMIN' : 'FINANCE_OPERATOR',
        releaseOfficer
          ? ['READ', 'REVIEW', 'ACCEPT', 'RELEASE']
          : reviewer
            ? ['READ', 'ACCEPT']
            : ['READ', 'PREPARE'],
        input.limits,
      ],
    );
    await m.query(
      `INSERT INTO finance_journal_candidate_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from,valid_to,state,permission)
      SELECT $1,$2,$3,$4,$5,$6,statement_timestamp(),$7::date,'ENABLED',cap FROM unnest($8::text[]) cap`,
      [
        ...args,
        releaseOfficer
          ? ['VALIDATE_CANDIDATE', 'MANAGE_DRAFT_PERIOD']
          : reviewer
            ? ['VALIDATE_CANDIDATE']
            : ['PREPARE_CANDIDATE'],
      ],
    );
    if (reviewer) {
      await m.query(
        `INSERT INTO finance_approval_mandates(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from,valid_to,state,role_code,currency,max_amount,version)
        SELECT $1,$2,$3,$4,$5,$6,statement_timestamp(),$7::date,'ENABLED',$8,key,value::numeric,1 FROM jsonb_each_text($9::jsonb)`,
        [...args, input.approvalRole, input.limits],
      );
      if (releaseOfficer)
        await m.query(
          `INSERT INTO finance_policy_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from,valid_to,company_role,capability)
        VALUES($1,$2,$3,$4,$5,$6,statement_timestamp(),$7::date,'COMPANY_ADMIN','ACTIVATE')`,
          args,
        );
    }
  }
  return { tenantId, legalEntityId, bookId: book.id, bookCode: input.bookCode };
}
