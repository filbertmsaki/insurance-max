import { realpathSync } from 'node:fs';
import { DataSource, EntityManager } from 'typeorm';
import { readAiclFin01Demonstration } from './data/aicl-fin-01-reader';

const TEST_DATABASE =
  /^insurance_portal_test_\d{14}_[a-z0-9]{6}(?:_[a-z0-9]{1,12})?$/;

/** This seeder creates only draft scope rows in an explicitly isolated test cluster. */
export async function seedAiclFin01Demo(
  source: DataSource,
  options: { apply: boolean; env?: NodeJS.ProcessEnv },
) {
  const env = options.env ?? process.env;
  const config = source.options;
  if (
    env.NODE_ENV !== 'test' ||
    env.APP_ENV !== 'test' ||
    env.FINANCE_TEST_PG_ENABLED !== '1' ||
    env.FINANCE_AICL_DEMO_SEED !== '1' ||
    !env.FINANCE_TEST_PG_CLUSTER_DIRECTORY ||
    config.type !== 'postgres' ||
    !['127.0.0.1', '::1'].includes(String(config.host)) ||
    config.host !== env.FINANCE_TEST_PG_HOST ||
    Number(config.port) !== Number(env.FINANCE_TEST_PG_PORT) ||
    !Number.isInteger(Number(config.port)) ||
    Number(config.port) < 1024 ||
    Number(config.port) === 5432 ||
    config.username !== env.FINANCE_TEST_PG_USER ||
    config.password !== env.FINANCE_TEST_PG_PASSWORD ||
    !env.FINANCE_TEST_PG_USER ||
    !env.FINANCE_TEST_PG_PASSWORD ||
    typeof config.database !== 'string' ||
    !TEST_DATABASE.test(config.database) ||
    config.synchronize ||
    config.migrationsRun ||
    config.ssl
  )
    throw new Error(
      'AICL demo seeding requires an explicitly enabled isolated Finance test database.',
    );

  const proposal = readAiclFin01Demonstration();
  return source.transaction('SERIALIZABLE', async (manager: EntityManager) => {
    const [identity] = await manager.query(
      "SELECT current_database() AS name, inet_server_port() AS port, current_setting('data_directory') AS directory",
    );
    if (
      identity.name !== config.database ||
      Number(identity.port) !== Number(config.port) ||
      realpathSync(identity.directory) !==
        realpathSync(env.FINANCE_TEST_PG_CLUSTER_DIRECTORY!)
    )
      throw new Error(
        'AICL demo database identity does not match the owned test cluster.',
      );

    const companies = await manager.query(
      'SELECT id, name FROM companies WHERE slug=$1 AND deleted_at IS NULL FOR SHARE',
      [proposal.companyLookup.slug],
    );
    if (
      companies.length !== 1 ||
      companies[0].name !== proposal.companyLookup.expectedName
    )
      throw new Error(
        'Exactly one matching existing Alliance company is required.',
      );
    const companyId = companies[0].id;
    const tenants = await manager.query(
      `SELECT DISTINCT tenant_id FROM finance_foundation_identity_bindings WHERE source_company_id=$1 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp())`,
      [companyId],
    );
    if (tenants.length !== 1)
      throw new Error(
        'One current trusted Finance tenant binding for the company is required.',
      );
    const tenantId = tenants[0].tenant_id;
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      ['AICL-FIN-01-DEMO/' + tenantId],
    );
    const existing = await manager.query(
      'SELECT * FROM finance_legal_entities WHERE tenant_id=$1 AND entity_code=$2 FOR UPDATE',
      [tenantId, proposal.entity.code],
    );
    let entity = existing[0];
    if (
      entity &&
      (entity.state !== 'DRAFT' ||
        entity.legal_name !== proposal.entity.legalName ||
        entity.business_profile !== proposal.entity.profile ||
        entity.jurisdiction_code !== proposal.entity.jurisdiction)
    )
      throw new Error(
        'Existing entity conflicts with the requested draft; no changes made.',
      );
    const log: string[] = [];
    if (!entity && options.apply) {
      [entity] = await manager.query(
        "INSERT INTO finance_legal_entities(tenant_id,entity_code,legal_name,business_profile,jurisdiction_code,state) VALUES($1,$2,$3,$4,$5,'DRAFT') RETURNING *",
        [
          tenantId,
          proposal.entity.code,
          proposal.entity.legalName,
          proposal.entity.profile,
          proposal.entity.jurisdiction,
        ],
      );
      log.push('created entity ' + proposal.entity.code);
    } else
      log.push(
        (entity ? 'reused' : 'would create') +
          ' entity ' +
          proposal.entity.code,
      );

    for (const book of proposal.books) {
      const rows = entity
        ? await manager.query(
            'SELECT * FROM finance_accounting_books WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_code=$3 FOR UPDATE',
            [tenantId, entity.id, book.code],
          )
        : [];
      if (
        rows[0] &&
        (rows[0].state !== 'DRAFT' ||
          rows[0].accounting_basis_code !== null ||
          rows[0].functional_assessment_id !== null ||
          rows[0].calendar_id !== null ||
          rows[0].chart_release_id !== null ||
          rows[0].presentation_context_id !== null)
      )
        throw new Error(
          'Existing book is not an unconfigured draft: ' + book.code,
        );
      if (!rows.length && options.apply) {
        await manager.query(
          "INSERT INTO finance_accounting_books(tenant_id,legal_entity_id,book_code,state) VALUES($1,$2,$3,'DRAFT')",
          [tenantId, entity.id, book.code],
        );
        log.push('created book ' + book.code);
      } else
        log.push(
          (rows.length ? 'reused' : 'would create') + ' book ' + book.code,
        );
    }
    return {
      mode: options.apply ? 'APPLIED_DEMO_DRAFT' : 'DRY_RUN',
      companyId,
      tenantId,
      entityId: entity?.id ?? null,
      log,
      postingEnabled: false,
      skipped: [
        'source mapping',
        'identifiers and documents',
        'people and permissions',
        'product mappings',
        'accounting basis and currencies',
        'calendar and periods',
        'chart',
        'opening balances',
        'approvals and release',
      ],
    };
  });
}
