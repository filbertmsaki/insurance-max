import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { createIntegrationFixture } from './finance-integration-fixture';
import { FinanceOperationsService } from '../../src/modules/tenant/billing-commission/foundation/finance-operations.service';
import {
  OPERATIONS_PERMISSIONS,
  type OperationsActor,
  type OperationsScope,
  type OperationsProfile,
  type OperationsPermission,
} from '../../src/modules/tenant/billing-commission/foundation/finance-operations.types';

export async function createOperationsFixture(
  source: DataSource,
  options: Partial<OperationsProfile> = {},
) {
  const f = await createIntegrationFixture(source, { maxAttempts: 1 });
  const profile = await f.review(0, {
    kind: 'EXCEPTION_RULES',
    key: 'SYNTHETIC-EXCEPTIONS',
    dependencyRefs: ['DEC-11', 'DEC-12', 'DEC-14'],
    payload: {
      schema: 'FINANCE_EXCEPTION_RULES_V1',
      purpose: 'INACTIVE_REFERENCE_ONLY',
      replayTtlSeconds: 300,
      additionalAttempts: 1,
      maxReplaysPerItem: 2,
      proposedOwnerDueSeconds: null,
      proposedEscalationSeconds: null,
      ...options,
    },
  });
  const service = new FinanceOperationsService(source),
    sourceScope: OperationsScope = { kind: 'SOURCE' },
    bookScope = (i = 0): OperationsScope => ({ kind: 'BOOK', ...f.scope(i) });
  const grant = async (
    p: OperationsActor,
    permission: OperationsPermission,
    s: OperationsScope = bookScope(),
  ) => {
    const [g] = await source.query(
      "INSERT INTO finance_operations_authorities(tenant_id,scope_kind,legal_entity_id,book_id,subject_id,natural_person_id,permission,state,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,$6,$7,'ENABLED','SYNTHETIC-ONLY','2020-01-01') RETURNING *",
      [
        p.tenantId,
        s.kind,
        s.kind === 'BOOK' ? s.legalEntityId : null,
        s.kind === 'BOOK' ? s.bookId : null,
        p.subjectId,
        p.naturalPersonId,
        permission,
      ],
    );
    return g;
  };
  for (const s of [sourceScope, bookScope(), bookScope(1)])
    for (const p of [f.maker, f.checker])
      for (const permission of OPERATIONS_PERMISSIONS)
        await grant(p, permission, s);
  const evidence = () => ({
    referenceId: 'SYNTHETIC-REMEDIATION',
    version: '1',
    hash: 'a'.repeat(64),
  });
  const profileRef = {
    legalEntityId: f.entity.id,
    bookId: f.books[0].id,
    id: profile.id,
  };
  const deadOutbox = async () => {
    await f.process();
    f.setSend(async () => {
      throw new Error('synthetic delivery failure');
    });
    await f.deliver();
    const [r] = await source.query(
      'SELECT * FROM finance_reference_outbox WHERE tenant_id=$1 AND book_id=$2',
      [f.tenantId, f.books[0].id],
    );
    return r;
  };
  const register = async (itemId: string, s: OperationsScope = bookScope()) =>
    service.register(
      f.maker,
      s,
      itemId,
      profileRef,
      'synthetic failure ownership',
    );
  const owned = async () => {
    const item = await deadOutbox();
    const c = await register(item.id);
    const ref = await service.assign(
      f.maker,
      bookScope(),
      c,
      f.maker,
      'synthetic owner assignment',
    );
    return { item, ref };
  };
  const approved = async () => {
    const { item, ref } = await owned();
    const replay = await service.prepareReplay(
      f.maker,
      bookScope(),
      ref,
      evidence(),
      'synthetic remediation',
    );
    await service.reviewReplay(
      f.checker,
      bookScope(),
      replay,
      'APPROVED',
      'synthetic independent review',
    );
    return { item, ref, replay };
  };
  const human = (): OperationsActor => ({
    kind: 'USER',
    tenantId: f.tenantId,
    subjectId: randomUUID(),
    naturalPersonId: randomUUID(),
  });
  return {
    ...f,
    ops: service,
    opsProfile: profile,
    sourceScope,
    bookScope,
    opsGrant: grant,
    evidence,
    profileRef,
    deadOutbox,
    register,
    owned,
    approved,
    human,
  };
}
