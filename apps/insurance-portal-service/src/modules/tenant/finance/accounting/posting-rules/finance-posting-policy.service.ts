import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  policyDate,
  policyDefinition,
  policyDefinitionHash,
} from '../../governance/accounting-policies/finance-policy.types';

export interface LegacyPostingSubject {
  companyId: string;
  sourceType: string;
  currency: string;
  date: string;
  accountMappings: { code: string; type: string }[];
}

/** No environment bypass. Missing governance is a visible posting hold. */
@Injectable()
export class FinancePostingPolicyService {
  async requireEligible(
    manager: EntityManager,
    subject: LegacyPostingSubject,
  ): Promise<void> {
    const hold = (detail: string): never => {
      throw new ConflictException({
        code: 'FINANCE_POSTING_HELD',
        message: detail,
      });
    };
    if (!manager.queryRunner?.isTransactionActive)
      hold(
        'An active database transaction is required for locked policy and period eligibility checks.',
      );
    policyDate(subject.date);
    const [schema] = await manager.query(
      "SELECT to_regclass('public.finance_policy_posting_releases') IS NOT NULL AS deployed",
    );
    if (!schema?.deployed)
      hold(
        'Accounting policy governance is not deployed. Confirmed payments remain recorded; journal posting requires an approved deployment and activation release.',
      );
    // Locks prevent a concurrent deactivation from racing the accounting write.
    // Legacy four-digit journals may only serve an explicitly approved operational
    // bridge; they cannot represent IFRS 17 service revenue or translated books.
    const releases = await manager.query(
      `SELECT r.*,p.definition FROM finance_policy_posting_releases r JOIN finance_policy_versions p ON p.tenant_id=r.tenant_id AND p.legal_entity_id=r.legal_entity_id AND p.book_id=r.book_id AND p.id=r.policy_id JOIN finance_accounting_books b ON b.tenant_id=r.tenant_id AND b.legal_entity_id=r.legal_entity_id AND b.id=r.book_id JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id JOIN LATERAL(SELECT to_state FROM finance_policy_events WHERE policy_id=p.id ORDER BY sequence DESC LIMIT 1) e ON true WHERE r.source_company_id=$1 AND $2=ANY(r.source_types) AND r.currency=$3 AND e.to_state='ACTIVE' AND p.definition_hash=r.policy_hash AND p.profile<>'PLATFORM_TEMPLATE' AND p.definition->>'accountingLayer'='OPERATIONAL' AND r.basis='OPERATIONAL_BRIDGE' AND b.state='ACTIVE' AND l.state='ACTIVE' AND r.active_from<=$4::date AND r.active_to>$4::date AND r.period_start<=$4::date AND r.period_end>$4::date FOR SHARE OF p,b,l`,
      [subject.companyId, subject.sourceType, subject.currency, subject.date],
    );
    if (releases.length !== 1)
      hold(
        'No unique active company, entity, book, source-event, currency and open-period release authorizes this journal. Policy approval, ledger setup and tests alone do not authorize posting.',
      );
    const release = releases[0];
    const [{ foundation }] = await manager.query(
      "SELECT to_regclass('public.finance_foundation_deployments') IS NOT NULL foundation",
    );
    if (foundation) {
      const [owner] = await manager.query(
        'SELECT action FROM finance_foundation_deployments WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 ORDER BY sequence DESC LIMIT 1',
        [release.tenant_id, release.legal_entity_id, release.book_id],
      );
      if (owner?.action === 'ENABLE')
        hold(
          'The canonical Finance foundation owns posting for this book. A parallel legacy journal would create a duplicate accounting effect.',
        );
    }
    const definition = policyDefinition(release.definition);
    if (
      policyDefinitionHash(definition) !== release.policy_hash ||
      definition.configuration.sourceCompanyId !== subject.companyId
    )
      hold(
        'The source-company binding or frozen policy content does not match its approved release.',
      );
    const mappings = definition.configuration.legacyAccountMappings;
    if (
      !mappings ||
      typeof mappings !== 'object' ||
      Array.isArray(mappings) ||
      subject.accountMappings.some(
        (m) => (mappings as Record<string, unknown>)[m.code] !== m.type,
      )
    )
      hold(
        'A required posting account is not included in the approved policy mapping.',
      );
    if (release.functional_currency !== subject.currency)
      hold(
        'This legacy ledger has no governed functional-currency amount vector. Foreign-currency accounting requires the accepted B43 ledger implementation.',
      );
    if (
      release.definition.unresolvedDecisions?.length ||
      release.definition.effectiveFrom > subject.date ||
      (release.definition.effectiveTo &&
        release.definition.effectiveTo <= subject.date)
    )
      hold(
        'The approved policy has an unresolved decision or is outside its effective interval.',
      );
    for (const hash of release.definition.dependencyPolicyHashes ?? []) {
      const [dependency] = await manager.query(
        `SELECT p.id FROM finance_policy_versions p JOIN LATERAL(SELECT to_state FROM finance_policy_events WHERE policy_id=p.id ORDER BY sequence DESC LIMIT 1) e ON true WHERE p.tenant_id=$1 AND p.legal_entity_id=$2 AND p.book_id=$3 AND p.definition_hash=$4 AND e.to_state='ACTIVE' FOR SHARE OF p`,
        [release.tenant_id, release.legal_entity_id, release.book_id, hash],
      );
      if (!dependency)
        hold('A required scoped policy dependency is no longer active.');
    }
  }
}
