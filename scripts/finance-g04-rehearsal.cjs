/* Isolated full-history acceptance runner. Never loads .env or connects to DB_* targets. */
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
require('ts-node').register({
  project: path.join(repo, 'tsconfig.json'),
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'Node',
    resolvePackageJsonExports: false,
  },
});
require('tsconfig-paths').register({
  baseUrl: repo,
  paths: require(path.join(repo, 'tsconfig.json')).compilerOptions.paths,
});
require('reflect-metadata');
const { Client } = require('pg'),
  { DataSource } = require('typeorm'),
  { RequestContextService } = require('@insurance-max/shared-kernel');
const { readAiclFin01Demonstration } = require(
  path.join(
    repo,
    'apps/insurance-portal-service/src/database/seeds/data/aicl-fin-01-reader.ts',
  ),
);
const base = path.join(repo, 'apps/insurance-portal-service/src/modules'),
  load = (f, k) => require(path.join(base, f))[k];
const { createAppDataSourceOptions } = require(
  path.join(
    repo,
    'apps/insurance-portal-service/src/database/data-source.options.ts',
  ),
);
const { FinanceSetupService } = require(
    path.join(
      base,
      'tenant/billing-commission/foundation/finance-setup.service.ts',
    ),
  ),
  { FinanceSetupConfigurationService } = require(
    path.join(
      base,
      'tenant/billing-commission/foundation/finance-setup-configuration.service.ts',
    ),
  ),
  { financeConfigurationHash: hash } = require(
    path.join(
      base,
      'tenant/billing-commission/foundation/finance-configuration.types.ts',
    ),
  ),
  { FINANCE_SETUP_CATALOG } = require(
    path.join(
      base,
      'tenant/billing-commission/foundation/finance-setup.catalog.ts',
    ),
  ),
  { AuditService } = require(path.join(base, 'shared/audit/audit.service.ts'));
const env = process.env,
  template = env.FINANCE_G04_TEST_DATABASE,
  host = env.FINANCE_TEST_PG_HOST,
  port = Number(env.FINANCE_TEST_PG_PORT),
  user = env.FINANCE_TEST_PG_USER,
  password = env.FINANCE_TEST_PG_PASSWORD,
  cluster = env.FINANCE_G04_CLUSTER_DIRECTORY;
const aiclProposal =
  env.FINANCE_G04_AICL_DEMO === '1' ? readAiclFin01Demonstration() : null;
let aiclBook = aiclProposal
  ? aiclProposal.books.find(
      (book) =>
        book.code === (env.FINANCE_G04_AICL_BOOK || aiclProposal.books[0].code),
    )
  : null;
if (aiclProposal && !aiclBook)
  throw Error('Select an exact proposed AICL demo book.');
if (
  env.FINANCE_TEST_PG_ENABLED !== '1' ||
  env.NODE_ENV !== 'test' ||
  env.APP_ENV !== 'test' ||
  !['127.0.0.1', '::1'].includes(host) ||
  !Number.isInteger(port) ||
  port < 1024 ||
  port === 5432 ||
  !password ||
  !user ||
  !cluster ||
  !/^insurance_portal_test_\d{14}_[a-z0-9]{6}_g04tpl$/.test(template || '')
)
  throw Error(
    'Explicit isolated Finance G04 template, cluster and test connection are required. No source database fallback exists.',
  );
const database =
  'insurance_portal_test_' +
  new Date().toISOString().replace(/\D/g, '').slice(0, 14) +
  '_' +
  crypto.randomBytes(3).toString('hex') +
  '_g04run';
const quote = (v) => '"' + v.replaceAll('"', '""') + '"',
  report = {
    startedAt: new Date().toISOString(),
    purpose: 'DEMONSTRATION_ONLY',
    humanApprovals: 0,
    sourceDatabaseConnected: false,
    checks: [],
  },
  output = env.FINANCE_G04_OUTPUT ? path.resolve(env.FINANCE_G04_OUTPUT) : null;
const save = () => {
    if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2));
  },
  check = (name, ok, extra = {}) => {
    if (!ok) throw Error(name);
    report.checks.push({ name, passed: true, ...extra });
    save();
  },
  note = (phase) =>
    console.log(JSON.stringify({ phase, checksPassed: report.checks.length }));
let admin,
  ds,
  created = false,
  fixture;
async function expectDenied(name, work, status = 403) {
  let caught;
  try {
    await work();
  } catch (e) {
    caught = e;
  }
  check(name, !!caught && (status === null || caught.getStatus?.() === status));
}
async function originalFinancialState(s, excludeCompany) {
  const result = {};
  for (const table of [
    'invoices',
    'invoice_items',
    'receipts',
    'receipt_allocations',
    'finance_journal_entries',
    'finance_journal_lines',
    'finance_foundation_journals',
    'finance_foundation_lines',
  ])
    result[table] = await s.query(
      'SELECT md5(to_jsonb(t)::text) AS hash FROM ' +
        quote(table) +
        ' t ORDER BY to_jsonb(t)::text COLLATE "C"',
    );
  result.accounts = await s.query(
    'SELECT md5(to_jsonb(t)::text) AS hash FROM finance_accounts t' +
      (excludeCompany ? ' WHERE company_id<>$1' : '') +
      ' ORDER BY to_jsonb(t)::text COLLATE "C"',
    excludeCompany ? [excludeCompany] : [],
  );
  return result;
}

async function actorsAndScope(s, shared = null) {
  const entity = (f, k) => load(f, k),
    Company = entity(
      'platform/companies/entities/company.entity.ts',
      'Company',
    );
  const company =
    shared?.company ??
    (await s.getRepository(Company).save(
      s.getRepository(Company).create({
        name:
          'DEMONSTRATION G04 — NOT A REAL INSURER ' +
          crypto.randomBytes(3).toString('hex'),
        slug: 'g04-demo-' + crypto.randomBytes(6).toString('hex'),
        company_type: 'INSURANCE_COMPANY',
        status: 'active',
        verification_status: 'VERIFIED',
        verification_note:
          'SYNTHETIC TEST RECORD; not a real company verification',
        tira_license_number:
          aiclProposal?.entity.demonstrationIdentifiers.licence ??
          'DEMO-LICENCE-' + crypto.randomBytes(4).toString('hex'),
        tira_license_status: 'ACTIVE',
        license_issued_at: '2026-01-01',
        license_expires_at: '2026-12-31',
        tin:
          aiclProposal?.entity.demonstrationIdentifiers.tax ??
          'DEMO-TIN-NOT-VALID',
        brela_registration_number:
          aiclProposal?.entity.demonstrationIdentifiers.registration ??
          'DEMO-REG-NOT-VALID',
        default_currency: 'TZS',
        operating_timezone: 'Africa/Dar_es_Salaam',
        metadata: {
          purpose: 'DEMONSTRATION_ONLY',
          legalIdentifiersNotValid: true,
        },
      }),
    ));
  const tenantId = shared?.tenantId ?? crypto.randomUUID(),
    LegalEntity = entity(
      'tenant/billing-commission/foundation/entities/finance-legal-entity.entity.ts',
      'FinanceLegalEntity',
    ),
    Book = entity(
      'tenant/billing-commission/foundation/entities/finance-accounting-book.entity.ts',
      'FinanceAccountingBook',
    );
  const legal =
      shared?.legal ??
      (await s.getRepository(LegalEntity).save({
        tenant_id: tenantId,
        entity_code: aiclProposal?.entity.code ?? 'DEMO-G04',
        legal_name: company.name,
        business_profile: 'INSURER',
        jurisdiction_code: 'TZ',
        state: 'DRAFT',
      })),
    book = shared
      ? await s.getRepository(Book).findOneByOrFail({
          tenant_id: tenantId,
          legal_entity_id: legal.id,
          book_code: aiclBook.code,
        })
      : await s.getRepository(Book).save({
          tenant_id: tenantId,
          legal_entity_id: legal.id,
          book_code: aiclBook?.code ?? 'DEMONSTRATION-G04',
          state: 'DRAFT',
        }),
    scope = { legalEntityId: legal.id, bookId: book.id };
  if (aiclProposal && !shared) {
    for (const extra of aiclProposal.books.filter(
      (candidate) => candidate.code !== aiclBook.code,
    ))
      await s.getRepository(Book).save({
        tenant_id: tenantId,
        legal_entity_id: legal.id,
        book_code: extra.code,
        state: 'DRAFT',
      });
  }
  const productTemplate = (
    await s.query(
      'SELECT to_jsonb(p) AS row FROM insurance_products p WHERE p.current_version_id IS NOT NULL ORDER BY id LIMIT 1',
    )
  )[0].row;
  const versionTemplate = (
    await s.query(
      'SELECT to_jsonb(v) AS row FROM insurance_product_versions v WHERE id=$1',
      [productTemplate.current_version_id],
    )
  )[0].row;
  const categoryTemplate = (
    await s.query(
      'SELECT to_jsonb(c) AS row FROM insurance_categories c WHERE id=$1',
      [productTemplate.category_id],
    )
  )[0].row;
  const Category = entity(
      'tenant/insurance-categories/entities/insurance-category.entity.ts',
      'InsuranceCategory',
    ),
    Product = entity(
      'tenant/insurance-products/entities/insurance-product.entity.ts',
      'InsuranceProduct',
    ),
    Version = entity(
      'tenant/insurance-products/entities/insurance-product-version.entity.ts',
      'InsuranceProductVersion',
    );
  const category =
    shared?.category ??
    (await s.getRepository(Category).save({
      ...categoryTemplate,
      id: crypto.randomUUID(),
      company_id: company.id,
      parent_id: null,
    }));
  const product =
    shared?.product ??
    (await s.getRepository(Product).save({
      ...productTemplate,
      id: crypto.randomUUID(),
      company_id: company.id,
      category_id: category.id,
      product_code: 'DEMO_G04_PRODUCT',
      product_name: 'Demonstration product — no real insurance',
      policy_numbering_code: productTemplate.policy_numbering_code,
      current_version_id: null,
      latest_version_number: 1,
      is_active: true,
      lifecycle_status: 'ACTIVE',
    }));
  const version =
    shared?.version ??
    (await s.getRepository(Version).save({
      ...versionTemplate,
      id: crypto.randomUUID(),
      company_id: company.id,
      product_id: product.id,
      version_number: 1,
      status: 'ACTIVE',
      effective_from: '2026-01-01',
      effective_to: '2027-01-01',
    }));
  if (!shared)
    await s
      .getRepository(Product)
      .update(product.id, { current_version_id: version.id });
  const User = entity('tenant/users/entities/user.entity.ts', 'User'),
    Membership = entity(
      'platform/companies/entities/company-user.entity.ts',
      'CompanyUser',
    ),
    Role = entity('platform/roles/entities/role.entity.ts', 'Role');
  const ids = [tenantId, legal.id, book.id],
    people = [];
  const {
    hashPassword,
  } = require('@insurance-max/portal-shared/utils/hash.util');
  const credentials = [];
  for (const [index, name] of ['Preparer', 'Reviewer', 'Alias'].entries()) {
    const demoPassword = crypto.randomBytes(24).toString('base64url');
    const u = await s.getRepository(User).save({
      first_name: 'DEMO',
      last_name: name,
      email:
        'g04-' +
        name.toLowerCase() +
        '-' +
        crypto.randomBytes(4).toString('hex') +
        '@example.test',
      phone: '+2557' + String(crypto.randomInt(10000000, 99999999)),
      password: await hashPassword(demoPassword),
      status: 'active',
      user_type: 'COMPANY_USER',
      is_email_verified: false,
      is_phone_verified: false,
      officer_title: 'SYNTHETIC TEST ONLY',
    });
    const membership = await s.getRepository(Membership).save({
      company_id: company.id,
      user_id: u.id,
      status: 'active',
      is_default: true,
    });
    const role =
      (await s.getRepository(Role).findOne({
        where: {
          company_id: company.id,
          name: index ? 'INSURANCE_ADMIN' : 'DEMO_FINANCE_PREPARER',
        },
      })) ??
      (await s.getRepository(Role).save({
        company_id: company.id,
        name: index ? 'INSURANCE_ADMIN' : 'DEMO_FINANCE_PREPARER',
        display_name: 'DEMONSTRATION ' + name,
        description: 'Synthetic isolated test role; no real company decision',
        scope: 'tenant',
        is_administrative: index > 0,
        is_system_generated: false,
      }));
    await s.query(
      'INSERT INTO company_user_roles(company_user_id,role_id) VALUES($1,$2)',
      [membership.id, role.id],
    );
    const who = {
      kind: 'USER',
      tenantId,
      subjectId: crypto.randomUUID(),
      naturalPersonId:
        index === 2 ? people[0].naturalPersonId : crypto.randomUUID(),
      identityBindingId: crypto.randomUUID(),
      sourceCompanyId: company.id,
      sourceUserId: u.id,
    };
    await s.query(
      `INSERT INTO finance_foundation_identity_bindings(id,source_company_id,source_user_id,tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'SYNTHETIC-G04-NOT-A-REAL-APPOINTMENT',statement_timestamp()-interval '1 minute',statement_timestamp()+interval '2 hours')`,
      [
        who.identityBindingId,
        company.id,
        u.id,
        ...ids,
        who.subjectId,
        who.naturalPersonId,
      ],
    );
    await s.query(
      `INSERT INTO finance_foundation_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,capability,company_role,authority_reference,limits,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,'READ',$6,'SYNTHETIC-G04-READ','{}',statement_timestamp()-interval '1 minute',statement_timestamp()+interval '2 hours')`,
      [
        ...ids,
        who.subjectId,
        who.naturalPersonId,
        index ? 'COMPANY_ADMIN' : 'FINANCE_OPERATOR',
      ],
    );
    await s.query(
      `INSERT INTO finance_scope_memberships(tenant_id,legal_entity_id,book_id,subject_id,subject_kind,state,permission,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,'USER','ENABLED','READ_DRAFT','SYNTHETIC-ONLY',statement_timestamp()-interval '1 minute',statement_timestamp()+interval '2 hours')`,
      [...ids, who.subjectId],
    );
    await s.query(
      `INSERT INTO finance_configuration_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,state,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,'ENABLED','SYNTHETIC-G04-CONTENT-ONLY',statement_timestamp()-interval '1 minute',statement_timestamp()+interval '2 hours')`,
      [
        ...ids,
        who.subjectId,
        who.naturalPersonId,
        index ? 'REVIEW_CONFIG' : 'PREPARE_CONFIG',
      ],
    );
    const permissions = index
      ? [
          'finance-foundation:read',
          'finance-setup:review',
          'finance-config:review',
          'finance-policy:decide',
        ]
      : [
          'finance-foundation:read',
          'finance-setup:prepare',
          'finance-config:prepare',
          'finance-policy:prepare',
        ];
    for (const name of permissions) {
      const [p] = await s.query('SELECT id FROM permissions WHERE name=$1', [
        name,
      ]);
      if (!p) throw Error('Required permission catalogue missing');
      await s.query(
        'INSERT INTO company_user_permissions(company_user_id,permission_id) VALUES($1,$2)',
        [membership.id, p.id],
      );
    }
    people.push(who);
    credentials.push({
      name: 'DEMO ' + name,
      email: u.email,
      password: demoPassword,
      userId: u.id,
      membershipId: membership.id,
    });
  }
  const Account = entity(
      'tenant/billing-commission/entities/finance-account.entity.ts',
      'FinanceAccount',
    ),
    accounts = shared?.accounts ?? [];
  if (!shared)
    for (const [code, type] of [
      ['DEMO-CASH', 'ASSET'],
      ['DEMO-PREMIUM', 'INCOME'],
      ['DEMO-TAX', 'LIABILITY'],
    ])
      accounts.push(
        await s.getRepository(Account).save({
          company_id: company.id,
          account_code: code,
          account_name: 'DEMONSTRATION ' + code,
          account_type: type,
          is_active: true,
          is_control_account: true,
        }),
      );
  const Tax = entity('tenant/taxes/entities/tax.entity.ts', 'Tax'),
    tax =
      shared?.tax ??
      (await s.getRepository(Tax).save({
        company_id: company.id,
        tax_code: 'DEMO_ZERO_RATE',
        tax_name: 'SYNTHETIC ZERO RATE — NOT A TANZANIAN TAX ELECTION',
        tax_rate: '0',
        is_active: true,
        is_default: false,
        calculation_options: {
          category: 'TAX',
          effective_from: '2026-01-01',
          effective_to: '2026-12-31',
        },
      }));
  const Document = entity(
      'tenant/insurance-documents/entities/document.entity.ts',
      'Document',
    ),
    DocumentVersion = entity(
      'tenant/insurance-documents/entities/document-version.entity.ts',
      'DocumentVersion',
    );
  const content = Buffer.from(
      'DEMONSTRATION ONLY. No real legal identifiers, certification, signatures, accounting approval, reconciliation or regulatory filing. Synthetic G04 acceptance fixture.',
    ),
    checksum = crypto.createHash('sha256').update(content).digest('hex');
  const document = await s.getRepository(Document).save({
    company_id: company.id,
    owner_type: 'FINANCE_SETUP',
    owner_id: book.id,
    title: 'DEMONSTRATION evidence — NOT VALID FOR REAL COMPANY',
    document_type: 'DEMONSTRATION',
    classification: 'INTERNAL',
    storage_key: 'synthetic-g04/no-real-document.txt',
    checksum,
    file_name: 'DEMONSTRATION.txt',
    content_type: 'text/plain',
    file_size: content.length,
    status: 'AVAILABLE',
    current_version_id: null,
  });
  const evidenceVersion = await s.getRepository(DocumentVersion).save({
    company_id: company.id,
    document_id: document.id,
    version_number: 1,
    status: 'AVAILABLE',
    storage_provider: 'LOCAL',
    storage_key: 'synthetic-g04/no-real-document.txt',
    safe_file_name: 'DEMONSTRATION.txt',
    original_file_name: 'DEMONSTRATION.txt',
    detected_mime_type: 'text/plain',
    detected_extension: '.txt',
    file_size: content.length,
    sha256_hash: checksum,
    uploaded_at: new Date(),
    uploaded_by: people[0].sourceUserId,
    scan_status: 'CLEAN',
    scan_result: { purpose: 'SYNTHETIC_DATABASE_FIXTURE_NOT_REAL_SCAN' },
  });
  await s
    .getRepository(Document)
    .update(document.id, { current_version_id: evidenceVersion.id });
  return {
    company,
    tenantId,
    legal,
    book,
    scope,
    maker: people[0],
    reviewer: people[1],
    alias: people[2],
    accounts,
    product,
    category,
    version,
    tax,
    evidence: {
      id: evidenceVersion.id,
      documentId: document.id,
      hash: checksum,
      purpose: 'DEMONSTRATION',
    },
    content: content.toString(),
    credentials,
  };
}

async function run(s, prepared = null, preparedMap = null) {
  const original = await originalFinancialState(s, prepared?.company.id),
    f = prepared ?? (await actorsAndScope(s));
  fixture = f;
  if (aiclProposal) {
    const books = await s.query(
      'SELECT book_code,state,accounting_basis_code FROM finance_accounting_books WHERE tenant_id=$1 AND legal_entity_id=$2 ORDER BY book_code',
      [f.tenantId, f.legal.id],
    );
    check(
      'AICL proposal books are unconfigured drafts',
      books.length === 3 &&
        books.every(
          (b) => b.state === 'DRAFT' && b.accounting_basis_code === null,
        ) &&
        aiclProposal.books.every((b) =>
          books.some((actual) => actual.book_code === b.code),
        ),
    );
    report.aiclDemo = {
      company: 'SYNTHETIC_COMPANY_NOT_ACTUAL_ALLIANCE',
      products: 'SYNTHETIC_PRODUCT_NOT_ACTUAL_AICL_MAPPING',
      opening: 'SYNTHETIC_BALANCE_VALIDATION_ONLY_NOT_IMPORTED',
      chart: 'INACTIVE_AICL_CHART_REPORTING_MAPPINGS_HELD',
      bookCode: aiclBook.code,
      otherBooks: 'DRAFT_ONLY_WITHOUT_G04_REVIEW_IN_THIS_COPY',
      accountingBasisAndFx: 'INACTIVE_DEMONSTRATION_ONLY',
    };
    let debit = 0n,
      credit = 0n;
    for (const line of aiclProposal.openingProposal.lines) {
      debit += BigInt(line.debit);
      credit += BigInt(line.credit);
    }
    check(
      'Synthetic AICL opening proposal balances without a posting',
      debit === 6500000000n && credit === debit,
    );
  }
  if (output && env.FINANCE_G04_KEEP_COPY === '1')
    fs.writeFileSync(
      path.join(path.dirname(output), 'demonstration-credentials.private.json'),
      JSON.stringify(
        { purpose: 'SYNTHETIC_ISOLATED_TEST_ONLY', credentials: f.credentials },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  const service = new FinanceSetupService(s),
    audit = new AuditService(
      s.getRepository(
        load('shared/audit/entities/audit-log.entity.ts', 'AuditLog'),
      ),
      new RequestContextService(),
    ),
    config = new FinanceSetupConfigurationService(s, service, audit),
    scope = f.scope;
  const reason =
    'SYNTHETIC DEMONSTRATION ONLY; not a real company preparation, signature or approval.';
  const storageRoot = path.join(
    path.dirname(
      output ??
        path.join(
          require('node:os').tmpdir(),
          'g04-' + crypto.randomBytes(8).toString('hex'),
          'report.json',
        ),
    ),
    'storage-' + crypto.randomBytes(4).toString('hex'),
  );
  fs.mkdirSync(path.join(storageRoot, 'synthetic-g04'), { recursive: true });
  const evidenceFile = path.join(
    storageRoot,
    'synthetic-g04/no-real-document.txt',
  );
  fs.writeFileSync(evidenceFile, f.content);
  report.storageRoot = storageRoot;
  const { FinanceSetupEvidenceService } = require(
      path.join(
        base,
        'tenant/billing-commission/foundation/finance-setup-evidence.service.ts',
      ),
    ),
    { DocumentStorageService } = require(
      path.join(base, 'tenant/insurance-documents/document-storage.service.ts'),
    ),
    { ConfigService } = require('@nestjs/config');
  const evidenceService = new FinanceSetupEvidenceService(
    service,
    new DocumentStorageService(
      new ConfigService({ DOCUMENT_STORAGE_ROOT: storageRoot }),
    ),
  );
  const pins = [],
    versions = [],
    configs = [];
  let overview = await service.overview(f.maker, scope);
  check(
    'New demonstration scope starts incomplete',
    !overview.complete && overview.steps.length === 10,
  );
  async function complete(step, answers) {
    const input = {
      purpose: 'DEMONSTRATION',
      step,
      version: 1,
      effectiveFrom: '2026-11-16',
      effectiveTo: '2027-01-01',
      answers,
      dependencies: [...pins],
      evidence: ['LICENCE', 'TIN', 'REGISTRATION', 'RECONCILIATION'].map(
        (purpose) => ({ ...f.evidence, purpose }),
      ),
    };
    const created = await service.create(f.maker, scope, input, reason);
    if (created.issues.length)
      throw Error(step + ' issues: ' + created.issues.join(' | '));
    await service.transition(
      f.maker,
      scope,
      created.id,
      created.subjectHash,
      'SUBMIT',
      reason,
    );
    await service.transition(
      f.reviewer,
      scope,
      created.id,
      created.subjectHash,
      'REVIEW_INACTIVE',
      reason,
    );
    pins.push({ id: created.id, hash: created.subjectHash });
    versions.push({ ...created, input });
    check(step + ' exact version independently reviewed inactive', true);
    note(step);
    return created;
  }
  await complete('G04-01', {
    jurisdictionCode: 'TZ',
    productIds: [f.product.id],
    legalScopeReason:
      'DEMONSTRATION product and fabricated legal identifiers; isolated test only.',
  });
  await complete('G04-02', {
    preparerBindingId: f.maker.identityBindingId,
    reviewerBindingId: f.reviewer.identityBindingId,
    appointmentReference: 'SYNTHETIC-NOT-AN-APPOINTMENT',
    segregationOfDuties:
      'Separate synthetic natural persons; the alias is deliberately the maker and cannot review.',
  });
  const assessment = {
    accountingBasis: aiclBook?.basis ?? 'IFRS',
    functionalCurrency: 'TZS',
    functionalCurrencyRationale:
      'Demonstration selection only. No real functional-currency assessment is asserted.',
    presentationCurrencies: ['TZS'],
    transactionCurrencies: aiclProposal?.currencies.transaction ?? [
      'TZS',
      'USD',
    ],
    currencyScales: aiclProposal
      ? Object.fromEntries(
          aiclProposal.currencies.transaction.map((c) => [
            c,
            aiclProposal.currencies.scale,
          ]),
        )
      : { TZS: 2, USD: 2 },
    rateSources: ['SYNTHETIC-NOT-A-MARKET-RATE'],
    maximumRateAgeDays: 0,
    roundingMode: 'REJECT_IMBALANCED',
  };
  const currencyReview = await complete('G04-03', assessment);
  const periods = Array.from({ length: 12 }, (_, i) => ({
    code: (aiclProposal ? '2026-' : 'DEMO-') + String(i + 1).padStart(2, '0'),
    from: new Date(Date.UTC(2026, i, 1)).toISOString().slice(0, 10),
    to: new Date(Date.UTC(2026, i + 1, 1)).toISOString().slice(0, 10),
  }));
  await complete('G04-04', {
    calendarCode: aiclProposal?.calendar.code ?? 'DEMONSTRATION-2026',
    fiscalYearEnd: '12-31',
    timezone: 'Africa/Dar_es_Salaam',
    closeProcedure: 'Synthetic independent close; no live periods opened.',
    reopeningProcedure: 'Synthetic separate company-admin permission required.',
    periods,
  });
  const map =
    preparedMap ??
    (await config.createSourceMap(
      f.maker,
      scope,
      {
        version: 1,
        legalRole: 'DEMONSTRATION_INSURER',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2027-01-01',
      },
      reason,
    ));
  await config.claimSourceRead(f.reviewer, scope, map.map.id, map.hash, reason);
  await complete('G04-05', {
    sourceMapIds: [map.map.id],
    cutoffDate: '2026-11-16',
    populationEvidenceHash: f.evidence.hash,
    reconciliationProcedure:
      'Synthetic empty/open-item population only; original copied invoices remain untouched.',
  });
  async function reviewed(kind, payload, extra = {}) {
    const input = {
      kind,
      key: 'DEMO-' + kind,
      version: 1,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2027-01-01',
      dependencyRefs: FINANCE_SETUP_CATALOG.decisions
        .filter((d) => d.id.startsWith('DEC-'))
        .map((d) => d.id),
      ...(payload ? { payload } : {}),
      ...extra,
    };
    const r = await config.createConfiguration(f.maker, scope, input, reason);
    await config.configurationDecision(
      f.maker,
      scope,
      r.id,
      r.release_hash,
      'SUBMIT',
      reason,
    );
    await config.configurationDecision(
      f.reviewer,
      scope,
      r.id,
      r.release_hash,
      'REVIEW_INACTIVE',
      reason,
    );
    configs.push(r);
    return r;
  }
  const chartProposal = {
    schema: 'FINANCE_CHART_V1',
    chartCode: aiclProposal ? 'AICL-DEMO' : 'DEMONSTRATION',
    supportedProfiles: ['INSURER'],
    accounts: aiclProposal
      ? aiclProposal.chartProposal
          .filter(([, , type]) => type !== 'REPORTING_MAPPING')
          .map(([code, name, type]) => {
            const headerTypes = {
              1000: 'ASSET',
              2000: 'LIABILITY',
              3000: 'EQUITY',
              4000: 'INCOME',
              5000: 'EXPENSE',
            };
            const accountType = type === 'HEADER' ? headerTypes[code] : type;
            const parent =
              type === 'HEADER'
                ? null
                : {
                    ASSET: '1000',
                    LIABILITY: '2000',
                    EQUITY: '3000',
                    INCOME: '4000',
                    EXPENSE: '5000',
                  }[accountType];
            return {
              code,
              name: 'DEMO ' + name,
              type: accountType,
              normalBalance: ['ASSET', 'EXPENSE'].includes(accountType)
                ? 'DR'
                : 'CR',
              posting: type !== 'HEADER',
              control: type !== 'HEADER',
              parentCode: parent,
            };
          })
      : [
          {
            code: '110110',
            name: 'DEMO cash',
            type: 'ASSET',
            normalBalance: 'DR',
            posting: true,
            control: true,
            parentCode: null,
          },
          {
            code: '210110',
            name: 'DEMO suspense',
            type: 'LIABILITY',
            normalBalance: 'CR',
            posting: true,
            control: true,
            parentCode: null,
          },
        ],
    roles: [
      {
        code: 'BANK_OPERATING',
        accountCode: aiclProposal ? '1100' : '110110',
        accountType: 'ASSET',
        requiredDimensions: ['TENANT', 'LEGAL_ENTITY', 'BOOK'],
        dependencyRefs: ['DEC-01'],
      },
      {
        code: 'UNIDENTIFIED_CASH',
        accountCode: aiclProposal ? null : '210110',
        accountType: 'LIABILITY',
        requiredDimensions: ['TENANT', 'LEGAL_ENTITY', 'BOOK'],
        dependencyRefs: ['DEC-01'],
      },
    ],
    legacy: {
      mode: 'SCOPED_INVENTORY',
      sourceMapId: map.map.id,
      dispositions: f.accounts.map((a) => ({
        sourceAccountId: a.id,
        state: 'HELD',
        roleCode: null,
        reason: 'Synthetic held disposition; not an approved opening transfer.',
      })),
      emptyInventoryReason: null,
    },
  };
  const chart = await reviewed('ACCOUNT_ROLES', chartProposal);
  const dimensions = await reviewed('DIMENSIONS', {
    schema: 'FINANCE_DIMENSIONS_V1',
    activationAuthorized: false,
    definitions: ['TENANT', 'LEGAL_ENTITY', 'BOOK'].map((code) => ({
      code,
      label: code,
      valueType: 'ID',
      required: true,
      source: 'AUTHENTICATED_' + code,
    })),
  });
  await complete('G04-06', {
    chartReleaseId: chart.id,
    chartReleaseHash: chart.release_hash,
    dimensionReleaseId: dimensions.id,
    dimensionReleaseHash: dimensions.release_hash,
    mappingReview:
      'Every synthetic source account held with an explicit restriction. No opening balances transferred.',
  });
  await reviewed('POSTING_RULES', {
    schema: 'FINANCE_POSTING_RULES_V1',
    activationAuthorized: false,
    rules: [
      {
        economicEffectKey: 'DEMO-BILLING-MEMORANDUM',
        sourceEvent: 'demo.billing.v1',
        layer: 'BILLING_MEMORANDUM',
        postingAuthority: 'FINANCE',
        enabled: false,
        financialPosting: false,
        policyReferences: ['AP-07.01'],
        unresolvedDecisions: ['DEC-01'],
      },
    ],
  });
  await reviewed('CURRENCY_RULES', {
    schema: 'FINANCE_CURRENCY_RULES_V1',
    activationAuthorized: false,
    assessmentReference: currencyReview.id + '/' + currencyReview.subjectHash,
    ...assessment,
    fxOwnership: 'ONE_OWNER_PER_EXPOSURE',
  });
  await reviewed('TAX_RULES', {
    schema: 'FINANCE_TAX_RULES_V1',
    activationAuthorized: false,
    sourceTaxCatalogue: 'LEGACY_TAXES',
    calculationOwner: 'EXISTING_SOURCE_TAX_ENGINE',
    sourceTaxRuleIds: [f.tax.id],
    missingBreakdownTreatment: 'BLOCK_POSTING',
    preserveCustomerPayable: true,
  });
  await reviewed('APPROVAL_RULES', {
    schema: 'FINANCE_APPROVAL_PROFILE_V1',
    purpose: 'JOURNAL_CANDIDATE_ONLY',
    roleCode: 'DEMONSTRATION_CHECKER',
    requiredCheckers: 1,
    ttlSeconds: 3600,
  });
  const contract = await reviewed('EVENT_CONTRACTS', {
    schema: 'FINANCE_EVENT_CONTRACT_V1',
    purpose: 'SOURCE_FACT_REFERENCE',
    eventType: 'source.policy.terms-snapshotted.v1',
    schemaVersion: '1.0.0',
    producerId: 'DEMONSTRATION_G04',
    sourceSystem: 'INSURANCE_PORTAL_FINANCE',
    aggregateType: 'POLICY',
    factKind: 'POLICY_TERMS',
    codec: 'SOURCE_SNAPSHOT_REFERENCE_V1',
  });
  const association = await reviewed('SOURCE_ASSOCIATIONS', null, {
    sourceMapIds: [map.map.id],
  });
  await reviewed('EVENT_ROUTES', {
    schema: 'FINANCE_EVENT_ROUTE_V1',
    contractId: contract.id,
    contractHash: contract.release_hash,
    sourceAssociationId: association.id,
    sourceAssociationHash: association.release_hash,
    sourceMapId: map.map.id,
    sourceMapHash: map.hash,
  });
  await reviewed('INTEGRATION_RULES', {
    schema: 'FINANCE_INTEGRATION_RULES_V1',
    purpose: 'INACTIVE_REFERENCE_ONLY',
    handler: 'HOLD_REFERENCE_V1',
    leaseSeconds: 30,
    maxAttempts: 3,
    retryDelaySeconds: 0,
    consumerId: 'DEMONSTRATION_CONSUMER',
  });
  await reviewed('EXCEPTION_RULES', {
    schema: 'FINANCE_EXCEPTION_RULES_V1',
    purpose: 'INACTIVE_REFERENCE_ONLY',
    replayTtlSeconds: 300,
    additionalAttempts: 1,
    maxReplaysPerItem: 2,
    proposedOwnerDueSeconds: null,
    proposedEscalationSeconds: null,
  });
  await reviewed('QUOTATION_BILLING_RULES', {
    schema: 'FINANCE_QUOTATION_BILLING_RULES_V1',
    purpose: 'MEMORANDUM_ONLY',
    recognition: 'HELD_INACTIVE',
    maxLines: 100,
  });
  await reviewed('RECEIVABLE_CONTROLS', {
    schema: 'FINANCE_RECEIVABLE_CONTROLS_V1',
    purpose: 'INACTIVE_CONTROLS_ONLY',
    recognition: 'HELD_INACTIVE',
    cashAccounts: [
      {
        sourceAccountId: f.accounts[0].id,
        sourceCompanyId: f.company.id,
        currency: 'TZS',
        decimalScale: 2,
      },
    ],
    ageingBands: [30, 60, 90],
  });
  check(
    'All thirteen real configuration contracts independently reviewed inactive',
    configs.length === 13,
  );
  await complete('G04-07', {
    configurationPins: configs.map((c) => ({ id: c.id, hash: c.release_hash })),
    consumerVerification:
      'Native typed contract and source-reference checks passed. Operational policies, actual model engines and deployment remain deferred.',
  });
  await complete('G04-08', {
    policyDecisions: FINANCE_SETUP_CATALOG.policies.map((p) => ({
      id: p.id,
      disposition: 'DEFERRED',
      selection: null,
      reason:
        'DEMONSTRATION only. Actual company accounting treatment and required specialist evidence remain pending; dependent accounting is blocked.',
    })),
    decisionSelections: FINANCE_SETUP_CATALOG.decisions.map((d) => ({
      id: d.id,
      disposition: 'DEFERRED',
      selection: null,
      reason:
        'DEMONSTRATION only. This synthetic review does not select or approve a real company decision.',
    })),
  });
  await complete('G04-09', {
    environment: 'ISOLATED_COPY',
    result: 'PASS',
    checksPassed: report.checks.length,
    paidInvoicesUnchanged: true,
    existingAccessUnchanged: true,
    policyActivations: 0,
    bookActivations: 0,
    sourceFinancialWrites: 0,
    reconciliationEvidenceHash: f.evidence.hash,
  });
  await complete('G04-10', {
    acceptedScope: 'INACTIVE_SETUP_REVIEW',
    activationAuthorized: false,
    completionStatement:
      'DEMONSTRATION workflow complete with synthetic independent reviews only.',
    remainingRestrictions:
      'All real accounting policy decisions, model eligibility, actual legal identifiers and production acceptance remain pending. No live release or real company approval.',
  });
  overview = await service.overview(f.reviewer, scope);
  check(
    'Ten-step demonstration completes without company approval or activation',
    overview.complete &&
      overview.steps.every((s) => s.complete) &&
      overview.completionMeaning === 'DEMONSTRATION_ONLY',
  );
  await expectDenied('Other book is denied', () =>
    service.overview(f.maker, { ...scope, bookId: crypto.randomUUID() }),
  );
  await expectDenied('Other company identity is denied', () =>
    service.overview(
      { ...f.maker, sourceCompanyId: crypto.randomUUID() },
      scope,
    ),
  );
  await expectDenied('Changed exact-version hash is denied', () =>
    service.detail(f.reviewer, scope, versions[0].id, '0'.repeat(64)),
  );
  await expectDenied(
    'Stale draft version is refused',
    () => service.create(f.maker, scope, versions[0].input, reason),
    409,
  );
  const rollback = async (work) => {
    let finished = false;
    try {
      await s.transaction(async (m) => {
        await work(new FinanceSetupService(m), m);
        finished = true;
        throw new Error('SYNTHETIC_ROLLBACK');
      });
    } catch (e) {
      if (e.message !== 'SYNTHETIC_ROLLBACK') throw e;
    }
    if (!finished) throw Error('Negative test did not finish');
  };
  await rollback(async (bound) => {
    const original = versions[7].input;
    const draft = await bound.create(
      f.maker,
      scope,
      {
        ...original,
        version: 2,
        answers: {
          ...original.answers,
          policyDecisions: original.answers.policyDecisions.map((p, i) =>
            i
              ? p
              : {
                  ...p,
                  disposition: 'PROPOSED_TREATMENT',
                  selection: 'Unapproved declaration',
                  policyVersionId: crypto.randomUUID(),
                  policyVersionHash: 'f'.repeat(64),
                },
          ),
        },
      },
      reason,
    );
    await expectDenied(
      'Setup declarations cannot replace native company policy approval',
      () =>
        bound.transition(
          f.maker,
          scope,
          draft.id,
          draft.subjectHash,
          'SUBMIT',
          reason,
        ),
      409,
    );
  });
  await rollback(async (bound) => {
    const draft = await bound.create(
      f.maker,
      scope,
      { ...versions[0].input, version: 2 },
      reason,
    );
    await bound.transition(
      f.maker,
      scope,
      draft.id,
      draft.subjectHash,
      'SUBMIT',
      reason,
    );
    await expectDenied('Maker alias cannot independently review', () =>
      bound.transition(
        f.alias,
        scope,
        draft.id,
        draft.subjectHash,
        'REVIEW_INACTIVE',
        reason,
      ),
    );
  });
  await rollback(async (bound, m) => {
    const expiredId = crypto.randomUUID();
    await m.query(
      "INSERT INTO finance_foundation_identity_bindings(id,source_company_id,source_user_id,tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from,valid_to) SELECT $1,source_company_id,source_user_id,tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,'SYNTHETIC-EXPIRED',statement_timestamp()-interval '2 minutes',statement_timestamp()-interval '1 minute' FROM finance_foundation_identity_bindings WHERE id=$2",
      [expiredId, f.maker.identityBindingId],
    );
    await expectDenied('Expired identity is denied', () =>
      bound.overview({ ...f.maker, identityBindingId: expiredId }, scope),
    );
  });
  await rollback(async (bound, m) => {
    const [membership] = await m.query(
      'SELECT id FROM company_users WHERE user_id=$1 AND company_id=$2',
      [f.alias.sourceUserId, f.company.id],
    );
    const [permission] = await m.query(
      "SELECT id FROM permissions WHERE name='finance-setup:prepare'",
    );
    await m.query(
      'INSERT INTO company_user_permissions(company_user_id,permission_id) VALUES($1,$2)',
      [membership.id, permission.id],
    );
    await m.query(
      "INSERT INTO finance_configuration_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,state,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,'PREPARE_CONFIG','ENABLED','SYNTHETIC-EXPIRED',statement_timestamp()-interval '2 minutes',statement_timestamp()-interval '1 minute')",
      [
        f.tenantId,
        scope.legalEntityId,
        scope.bookId,
        f.alias.subjectId,
        f.alias.naturalPersonId,
      ],
    );
    await expectDenied('Expired preparation authority is denied', () =>
      bound.create(
        f.alias,
        scope,
        { ...versions[0].input, version: 2 },
        reason,
      ),
    );
  });
  await rollback(async (bound, m) => {
    await m.query('UPDATE taxes SET tax_rate=$2 WHERE id=$1', [
      f.tax.id,
      '0.01',
    ]);
    const changed = await bound.overview(f.reviewer, scope);
    check(
      'Changed source tax rule invalidates setup completion',
      !changed.complete &&
        !changed.steps.find((s) => s.id === 'G04-07').complete,
    );
  });
  await rollback(async (bound, m) => {
    await m.query(
      "UPDATE document_versions SET status='QUARANTINED' WHERE id=$1",
      [f.evidence.id],
    );
    const changed = await bound.overview(f.reviewer, scope);
    check(
      'Quarantined evidence invalidates prerequisites and final completion',
      !changed.complete &&
        !changed.steps[0].complete &&
        !changed.steps[9].complete,
    );
  });
  await rollback(async (bound) => {
    await bound.create(
      f.maker,
      scope,
      { ...versions[0].input, version: 2 },
      reason,
    );
    const changed = await bound.overview(f.reviewer, scope);
    check(
      'A new draft invalidates dependent reviews instead of silently preserving acceptance',
      !changed.complete && !changed.steps[9].complete,
    );
  });
  await expectDenied(
    'Immutable setup version cannot be rewritten',
    () =>
      s.transaction((m) =>
        m.query(
          "UPDATE finance_setup_versions SET subject_hash=repeat('0',64) WHERE id=$1",
          [versions[0].id],
        ),
      ),
    null,
  );
  await expectDenied(
    'Immutable setup audit event cannot be deleted',
    () =>
      s.transaction((m) =>
        m.query('DELETE FROM finance_setup_events WHERE version_id=$1', [
          versions[0].id,
        ]),
      ),
    null,
  );
  const { FinancePostingPolicyService } = require(
    path.join(
      base,
      'tenant/billing-commission/services/finance-posting-policy.service.ts',
    ),
  );
  let held = false;
  try {
    await new FinancePostingPolicyService().requireEligible(s.manager, {
      companyId: f.company.id,
      sourceType: 'QUOTATION',
      currency: 'TZS',
      date: '2026-11-16',
      accountMappings: [],
    });
  } catch (e) {
    held = e.getResponse?.()?.code === 'FINANCE_POSTING_HELD';
  }
  check('Actual financial posting remains held', held);
  const [counts] = await s.query(
    `SELECT (SELECT count(*)::int FROM finance_policy_versions) policies,(SELECT count(*)::int FROM finance_accounting_books WHERE state='ACTIVE') active_books,(SELECT count(*)::int FROM finance_foundation_deployments) deployments`,
  );
  check(
    'No policy approval, book activation or deployment was created',
    counts.policies === 0 &&
      counts.active_books === 0 &&
      counts.deployments === 0,
  );
  check(
    'Original invoices, items, receipts, journals and accounts unchanged',
    JSON.stringify(original) ===
      JSON.stringify(await originalFinancialState(s, f.company.id)),
  );
  const downloaded = await evidenceService.download(
    f.reviewer,
    scope,
    f.evidence,
  );
  check(
    'Owned exact-version evidence bytes can be reviewed',
    downloaded.buffer.toString() === f.content,
  );
  fs.writeFileSync(evidenceFile, 'TAMPERED SYNTHETIC CONTENT');
  try {
    await expectDenied(
      'Changed evidence bytes are refused',
      () => evidenceService.download(f.reviewer, scope, f.evidence),
      409,
    );
  } finally {
    fs.writeFileSync(evidenceFile, f.content);
  }
  await expectDenied('An unrelated document version cannot be downloaded', () =>
    evidenceService.download(f.reviewer, scope, {
      ...f.evidence,
      documentId: crypto.randomUUID(),
    }),
  );
  const [accessAudit] = await s.query(
    'SELECT count(*)::int AS count FROM document_access_events WHERE company_id=$1 AND document_version_id=$2 AND access_channel=$3 AND result=$4',
    [f.company.id, f.evidence.id, 'FINANCE_SETUP', 'SUCCESS'],
  );
  check(
    'Successful evidence access is audited exactly once',
    accessAudit.count === 1,
  );
  overview = await service.overview(f.reviewer, scope);
  check(
    'Rolled-back negative tests leave the demonstration fully reviewed',
    overview.complete,
  );
  if (aiclProposal && env.FINANCE_G04_INTEGRATED === '1') {
    const nextChart = await reviewed('ACCOUNT_ROLES', chartProposal, {
      key: 'DEMO-2027-ACCOUNT-ROLES',
      effectiveFrom: '2027-01-01',
      effectiveTo: '2028-01-01',
    });
    const { FinanceLedgerFoundationService } = require(
      path.join(
        base,
        'tenant/billing-commission/foundation/finance-ledger-foundation.service.ts',
      ),
    );
    const ledger = new FinanceLedgerFoundationService(s);
    for (const [who, capability] of [
      [f.maker, 'PREPARE'],
      [f.maker, 'REVIEW'],
      [f.reviewer, 'REVIEW'],
    ])
      await s.query(
        "INSERT INTO finance_foundation_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,capability,company_role,authority_reference,limits,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,'FINANCE_OPERATOR','SYNTHETIC-CUTOVER-TEST','{}',statement_timestamp()-interval '1 minute',statement_timestamp()+interval '2 hours')",
        [
          f.tenantId,
          f.legal.id,
          f.book.id,
          who.subjectId,
          who.naturalPersonId,
          capability,
        ],
      );
    const context = await ledger.prepareCurrencyContext(
      f.maker,
      scope,
      {
        schema: 'FINANCE_CURRENCY_CONTEXT_V1',
        version: 1,
        sourceCompanyId: f.company.id,
        basis: aiclBook.basis,
        functionalCurrency: 'TZS',
        presentationCurrencies: ['TZS'],
        currencyScales: { TZS: 2 },
        effectiveFrom: '2027-01-01',
        effectiveTo: '2028-01-01',
        rateSources: ['SYNTHETIC'],
        maxRateAgeDays: 0,
        roundingMode: 'REJECT_IMBALANCED',
        chartReleaseId: nextChart.id,
        chartReleaseHash: nextChart.release_hash,
        policyPins: [],
        unresolvedDecisions: ['SYNTHETIC_DEMONSTRATION_ONLY'],
        allowedComponents: [
          {
            origin: 'DEMO',
            component: 'REFERENCE',
            owner: 'FINANCE',
            policyCode: 'AP-08.01',
            effect: 'CASH',
            sourceEventType: null,
            factKind: null,
            sourceMapping: null,
            debitRoles: ['BANK_OPERATING'],
            creditRoles: ['BANK_OPERATING'],
          },
        ],
        assessmentReference:
          'SYNTHETIC DEMONSTRATION ONLY; NOT AN ACCOUNTING POLICY',
        assessmentEvidenceHash: f.evidence.hash,
      },
      reason,
    );
    await ledger.reviewDocument(
      f.reviewer,
      scope,
      context.id,
      context.subjectHash,
      'REVIEWED',
      f.evidence.hash,
      reason,
    );
    const balances = chartProposal.accounts
      .filter((a) => a.posting)
      .map((a) => {
        const line = aiclProposal.openingProposal.lines.find(
          (l) => l.account === a.code,
        );
        return {
          accountCode: a.code,
          signedBalance: line
            ? (BigInt(line.debit) - BigInt(line.credit)).toString()
            : '0',
        };
      });
    const opening = await ledger.prepareOpening(
      f.maker,
      scope,
      {
        contextId: context.id,
        contextHash: context.subjectHash,
        mode: 'VALIDATION',
        date: '2027-01-01',
        balances,
        sourceReference:
          'SYNTHETIC ONLY; NO REAL SOURCE OR OPEN ITEM CERTIFICATION',
        sourceEvidenceHash: f.evidence.hash,
        explicitZeroReason: null,
      },
      1,
      reason,
    );
    await expectDenied(
      'Synthetic 2027 opening cannot be self-reviewed',
      () =>
        ledger.reviewDocument(
          f.maker,
          scope,
          opening.id,
          opening.subjectHash,
          'REVIEWED',
          f.evidence.hash,
          reason,
        ),
      null,
    );
    await ledger.reviewDocument(
      f.reviewer,
      scope,
      opening.id,
      opening.subjectHash,
      'REVIEWED',
      f.evidence.hash,
      reason,
    );
    const trial = await ledger.trialBalance(f.reviewer, scope, {
      mode: 'VALIDATION',
      openingId: opening.id,
      openingHash: opening.subjectHash,
      from: '2027-01-01',
      to: '2028-01-01',
    });
    const positive = trial.rows.reduce((sum, row) => {
      const n = BigInt(row.opening.split('.')[0]);
      return sum + (n > 0n ? n : 0n);
    }, 0n);
    check(
      'Synthetic 2027 opening independently reviewed and balanced for ' +
        aiclBook.code,
      positive === 6500000000n && trial.financialEffects === 0,
    );
    report.aiclDemo.opening =
      'SYNTHETIC_2027_VALIDATION_OPENING_REVIEWED_NOT_LIVE_OR_ACTUAL_RECONCILIATION';
  }
  report.demonstrationComplete = true;
  report.companyAcceptanceGranted = false;
  report.policiesActivated = 0;
  report.sourceWrites = 0;
  report.paidHistoricalInvoicesUnchanged = true;
  report.finishedAt = new Date().toISOString();
  report.passed = true;
  save();
}
(async () => {
  admin = new Client({ host, port, user, password, database: 'postgres' });
  await admin.connect();
  const [identity] = (
    await admin.query(
      "SELECT inet_server_port() port,current_setting('data_directory') directory",
    )
  ).rows;
  if (
    identity.port !== port ||
    fs.realpathSync(identity.directory) !== fs.realpathSync(cluster)
  )
    throw Error('Isolated cluster identity mismatch');
  await admin.query(
    'CREATE DATABASE ' + quote(database) + ' WITH TEMPLATE ' + quote(template),
  );
  created = true;
  note('isolated database created');
  const options = createAppDataSourceOptions({
    type: 'postgres',
    host,
    port,
    username: user,
    password,
    database,
    synchronize: false,
    logging: false,
    ssl: false,
  });
  ds = new DataSource({
    ...options,
    synchronize: false,
    migrationsRun: false,
    logging: false,
  });
  await ds.initialize();
  if (aiclProposal && env.FINANCE_G04_INTEGRATED === '1') {
    const fixtures = [];
    let shared = null;
    for (const book of aiclProposal.books) {
      aiclBook = book;
      const f = await actorsAndScope(ds, shared);
      if (!shared) shared = f;
      fixtures.push(f);
    }
    check(
      'Three demo books share one tenant, entity and company',
      fixtures.length === 3 &&
        fixtures.every(
          (f) =>
            f.tenantId === shared.tenantId &&
            f.legal.id === shared.legal.id &&
            f.company.id === shared.company.id,
        ) &&
        new Set(fixtures.map((f) => f.book.id)).size === 3,
    );
    const maps = [];
    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i];
      const setup = new FinanceSetupService(ds);
      const audit = new AuditService(
        ds.getRepository(
          load('shared/audit/entities/audit-log.entity.ts', 'AuditLog'),
        ),
        new RequestContextService(),
      );
      const config = new FinanceSetupConfigurationService(ds, setup, audit);
      maps.push(
        await config.createSourceMap(
          f.maker,
          f.scope,
          {
            version: 1,
            legalRole: 'DEMONSTRATION_INSURER_' + (i + 1),
            effectiveFrom: '2026-01-01',
            effectiveTo: '2028-01-01',
          },
          'SYNTHETIC DEMONSTRATION ONLY; not a company authority.',
        ),
      );
    }
    report.bookRuns = [];
    for (let i = 0; i < fixtures.length; i++) {
      aiclBook = aiclProposal.books[i];
      const start = report.checks.length;
      await run(ds, fixtures[i], maps[i]);
      report.bookRuns.push({
        bookCode: aiclBook.code,
        basis: aiclBook.basis,
        checks: report.checks.length - start,
      });
    }
    const setup = new FinanceSetupService(ds);
    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i],
        other = fixtures[(i + 1) % fixtures.length];
      const status = await setup.overview(f.reviewer, f.scope);
      check(
        'Integrated book independently retains inactive G04 review: ' +
          aiclProposal.books[i].code,
        status.complete && status.completionMeaning === 'DEMONSTRATION_ONLY',
      );
      await expectDenied(
        'Integrated cross-book identity is denied: ' +
          aiclProposal.books[i].code,
        () => setup.overview(f.reviewer, other.scope),
      );
    }
    report.aiclDemo.otherBooks = 'G04_REVIEWED_IN_SAME_ISOLATED_DATABASE';
    report.finishedAt = new Date().toISOString();
    save();
  } else await run(ds);
  console.log(
    JSON.stringify({
      passed: true,
      checks: report.checks.length,
      demonstrationComplete: true,
      companyAcceptanceGranted: false,
      policiesActivated: 0,
      sourceWrites: 0,
    }),
  );
})()
  .catch((e) => {
    report.failure = String(e.message).replaceAll(password, '[redacted]');
    report.failureDetails = {
      stack: String(e.stack).replaceAll(password, '[redacted]'),
      query: e.query ?? null,
      detail: e.detail ?? e.driverError?.detail ?? null,
    };
    save();
    console.error(report.failure);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (admin) {
      if (created) {
        const keep = env.FINANCE_G04_KEEP_COPY === '1';
        if (keep) {
          report.retainedDemonstrationDatabase = database;
          report.syntheticScope = fixture
            ? {
                tenantId: fixture.tenantId,
                legalEntityId: fixture.legal.id,
                bookId: fixture.book.id,
                sourceCompanyId: fixture.company.id,
              }
            : null;
        } else
          await admin.query(
            'DROP DATABASE ' + quote(database) + ' WITH (FORCE)',
          );
        save();
      }
      await admin.end();
    }
  });
