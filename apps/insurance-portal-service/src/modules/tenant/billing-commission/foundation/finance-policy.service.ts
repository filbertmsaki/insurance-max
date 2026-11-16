import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  financeConfigurationHash,
  FINANCE_UUID,
} from './finance-configuration.types';
import {
  FinancePolicyAction,
  FinancePolicyActor,
  FinancePolicyDefinition,
  FinancePolicyScope,
  FinancePolicyState,
  nextPolicyState,
  policyDefinition,
  policyDefinitionHash,
  policyHash,
  policyScope,
} from './finance-policy.types';

/** Internal governance commands. No public API, automatic grants or release writer. */
@Injectable()
export class FinancePolicyService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}

  async prepare(
    scope: FinancePolicyScope,
    actor: FinancePolicyActor,
    input: FinancePolicyDefinition,
  ) {
    policyScope(scope, actor);
    scope = {
      tenantId: scope.tenantId.toLowerCase(),
      legalEntityId: scope.legalEntityId.toLowerCase(),
      bookId: scope.bookId.toLowerCase(),
    };
    actor = {
      subjectId: actor.subjectId.toLowerCase(),
      naturalPersonId: actor.naturalPersonId.toLowerCase(),
    };
    const definition = policyDefinition(input);
    return this.source.transaction(async (manager) => {
      const authority = await this.authority(manager, scope, actor, 'PREPARE');
      const [row] = await manager.query(
        `INSERT INTO finance_policy_versions
        (tenant_id,legal_entity_id,book_id,policy_code,version,profile,definition,definition_hash,maker_subject_id,maker_natural_person_id,authority_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,definition_hash`,
        [
          ...this.scope(scope),
          definition.policyCode,
          definition.version,
          definition.profile,
          definition,
          policyDefinitionHash(definition),
          actor.subjectId,
          actor.naturalPersonId,
          authority.id,
        ],
      );
      return {
        id: row.id as string,
        definitionHash: row.definition_hash as string,
        state: 'DRAFT' as const,
        financialEffects: 0 as const,
      };
    });
  }

  async transition(
    scope: FinancePolicyScope,
    actor: FinancePolicyActor,
    id: string,
    expectedHash: string,
    action: FinancePolicyAction,
    evidenceHash: string,
    reason: string,
  ) {
    policyScope(scope, actor);
    policyHash(expectedHash);
    policyHash(evidenceHash);
    if (typeof id !== 'string' || !FINANCE_UUID.test(id))
      throw new ConflictException('An exact policy UUID is required.');
    id = id.toLowerCase();
    scope = {
      tenantId: scope.tenantId.toLowerCase(),
      legalEntityId: scope.legalEntityId.toLowerCase(),
      bookId: scope.bookId.toLowerCase(),
    };
    actor = {
      subjectId: actor.subjectId.toLowerCase(),
      naturalPersonId: actor.naturalPersonId.toLowerCase(),
    };
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 4000)
      throw new ConflictException(
        'A bounded review, nonapplicability or retirement justification is required.',
      );
    return this.source.transaction(async (manager) => {
      const capability = ['APPROVE', 'NOT_APPLICABLE', 'RETIRE'].includes(
        action,
      )
        ? 'APPROVE'
        : ['ACTIVATE', 'DEACTIVATE'].includes(action)
          ? 'ACTIVATE'
          : action === 'VALIDATE'
            ? 'VALIDATE'
            : 'PREPARE';
      const authority = await this.authority(manager, scope, actor, capability);
      const [row] = await manager.query(
        'SELECT * FROM finance_policy_versions WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR UPDATE',
        [...this.scope(scope), id],
      );
      if (
        !row ||
        row.definition_hash !== expectedHash ||
        policyDefinitionHash(row.definition) !== expectedHash
      )
        throw new ForbiddenException(
          'Exact immutable policy version is not available in this scope.',
        );
      const [last] = await manager.query(
        'SELECT * FROM finance_policy_events WHERE policy_id=$1 ORDER BY sequence DESC LIMIT 1',
        [id],
      );
      const state: FinancePolicyState = last?.to_state ?? 'DRAFT';
      const next = nextPolicyState(
        state,
        action,
        row.definition.unresolvedDecisions,
        evidenceHash,
      );
      if (
        [
          'VALIDATE',
          'APPROVE',
          'ACTIVATE',
          'DEACTIVATE',
          'RETIRE',
          'NOT_APPLICABLE',
        ].includes(action) &&
        (row.maker_subject_id === actor.subjectId ||
          row.maker_natural_person_id === actor.naturalPersonId)
      )
        throw new ForbiddenException(
          'The policy preparer cannot independently validate, approve or activate the same version, including through another login.',
        );
      if (
        ['VALIDATE', 'APPROVE', 'ACTIVATE'].includes(action) &&
        !row.definition.evidenceReferences.length
      )
        throw new ConflictException(
          'Required configuration, legal and specialist evidence must be referenced before review.',
        );
      if (action === 'ACTIVATE') {
        if (row.profile === 'PLATFORM_TEMPLATE')
          throw new ConflictException(
            'A platform template is not a company policy or posting authority.',
          );
        const [release] = await manager.query(
          'SELECT id FROM finance_policy_posting_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND policy_id=$4 AND policy_hash=$5 AND b45_evidence_hash=$6',
          [...this.scope(scope), id, expectedHash, evidenceHash],
        );
        let foundationRelease = false;
        const [{ deployed }] = await manager.query(
          "SELECT to_regprocedure('finance_foundation_policy_release(uuid,text,text)') IS NOT NULL deployed",
        );
        if (deployed) {
          const [r] = await manager.query(
            'SELECT finance_foundation_policy_release($1,$2,$3) AS approved',
            [id, expectedHash, evidenceHash],
          );
          foundationRelease = r.approved === true;
        }
        if (!release && !foundationRelease)
          throw new ConflictException(
            'Independent B43-B45 deployment, reconciliation and activation release evidence is required. Tests and policy approval cannot create it.',
          );
        for (const dependency of row.definition.dependencyPolicyHashes) {
          const [active] = await manager.query(
            `SELECT p.id FROM finance_policy_versions p JOIN LATERAL (SELECT to_state FROM finance_policy_events WHERE policy_id=p.id ORDER BY sequence DESC LIMIT 1) e ON true WHERE p.tenant_id=$1 AND p.legal_entity_id=$2 AND p.book_id=$3 AND p.definition_hash=$4 AND e.to_state='ACTIVE'`,
            [...this.scope(scope), dependency],
          );
          if (!active)
            throw new ConflictException(
              'An exact dependent policy version is not active in this book.',
            );
        }
      }
      const content = {
        policyId: id,
        definitionHash: expectedHash,
        sequence: Number(last?.sequence ?? 0) + 1,
        fromState: state,
        toState: next,
        action,
        actorSubjectId: actor.subjectId,
        actorNaturalPersonId: actor.naturalPersonId,
        authorityId: authority.id,
        reason,
        evidenceHash,
        previousHash: last?.event_hash ?? expectedHash,
      };
      const eventHash = financeConfigurationHash(content);
      await manager.query(
        `INSERT INTO finance_policy_events(tenant_id,legal_entity_id,book_id,policy_id,sequence,from_state,to_state,action,actor_subject_id,actor_natural_person_id,authority_id,reason,evidence_hash,previous_hash,event_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          ...this.scope(scope),
          id,
          content.sequence,
          state,
          next,
          action,
          actor.subjectId,
          actor.naturalPersonId,
          authority.id,
          reason,
          evidenceHash,
          content.previousHash,
          eventHash,
        ],
      );
      return {
        policyId: id,
        definitionHash: expectedHash,
        state: next,
        eventHash,
        financialEffects: 0 as const,
      };
    });
  }

  private scope(s: FinancePolicyScope) {
    return [s.tenantId, s.legalEntityId, s.bookId];
  }
  private async authority(
    manager: EntityManager,
    scope: FinancePolicyScope,
    actor: FinancePolicyActor,
    capability: string,
  ) {
    const rows = await manager.query(
      `SELECT a.* FROM finance_policy_authorities a JOIN finance_accounting_books b ON b.tenant_id=a.tenant_id AND b.legal_entity_id=a.legal_entity_id AND b.id=a.book_id JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id WHERE a.tenant_id=$1 AND a.legal_entity_id=$2 AND a.book_id=$3 AND a.subject_id=$4 AND a.natural_person_id=$5 AND a.company_role IN ('COMPANY_ADMIN','FINANCE_POLICY_PREPARER','FINANCE_POLICY_VALIDATOR') AND a.capability=$6 AND a.revoked_at IS NULL AND a.valid_from<=statement_timestamp() AND (a.valid_to IS NULL OR a.valid_to>statement_timestamp()) AND b.state<>'DISABLED' AND l.state<>'DISABLED' FOR SHARE OF a,b,l`,
      [
        ...this.scope(scope),
        actor.subjectId,
        actor.naturalPersonId,
        capability,
      ],
    );
    if (rows.length !== 1)
      throw new ForbiddenException(
        'An unambiguous, current, company-scoped mandate for this action (company admin for approval or activation) is required. No global admin fallback is permitted.',
      );
    return rows[0];
  }
}
