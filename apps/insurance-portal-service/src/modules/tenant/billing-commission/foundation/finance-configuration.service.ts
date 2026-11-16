import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { FinanceAccountingBook } from './entities/finance-accounting-book.entity';
import { FinanceLegalEntity } from './entities/finance-legal-entity.entity';
import { FinanceLegalEntitySourceMap } from './entities/finance-legal-entity-source-map.entity';
import { FinanceConfigurationAuthority } from './entities/finance-configuration-authority.entity';
import { FinanceConfigurationRelease } from './entities/finance-configuration-release.entity';
import { FinanceConfigurationEvent } from './entities/finance-configuration-event.entity';
import type { FinanceBookSelection } from './finance-scope.service';
import { validateApprovalProfile } from './finance-approval.types';
import { validateEventContract } from './finance-event.types';
import { validateIntegrationProfile } from './finance-integration.types';
import { operationsProfile } from './finance-operations.types';
import { billingProfile } from './finance-quotation-billing.types';
import { receivableProfile } from './finance-receivables.types';
import {
  verifyEventRoute,
  eventRouteSnapshot,
  verifyEventRouteSnapshot,
} from './finance-event-route.snapshot';
import {
  prepareFinanceChartSnapshot,
  verifyFinanceChartSnapshot,
} from './finance-chart.snapshot';
import {
  canonicalFinanceJson,
  CONFIGURATION_KINDS,
  FINANCE_UUID,
  financeConfigurationHash,
  isFinanceDate,
  type FinanceConfigurationActor,
  type FinanceConfigurationInput,
  type FinanceSourceReadCheck,
} from './finance-configuration.types';

@Injectable()
export class FinanceConfigurationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource | EntityManager,
  ) {}

  async createDraft(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    input: FinanceConfigurationInput,
    reason: string,
  ) {
    ({ actor, scope } = this.identities(actor, scope));
    this.validateInput(input);
    this.reason(reason);
    input = {
      ...input,
      dependencyRefs: [...input.dependencyRefs],
      sourceMapIds: input.sourceMapIds ? [...input.sourceMapIds] : undefined,
      payload: input.payload
        ? JSON.parse(canonicalFinanceJson(input.payload))
        : undefined,
    };
    return this.command(
      actor,
      scope,
      'PREPARE_CONFIG',
      async (manager, profile, checks) => {
        const ids = input.sourceMapIds?.map((id) => id.toLowerCase()).sort();
        let payload: Record<string, unknown>;
        if (input.kind === 'SOURCE_ASSOCIATIONS') {
          if (
            input.payload !== undefined ||
            !ids?.length ||
            new Set(ids).size !== ids.length ||
            ids.some((id) => !FINANCE_UUID.test(id))
          )
            throw new BadRequestException(
              'Source association proposals require distinct sourceMapIds and no arbitrary payload.',
            );
          payload = await this.sourceSnapshot(
            manager,
            actor,
            scope,
            ids,
            profile,
            input.effectiveFrom,
            input.effectiveTo ?? null,
          );
        } else if (input.kind === 'RECEIVABLE_CONTROLS') {
          if (input.sourceMapIds !== undefined)
            throw new BadRequestException(
              'Receivable control profiles cannot reassign source ownership.',
            );
          payload = receivableProfile(
            input.payload,
            input.dependencyRefs,
          ) as unknown as Record<string, unknown>;
        } else if (input.kind === 'QUOTATION_BILLING_RULES') {
          if (input.sourceMapIds !== undefined)
            throw new BadRequestException(
              'Billing memorandum rules cannot reassign source ownership.',
            );
          payload = billingProfile(
            input.payload,
            input.dependencyRefs,
          ) as unknown as Record<string, unknown>;
        } else if (input.kind === 'EXCEPTION_RULES') {
          if (input.sourceMapIds !== undefined)
            throw new BadRequestException(
              'Exception profiles cannot choose source associations.',
            );
          payload = operationsProfile(
            input.payload,
            input.dependencyRefs,
          ) as unknown as Record<string, unknown>;
        } else if (input.kind === 'INTEGRATION_RULES') {
          if (input.sourceMapIds !== undefined)
            throw new BadRequestException(
              'Reliability profiles cannot choose financial source associations.',
            );
          payload = validateIntegrationProfile(
            input.payload,
            input.dependencyRefs,
          ) as unknown as Record<string, unknown>;
        } else if (
          input.kind === 'EVENT_CONTRACTS' ||
          input.kind === 'EVENT_ROUTES'
        ) {
          if (input.sourceMapIds !== undefined)
            throw new BadRequestException(
              'Event definitions require exact typed references rather than sourceMapIds.',
            );
          if (input.kind === 'EVENT_CONTRACTS')
            payload = validateEventContract(
              input.payload,
              input.dependencyRefs,
            ) as unknown as Record<string, unknown>;
          else {
            const validated = await verifyEventRoute(
              manager,
              actor,
              scope,
              profile,
              input.payload,
              input.effectiveFrom,
              input.effectiveTo ?? null,
              input.dependencyRefs,
            );
            payload = eventRouteSnapshot(validated);
          }
        } else if (input.kind === 'APPROVAL_RULES') {
          if (input.sourceMapIds !== undefined)
            throw new BadRequestException(
              'Approval profiles cannot select source associations.',
            );
          payload = validateApprovalProfile(
            input.payload,
            input.dependencyRefs,
          ) as unknown as Record<string, unknown>;
        } else if (input.kind === 'ACCOUNT_ROLES') {
          if (input.sourceMapIds !== undefined)
            throw new BadRequestException(
              'Chart proposals carry their source association inside the typed chart payload.',
            );
          payload = await prepareFinanceChartSnapshot(
            manager,
            actor,
            scope,
            profile,
            input.payload,
            input.effectiveFrom,
            input.effectiveTo ?? null,
            input.dependencyRefs,
            checks,
          );
        } else {
          if (
            input.sourceMapIds !== undefined ||
            !input.payload ||
            typeof input.payload !== 'object' ||
            Array.isArray(input.payload)
          )
            throw new BadRequestException(
              'Configuration requires an explicit JSON object payload.',
            );
          // Parse a detached snapshot: the caller cannot mutate it during awaits.
          payload = JSON.parse(canonicalFinanceJson(input.payload));
        }
        const old = input.supersedesId
          ? await manager.getRepository(FinanceConfigurationRelease).findOneBy({
              ...this.scope(actor, scope),
              id: input.supersedesId.toLowerCase(),
            })
          : null;
        if (
          input.supersedesId &&
          (!old ||
            old.state !== 'REVIEWED_INACTIVE' ||
            old.kind !== input.kind ||
            old.configuration_key !== input.key ||
            old.version >= input.version ||
            input.effectiveFrom < old.effective_from)
        )
          throw new ConflictException(
            'The proposed predecessor is not the current compatible reviewed version.',
          );
        const release = manager
          .getRepository(FinanceConfigurationRelease)
          .create({
            ...this.scope(actor, scope),
            id: randomUUID(),
            kind: input.kind,
            configuration_key: input.key,
            version: input.version,
            effective_from: input.effectiveFrom,
            effective_to: input.effectiveTo ?? null,
            payload,
            dependency_refs: [...input.dependencyRefs].sort(),
            maker_subject_id: actor.subjectId.toLowerCase(),
            maker_natural_person_id: actor.naturalPersonId.toLowerCase(),
            supersedes_id: old?.id ?? null,
            supersedes_hash: old?.release_hash ?? null,
            state: 'DRAFT',
          });
        release.release_hash = financeConfigurationHash(this.snapshot(release));
        const saved = await manager
          .getRepository(FinanceConfigurationRelease)
          .save(release);
        await this.event(manager, actor, saved, 'CREATED', reason, {}, checks);
        return saved;
      },
    );
  }

  async submit(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    id: string,
    expectedHash: string,
    reason: string,
  ) {
    ({ actor, scope } = this.identities(actor, scope));
    this.reference(id, expectedHash);
    this.reason(reason);
    return this.command(
      actor,
      scope,
      'PREPARE_CONFIG',
      async (manager, profile, checks) => {
        const release = await this.release(
          manager,
          actor,
          scope,
          id,
          expectedHash,
          'DRAFT',
        );
        if (
          release.maker_subject_id !== actor.subjectId.toLowerCase() ||
          release.maker_natural_person_id !==
            actor.naturalPersonId.toLowerCase()
        )
          throw new ForbiddenException(
            'Only the exact preparer may submit this configuration version.',
          );
        await this.verifySources(
          manager,
          actor,
          scope,
          release,
          profile,
          checks,
        );
        await manager
          .getRepository(FinanceConfigurationRelease)
          .update(release.id, {
            state: 'SUBMITTED',
            updated_at: () => 'statement_timestamp()',
          });
        await this.event(
          manager,
          actor,
          release,
          'SUBMITTED',
          reason,
          {},
          checks,
        );
        return { ...release, state: 'SUBMITTED' as const };
      },
    );
  }

  /** Content review only: never activation, policy election or posting authority. */
  async reviewInactive(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    id: string,
    expectedHash: string,
    decision: 'REVIEWED_INACTIVE' | 'REJECTED',
    reason: string,
  ) {
    ({ actor, scope } = this.identities(actor, scope));
    this.reference(id, expectedHash);
    this.reason(reason);
    if (!['REVIEWED_INACTIVE', 'REJECTED'].includes(decision))
      throw new BadRequestException(
        'Only inactive review or rejection is supported.',
      );
    return this.command(
      actor,
      scope,
      'REVIEW_CONFIG',
      async (manager, profile, checks) => {
        const release = await this.release(
          manager,
          actor,
          scope,
          id,
          expectedHash,
          'SUBMITTED',
        );
        this.independent(actor, release);
        if (decision === 'REVIEWED_INACTIVE') {
          await this.verifySources(
            manager,
            actor,
            scope,
            release,
            profile,
            checks,
          );
          const old = release.supersedes_id
            ? await this.release(
                manager,
                actor,
                scope,
                release.supersedes_id,
                release.supersedes_hash!,
                'REVIEWED_INACTIVE',
              )
            : null;
          if (old) {
            this.independent(actor, old);
            if (
              old.kind !== release.kind ||
              old.configuration_key !== release.configuration_key ||
              old.version >= release.version
            )
              throw new ConflictException('Incompatible predecessor.');
          }
          const overlaps = await manager
            .getRepository(FinanceConfigurationRelease)
            .createQueryBuilder('release')
            .where(
              'release.tenant_id = :tenant AND release.legal_entity_id = :entity AND release.book_id = :book',
              {
                tenant: release.tenant_id,
                entity: release.legal_entity_id,
                book: release.book_id,
              },
            )
            .andWhere(
              'release.kind = :kind AND release.configuration_key = :key AND release.state = :state',
              {
                kind: release.kind,
                key: release.configuration_key,
                state: 'REVIEWED_INACTIVE',
              },
            )
            .andWhere('release.id <> :id', { id: old?.id ?? release.id })
            .andWhere(
              "release.effective_from < COALESCE(CAST(:end AS date), 'infinity'::date)",
              { end: release.effective_to },
            )
            .andWhere(
              "CAST(:start AS date) < COALESCE(release.effective_to, 'infinity'::date)",
              { start: release.effective_from },
            )
            .getCount();
          if (overlaps)
            throw new ConflictException(
              'Reviewed configuration intervals overlap. An explicit compatible supersession is required.',
            );
          if (old) {
            await manager
              .getRepository(FinanceConfigurationRelease)
              .update(old.id, {
                state: 'SUPERSEDED_INACTIVE',
                updated_at: () => 'statement_timestamp()',
              });
            await this.event(
              manager,
              actor,
              old,
              'SUPERSEDED_INACTIVE',
              reason,
              { successorId: release.id, successorHash: release.release_hash },
              checks,
            );
          }
        }
        await manager
          .getRepository(FinanceConfigurationRelease)
          .update(release.id, {
            state: decision,
            updated_at: () => 'statement_timestamp()',
          });
        await this.event(manager, actor, release, decision, reason, {}, checks);
        return { ...release, state: decision };
      },
    );
  }

  private async command<T>(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    permission: FinanceConfigurationAuthority['permission'],
    work: (
      manager: EntityManager,
      businessProfile: string,
      checks: FinanceSourceReadCheck[],
    ) => Promise<T>,
  ): Promise<T> {
    if (
      !actor ||
      actor.kind !== 'USER' ||
      ![
        actor.tenantId,
        actor.subjectId,
        actor.naturalPersonId,
        scope?.legalEntityId,
        scope?.bookId,
      ].every((id) => typeof id === 'string' && FINANCE_UUID.test(id))
    )
      throw new ForbiddenException(
        'Verified human Finance identity and exact book scope are required.',
      );
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Same lock as source previews; take it before any book lock.
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          ['finance-inactive-config:' + actor.tenantId.toLowerCase()],
        );
        // Serialize changes/reviews for this book, including overlap decisions.
        const book = await manager
          .getRepository(FinanceAccountingBook)
          .createQueryBuilder('book')
          .where(
            'book.tenant_id = :tenant AND book.legal_entity_id = :entity AND book.id = :book AND book.state IN (:...scopeStates)',
            {
              tenant: actor.tenantId.toLowerCase(),
              entity: scope.legalEntityId.toLowerCase(),
              book: scope.bookId.toLowerCase(),
              scopeStates: ['DRAFT', 'ACTIVE'],
            },
          )
          .setLock('pessimistic_write')
          .getOne();
        if (!book)
          throw new ForbiddenException(
            'Finance configuration scope is unavailable.',
          );
        const entity = await manager
          .getRepository(FinanceLegalEntity)
          .createQueryBuilder('entity')
          .where(
            'entity.tenant_id = :tenant AND entity.id = :entity AND entity.state IN (:...scopeStates)',
            {
              tenant: actor.tenantId.toLowerCase(),
              entity: scope.legalEntityId.toLowerCase(),
              scopeStates: ['DRAFT', 'ACTIVE'],
            },
          )
          .setLock('pessimistic_read')
          .getOne();
        if (!entity)
          throw new ForbiddenException(
            'Finance configuration scope is unavailable.',
          );
        const authority = await manager
          .getRepository(FinanceConfigurationAuthority)
          .createQueryBuilder('authority')
          .where(
            'authority.tenant_id = :tenant AND authority.legal_entity_id = :entity AND authority.book_id = :book',
            {
              tenant: actor.tenantId.toLowerCase(),
              entity: scope.legalEntityId.toLowerCase(),
              book: scope.bookId.toLowerCase(),
            },
          )
          .andWhere(
            'authority.subject_id = :subject AND authority.natural_person_id = :person',
            {
              subject: actor.subjectId.toLowerCase(),
              person: actor.naturalPersonId.toLowerCase(),
            },
          )
          .andWhere(
            'authority.permission = :permission AND authority.state = :state AND authority.revoked_at IS NULL',
            { permission, state: 'ENABLED' },
          )
          .andWhere(
            'authority.valid_from <= statement_timestamp() AND (authority.valid_to IS NULL OR authority.valid_to > statement_timestamp())',
          )
          .setLock('pessimistic_read')
          .getOne();
        if (!authority)
          throw new ForbiddenException(
            'Current scoped configuration authority is required.',
          );
        const checks: FinanceSourceReadCheck[] = [];
        const result = await work(manager, entity.business_profile, checks);
        for (const check of checks) await check.verify();
        const [stillValid] = await manager.query(
          'SELECT id FROM finance_configuration_authorities WHERE id = $1 AND state = $2 AND revoked_at IS NULL AND valid_from <= statement_timestamp() AND (valid_to IS NULL OR valid_to > statement_timestamp())',
          [authority.id, 'ENABLED'],
        );
        if (!stillValid)
          throw new ForbiddenException(
            'Configuration authority expired before completion.',
          );
        return result;
      });
    } catch (error) {
      if (
        (error as { driverError?: { code?: string } })?.driverError?.code ===
        '23505'
      )
        throw new ConflictException(
          'Configuration version or decision already exists.',
        );
      throw error;
    }
  }

  private scope(actor: FinanceConfigurationActor, scope: FinanceBookSelection) {
    return {
      tenant_id: actor.tenantId.toLowerCase(),
      legal_entity_id: scope.legalEntityId.toLowerCase(),
      book_id: scope.bookId.toLowerCase(),
    };
  }
  private identities(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
  ) {
    if (
      !actor ||
      actor.kind !== 'USER' ||
      ![
        actor.tenantId,
        actor.subjectId,
        actor.naturalPersonId,
        scope?.legalEntityId,
        scope?.bookId,
      ].every((id) => typeof id === 'string' && FINANCE_UUID.test(id))
    )
      throw new ForbiddenException(
        'Verified human Finance identity and exact book scope are required.',
      );
    return {
      actor: Object.freeze({
        kind: 'USER' as const,
        tenantId: actor.tenantId.toLowerCase(),
        subjectId: actor.subjectId.toLowerCase(),
        naturalPersonId: actor.naturalPersonId.toLowerCase(),
      }),
      scope: Object.freeze({
        legalEntityId: scope.legalEntityId.toLowerCase(),
        bookId: scope.bookId.toLowerCase(),
      }),
    };
  }
  private snapshot(release: FinanceConfigurationRelease) {
    return {
      id: release.id,
      tenantId: release.tenant_id,
      legalEntityId: release.legal_entity_id,
      bookId: release.book_id,
      kind: release.kind,
      key: release.configuration_key,
      version: release.version,
      effectiveFrom: release.effective_from,
      effectiveTo: release.effective_to,
      payload: release.payload,
      dependencyRefs: release.dependency_refs,
      makerSubjectId: release.maker_subject_id,
      makerNaturalPersonId: release.maker_natural_person_id,
      supersedesId: release.supersedes_id,
      supersedesHash: release.supersedes_hash,
    };
  }
  private async release(
    manager: EntityManager,
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    id: string,
    hash: string,
    state: FinanceConfigurationRelease['state'],
  ) {
    const release = await manager
      .getRepository(FinanceConfigurationRelease)
      .findOne({
        where: { ...this.scope(actor, scope), id: id.toLowerCase() },
        lock: { mode: 'pessimistic_write' },
      });
    if (
      !release ||
      release.release_hash !== hash ||
      financeConfigurationHash(this.snapshot(release)) !== hash ||
      release.state !== state
    )
      throw new ConflictException(
        'Configuration subject, hash or expected state differs.',
      );
    return release;
  }
  private independent(
    actor: FinanceConfigurationActor,
    release: FinanceConfigurationRelease,
  ) {
    if (
      actor.subjectId.toLowerCase() === release.maker_subject_id ||
      actor.naturalPersonId.toLowerCase() === release.maker_natural_person_id
    )
      throw new ForbiddenException(
        'The preparer cannot review their own configuration, including through an alias.',
      );
  }
  private async event(
    manager: EntityManager,
    actor: FinanceConfigurationActor,
    release: FinanceConfigurationRelease,
    action: FinanceConfigurationEvent['action'],
    reason: string,
    details: Record<string, unknown> = {},
    checks: FinanceSourceReadCheck[] = [],
  ) {
    await manager.getRepository(FinanceConfigurationEvent).insert({
      tenant_id: release.tenant_id,
      legal_entity_id: release.legal_entity_id,
      book_id: release.book_id,
      release_id: release.id,
      action,
      actor_subject_id: actor.subjectId.toLowerCase(),
      actor_natural_person_id: actor.naturalPersonId.toLowerCase(),
      release_hash: release.release_hash,
      reason,
      details: {
        ...details,
        dependencyRefs: release.dependency_refs,
        financialActivation: false,
        sourceReadAuthorityIds: [
          ...new Set(checks.map((check) => check.authorityId)),
        ],
      },
    });
  }
  private async sourceSnapshot(
    manager: EntityManager,
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    ids: string[],
    profile: string,
    from: string,
    to: string | null,
  ): Promise<Record<string, unknown>> {
    const rows = await manager
      .getRepository(FinanceLegalEntitySourceMap)
      .createQueryBuilder('map')
      .where('map.tenant_id = :tenant AND map.legal_entity_id = :entity', {
        tenant: actor.tenantId.toLowerCase(),
        entity: scope.legalEntityId.toLowerCase(),
      })
      .andWhere('map.id IN (:...ids)', { ids })
      .orderBy('map.id', 'ASC')
      .setLock('pessimistic_read')
      .getMany();
    if (rows.length !== ids.length)
      throw new ConflictException(
        'Source references are missing or outside the legal entity.',
      );
    const originals = new Set<string>();
    for (const row of rows) {
      const key = JSON.stringify([
        row.source_system,
        row.source_company_id,
        row.legal_role,
        row.business_profile,
      ]);
      if (
        originals.has(key) ||
        row.state !== 'DRAFT' ||
        row.business_profile !== profile ||
        row.valid_from > from ||
        (row.valid_to && (!to || row.valid_to < to))
      )
        throw new ConflictException(
          'Source role, profile, interval or version is ambiguous or incompatible.',
        );
      originals.add(key);
    }
    return {
      schemaVersion: 1,
      sourceMaps: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        legalEntityId: row.legal_entity_id,
        sourceSystem: row.source_system,
        sourceCompanyId: row.source_company_id,
        legalRole: row.legal_role,
        businessProfile: row.business_profile,
        version: row.mapping_version,
        validFrom: row.valid_from,
        validTo: row.valid_to,
      })),
    };
  }
  private async verifySources(
    manager: EntityManager,
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    release: FinanceConfigurationRelease,
    profile: string,
    checks: FinanceSourceReadCheck[],
  ) {
    if (release.kind === 'RECEIVABLE_CONTROLS') {
      receivableProfile(release.payload, release.dependency_refs);
      return;
    }
    if (release.kind === 'QUOTATION_BILLING_RULES') {
      billingProfile(release.payload, release.dependency_refs);
      return;
    }
    if (release.kind === 'EXCEPTION_RULES') {
      operationsProfile(release.payload, release.dependency_refs);
      return;
    }
    if (release.kind === 'INTEGRATION_RULES') {
      validateIntegrationProfile(release.payload, release.dependency_refs);
      return;
    }
    if (release.kind === 'EVENT_CONTRACTS') {
      validateEventContract(release.payload, release.dependency_refs);
      return;
    }
    if (release.kind === 'EVENT_ROUTES') {
      await verifyEventRouteSnapshot(
        manager,
        actor,
        scope,
        profile,
        release.payload,
        release.effective_from,
        release.effective_to,
        release.dependency_refs,
      );
      return;
    }
    if (release.kind === 'APPROVAL_RULES') {
      validateApprovalProfile(release.payload, release.dependency_refs);
      return;
    }
    if (release.kind === 'ACCOUNT_ROLES') {
      await verifyFinanceChartSnapshot(
        manager,
        actor,
        scope,
        profile,
        release.payload,
        release.effective_from,
        release.effective_to,
        release.dependency_refs,
        checks,
      );
      return;
    }
    if (release.kind !== 'SOURCE_ASSOCIATIONS') return;
    const snapshots = release.payload.sourceMaps as { id: string }[];
    const current = await this.sourceSnapshot(
      manager,
      actor,
      scope,
      snapshots.map((row) => row.id),
      profile,
      release.effective_from,
      release.effective_to,
    );
    if (canonicalFinanceJson(current) !== canonicalFinanceJson(release.payload))
      throw new ConflictException(
        'Source records changed after the configuration snapshot. Create a new version.',
      );
  }
  private validateInput(input: FinanceConfigurationInput) {
    if (
      input?.sourceMapIds !== undefined &&
      (!Array.isArray(input.sourceMapIds) ||
        input.sourceMapIds.some(
          (id) => typeof id !== 'string' || !FINANCE_UUID.test(id),
        ))
    )
      throw new BadRequestException('Source map identifiers must be UUIDs.');
    if (
      !input ||
      !CONFIGURATION_KINDS.includes(input.kind) ||
      typeof input.key !== 'string' ||
      !input.key.trim() ||
      input.key !== input.key.trim() ||
      input.key.length > 100 ||
      !Number.isInteger(input.version) ||
      input.version < 1 ||
      input.version > 2147483647 ||
      !isFinanceDate(input.effectiveFrom) ||
      (input.effectiveTo != null &&
        (!isFinanceDate(input.effectiveTo) ||
          input.effectiveTo <= input.effectiveFrom)) ||
      !Array.isArray(input.dependencyRefs) ||
      input.dependencyRefs.some(
        (ref) => typeof ref !== 'string' || !/^[A-Z][A-Z0-9-]{1,63}$/.test(ref),
      ) ||
      new Set(input.dependencyRefs).size !== input.dependencyRefs.length ||
      (input.supersedesId != null && !FINANCE_UUID.test(input.supersedesId))
    )
      throw new BadRequestException(
        'Explicit kind, key, version, interval and dependency references are required.',
      );
  }
  private reference(id: string, hash: string) {
    if (
      typeof id !== 'string' ||
      !FINANCE_UUID.test(id) ||
      typeof hash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(hash)
    )
      throw new BadRequestException(
        'Exact configuration ID and subject hash are required.',
      );
  }
  private reason(value: string) {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException('A recorded reason is required.');
  }
}
