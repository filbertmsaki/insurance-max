import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CompaniesController } from '../../src/modules/platform/companies/companies.controller';
import { CompaniesService } from '../../src/modules/platform/companies/companies.service';
import {
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ApiExceptionFilter,
  ProductDefinitionHashService,
  RequestContextService,
} from '@insurance-max/shared-kernel';
import { FinanceSetupController } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-setup.controller';
import { FinanceSetupService } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-setup.service';
import { FinanceSetupConfigurationService } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-setup-configuration.service';
import { FinanceBookManagementService } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-book-management.service';
import { FinancePortalIdentityService } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-portal-identity.service';
import { FinanceFoundationController } from '../../src/modules/tenant/finance/foundation/finance-foundation.controller';
import { TradePayablesController } from '../../src/modules/tenant/finance/payables/trade-payables/trade-payables.controller';
import { FixedAssetsController } from '../../src/modules/tenant/finance/assets/fixed-assets/fixed-assets.controller';
import { FixedAssetsService } from '../../src/modules/tenant/finance/assets/fixed-assets/fixed-assets.service';
import { CashBankService } from '../../src/modules/tenant/finance/cash-bank/cash-bank.service';
import { CashBankController } from '../../src/modules/tenant/finance/cash-bank/cash-bank.controller';
import { CustomerAccountsController } from '../../src/modules/tenant/finance/receivables/customer-accounts/customer-accounts.controller';
import { CustomerAccountsService } from '../../src/modules/tenant/finance/receivables/customer-accounts/customer-accounts.service';
import { TradePayablesService } from '../../src/modules/tenant/finance/payables/trade-payables/trade-payables.service';
import { ReceiptBalanceService } from '../../src/modules/tenant/finance/receivables/receipts/receipt-balance.service';
import { QuotationPaymentProjectionService } from '../../src/modules/tenant/finance/integrations/quotation-finance/quotation-payment-projection.service';
import { PolicyTransactionRefundProjectionService } from '../../src/modules/tenant/policy-transactions/services/policy-transaction-refund-projection.service';
import { PolicyTransactionPaymentProjectionService } from '../../src/modules/tenant/finance/integrations/policy-finance/policy-transaction-payment-projection.service';
import { BillingCommissionService } from '../../src/modules/tenant/finance/receivables/billing/billing-commission.service';
import { ManualInvoiceOptionsService } from '../../src/modules/tenant/finance/receivables/invoices/manual-invoice-options.service';
import { FinanceController } from '../../src/modules/tenant/finance/finance.controller';
import { FinanceGlVoucherService } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-gl-voucher.service';
import { FinanceGlWorkflowsService } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-gl-workflows.service';
import { DataAccessScopeService } from '../../src/modules/shared/authorization/data-access-scope.service';
import { FinanceOperatingPostingService } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-operating-posting.service';
import { FinanceLedgerFoundationService } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-ledger-foundation.service';
import { FinanceJournalCandidateService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal-candidate.service';
import { FinanceApprovalService } from '../../src/modules/tenant/finance/governance/finance-approvals/finance-approval.service';
import { FinancePolicyService } from '../../src/modules/tenant/finance/governance/accounting-policies/finance-policy.service';
import { FinanceJournalService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal.service';
import { FinanceCommandService } from '../../src/modules/tenant/finance/receivables/payment-transactions/finance-command.service';
import { FinanceOutboxService } from '../../src/modules/tenant/finance/integrations/finance-events/finance-outbox.service';
import { InvoiceBalanceService } from '../../src/modules/tenant/finance/receivables/outstanding-balances/invoice-balance.service';
import { PaymentReferenceService } from '../../src/modules/tenant/finance/receivables/payment-transactions/payment-reference.service';
import { FinancePostingPolicyService } from '../../src/modules/tenant/finance/accounting/posting-rules/finance-posting-policy.service';
import { ReinsuranceRecoveryService } from '../../src/modules/tenant/reinsurance/services/reinsurance-recovery.service';
import { BusinessReferenceService } from '../../src/modules/shared/identifiers/business-reference.service';
import { IdentifierGeneratorService } from '../../src/modules/shared/identifiers/identifier-generator.service';
import { AuditService } from '../../src/modules/shared/audit/audit.service';
import { FinancePermissions } from '../../src/modules/tenant/finance/governance/finance-permissions/finance.permissions';
import { withFinanceTestDatabase } from './finance-test-database';
import { installFinanceBaseline } from './finance-baseline';

export async function withNewCompany(
  work: (f: Awaited<ReturnType<typeof financeSession>>) => Promise<void>,
  insurer = false,
) {
  await withFinanceTestDatabase(
    async ({ dataSource: empty }) => {
      const q = empty.createQueryRunner();
      const directory = join(__dirname, '../../src/database/migrations');
      try {
        await q.startTransaction();
        await q.query(
          'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public',
        );
        for (const name of readdirSync(directory)
          .filter((n) => /^\d+.*\.ts$/.test(n))
          .sort()) {
          if (name.startsWith('1786736437722-')) {
            await installFinanceBaseline(q);
            continue;
          }
          const migration = Object.values(
            jest.requireActual(join(directory, name)),
          ).find((c: any) => c.prototype?.up) as any;
          await new migration().up(q);
        }
        await q.commitTransaction();
      } catch (error) {
        await q.rollbackTransaction();
        throw error;
      } finally {
        await q.release();
      }
      const db = new DataSource({
        ...empty.options,
        synchronize: false,
        migrations: [],
        entities: [
          join(__dirname, '../../src/**/*.entity.ts').replace(/\\/g, '/'),
        ],
      });
      await db.initialize();
      try {
        const session = await financeSession(db, insurer);
        try {
          await work(session);
        } finally {
          await session.app.close();
        }
      } finally {
        if (db.isInitialized) await db.destroy();
      }
    },
    process.env,
    'empty',
  );
}

interface PortalSession {
  id: string;
  companyMembershipId?: string;
  permissions?: string[];
  companyId?: string;
  companyType?: string;
  scope: 'platform' | 'company';
  userType: string;
  roles: string[];
}

async function startFinancePortal(db: DataSource) {
  const mod = await Test.createTestingModule({
    controllers: [
      CompaniesController,
      FinanceSetupController,
      FinanceFoundationController,
      TradePayablesController,
      CustomerAccountsController,
      FixedAssetsController,
      CashBankController,
      FinanceController,
    ],
    providers: [
      { provide: DataSource, useValue: db },
      ...db.entityMetadatas.map((e) => ({
        provide: getRepositoryToken(e.target as any),
        useValue: db.getRepository(e.target),
      })),
      CompaniesService,
      AuditService,
      RequestContextService,
      DataAccessScopeService,
      ManualInvoiceOptionsService,
      IdentifierGeneratorService,
      BusinessReferenceService,
      ReinsuranceRecoveryService,
      ProductDefinitionHashService,
      FinanceSetupService,
      FinanceSetupConfigurationService,
      FinancePortalIdentityService,
      FinanceBookManagementService,
      ReceiptBalanceService,
      QuotationPaymentProjectionService,
      PolicyTransactionPaymentProjectionService,
      PolicyTransactionRefundProjectionService,
      BillingCommissionService,
      FinanceOperatingPostingService,
      FinanceGlVoucherService,
      TradePayablesService,
      CustomerAccountsService,
      FixedAssetsService,
      CashBankService,
      { provide: 'FIN06_POSTING', useExisting: CashBankService },
      { provide: 'FIN05_POSTING', useExisting: FixedAssetsService },
      { provide: 'FIN04_POSTING', useExisting: CustomerAccountsService },
      FinanceGlWorkflowsService,
      FinanceLedgerFoundationService,
      FinanceJournalCandidateService,
      FinanceApprovalService,
      FinancePolicyService,
      FinanceJournalService,
      FinanceCommandService,
      FinanceOutboxService,
      InvoiceBalanceService,
      PaymentReferenceService,
      FinancePostingPolicyService,
    ],
  })
    .useMocker((token) => (typeof token === 'symbol' ? undefined : {}))
    .compile();
  const app = mod.createNestApplication();
  const sessions = new Map<string, PortalSession>();
  function signIn(user: PortalSession) {
    const token = randomUUID();
    sessions.set(token, user);
    return token;
  }
  app.useGlobalGuards({
    async canActivate(ctx) {
      const req = ctx.switchToHttp().getRequest();
      const user = sessions.get(req.headers.authorization?.slice(7));
      if (!user) throw new UnauthorizedException();
      req.user = user;
      const required: string[] =
        Reflect.getMetadata('permissions', ctx.getHandler()) ?? [];
      const roles: string[] =
        Reflect.getMetadata('roles', ctx.getHandler()) ?? [];
      if (roles.length && !roles.some((role) => user.roles.includes(role)))
        throw new ForbiddenException();
      if (user.scope === 'platform') {
        if (
          user.roles.includes('OWNER') &&
          required.length &&
          required.every((p) =>
            ['companies:create', 'companies:update'].includes(p),
          )
        )
          return true;
        throw new ForbiddenException();
      }
      for (const perm of required) {
        const [grant] = await db.query(
          "SELECT 1 FROM company_users cu JOIN companies c ON c.id=cu.company_id AND c.verification_status='VERIFIED' JOIN company_user_roles cr ON cr.company_user_id=cu.id JOIN permission_role pr ON pr.roles_id=cr.role_id JOIN permissions p ON p.id=pr.permissions_id WHERE cu.user_id=$1 AND cu.company_id=$2 AND cu.status='active' AND p.name=$3",
          [user.id, user.companyId, perm],
        );
        if (!grant) throw new ForbiddenException();
      }
      return true;
    },
  });
  app.useGlobalFilters(
    new ApiExceptionFilter(new ConfigService(), mod.get(RequestContextService)),
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  const request = async (
    token: string,
    method: string,
    path: string,
    body?: unknown,
    status?: number,
  ) => {
    const response = await fetch(url + path, {
      method,
      headers: {
        authorization: 'Bearer ' + token,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (status ? response.status !== status : !response.ok)
      throw Error(path + ' ' + response.status + ' ' + JSON.stringify(result));
    return result;
  };
  return { app, signIn, request };
}

async function grantFixturePermissions(
  db: DataSource,
  roleId: string,
  permissions: string[],
) {
  const grants = [...new Set(permissions)];
  await db.query(
    `INSERT INTO permissions(name,display_name) SELECT code,code FROM unnest($1::text[]) AS code
      WHERE NOT EXISTS(SELECT 1 FROM permissions p WHERE p.name=code)`,
    [grants],
  );
  await db.query(
    'INSERT INTO permission_role(roles_id,permissions_id) SELECT $1,id FROM permissions WHERE name=ANY($2::text[]) ON CONFLICT DO NOTHING',
    [roleId, grants],
  );
}

async function financeSession(db: DataSource, insurer = false) {
  const portal = await startFinancePortal(db);
  try {
    return await provisionCompany(db, portal, insurer);
  } catch (error) {
    await portal.app.close();
    throw error;
  }
}

async function provisionCompany(
  db: DataSource,
  { app, signIn, request }: Awaited<ReturnType<typeof startFinancePortal>>,
  insurer: boolean,
) {
  const companyType = insurer ? 'INSURANCE_COMPANY' : 'BROKER';
  const adminRoleName = insurer ? 'INSURANCE_ADMIN' : 'BROKER_ADMIN';
  const [calendar] = await db.query(
    "SELECT (statement_timestamp() AT TIME ZONE 'Africa/Dar_es_Salaam')::date::text today,((statement_timestamp() AT TIME ZONE 'Africa/Dar_es_Salaam')::date+30)::text until",
  );
  const { today, until } = calendar;
  const owner = randomUUID(),
    maker = randomUUID(),
    deputy = randomUUID(),
    customer = randomUUID();
  await db.query(
    "INSERT INTO users(id,first_name,last_name,email,phone,user_type) VALUES($1,'Platform','Owner','owner@example.invalid','0700000005','OWNER')",
    [owner],
  );
  const ownerToken = signIn({
    id: owner,
    scope: 'platform',
    userType: 'OWNER',
    roles: ['OWNER'],
  });
  const [adminRole] = await db.query(
    "INSERT INTO roles(name,display_name,scope,is_administrative) VALUES($1,'Company administrator','tenant_template',true) ON CONFLICT(name) WHERE company_id IS NULL DO UPDATE SET scope=EXCLUDED.scope,is_administrative=true RETURNING id",
    [adminRoleName],
  );
  const permissions = Object.values(FinancePermissions);
  await grantFixturePermissions(db, adminRole.id, [
    ...permissions,
    'update_company_data',
    'data-scope:company-all',
  ]);
  const address = {
    country: 'TZ',
    region: 'Dar es Salaam',
    street: '1 Insurance Road',
  };
  const created = await request(ownerToken, 'POST', '/companies', {
    company_name: 'Finance Workflow Ltd',
    company_type: companyType,
    admin_first_name: 'Jane',
    admin_last_name: 'Reviewer',
    admin_email: 'reviewer@example.invalid',
    admin_phone: '0700000001',
    admin_password: 'Fi!' + randomUUID(),
    head_office: { name: 'Head office', code: 'HQ', address },
    operating_timezone: 'Africa/Dar_es_Salaam',
    default_currency: 'TZS',
  });
  const company: string = created.company.id,
    checker: string = created.administrator.id;
  expect(created.head_office.code).toBe('HQ');
  expect(created.company.verification_status).toBe('PENDING_REVIEW');
  const verified = await request(
    ownerToken,
    'PATCH',
    '/companies/' + company + '/verification',
    {
      status: 'VERIFIED',
      note: 'Checked company registration evidence in acceptance test.',
    },
  );
  expect(verified.verification_status).toBe('VERIFIED');
  const tokens = new Map<string, string>();
  const companySession = async (id: string, role: string) => {
    const [m] = await db.query(
      'SELECT id FROM company_users WHERE company_id=$1 AND user_id=$2',
      [company, id],
    );
    const grants = await db.query(
      'SELECT DISTINCT p.name FROM company_user_roles cr JOIN permission_role pr ON pr.roles_id=cr.role_id JOIN permissions p ON p.id=pr.permissions_id WHERE cr.company_user_id=$1',
      [m.id],
    );
    return signIn({
      companyMembershipId: m.id,
      permissions: grants.map((p) => p.name),
      id,
      companyId: company,
      companyType,
      scope: 'company',
      userType: 'COMPANY_USER',
      roles: [role],
    });
  };
  tokens.set(checker, await companySession(checker, adminRoleName));
  const profile = {
    registry: 'BRELA',
    legalForm: 'Limited company',
    registrationStanding: 'ACTIVE',
    incorporationCountry: 'TZ',
    incorporationDate: '2020-01-01',
    activities: insurer ? 'General insurance' : 'Insurance brokerage',
    registeredOffice: 'COMPANY_ADDRESS',
    principalOffice: 'SAME_AS_REGISTERED',
    territory: 'MAINLAND',
    mainlandVat: 'NOT_REGISTERED',
    licensing: 'REGULATED',
    licensedClasses: insurer ? 'General insurance' : 'General brokerage',
    licensedTerritory: 'MAINLAND',
    licenceCycle: 'ANNUAL_MAINTENANCE',
    maintenanceThrough: until,
    maintenanceRef: 'M-675',
  };
  const completed = await request(
    tokens.get(checker)!,
    'PATCH',
    '/companies/my',
    {
      tin: '756893201',
      brela_registration_number: '687543',
      tira_license_number: 'BR-657',
      tira_license_status: 'VALID',
      license_issued_at: '2020-01-01',
      address,
      finance_profile_tz: profile,
    },
  );
  expect(completed.finance_profile_tz).toMatchObject({
    registry: 'BRELA',
    territory: 'MAINLAND',
  });
  await db.query(
    "INSERT INTO customers(id,company_id,customer_no,display_name,customer_type,phone,country_code,region,district) VALUES($1,$2,'C1','Customer One','INDIVIDUAL','000000000','TZ','Dar es Salaam','Ilala')",
    [customer, company],
  );
  for (const [user, roleName, phone] of [
    [maker, 'FINANCE_PREPARER', '0700000000'],
    [deputy, 'JOURNAL_REVIEWER', '0700000002'],
  ]) {
    await db.query(
      "INSERT INTO users(id,first_name,last_name,email,phone,user_type) VALUES($1,$2,'Finance',$3,$4,'COMPANY_USER')",
      [user, roleName, roleName + '@example.invalid', phone],
    );
    const [member] = await db.query(
      'INSERT INTO company_users(company_id,user_id) VALUES($1,$2) RETURNING id',
      [company, user],
    );
    const [role] = await db.query(
      'INSERT INTO roles(name,display_name,company_id) VALUES($1,$1,$2) RETURNING id',
      [roleName, company],
    );
    await db.query(
      'INSERT INTO company_user_roles(company_user_id,role_id) VALUES($1,$2)',
      [member.id, role.id],
    );
    await grantFixturePermissions(
      db,
      role.id,
      user === deputy
        ? [
            FinancePermissions.FOUNDATION_READ,
            FinancePermissions.FOUNDATION_ACCEPT_JOURNAL,
          ]
        : [...permissions, 'data-scope:company-all'],
    );
    tokens.set(user, await companySession(user, roleName));
  }
  const document = await companyEvidence(db, company, 'a'.repeat(64));
  const call = (user: string, path: string, body?: unknown, status?: number) =>
    request(
      tokens.get(user)!,
      body ? 'POST' : 'GET',
      '/tenant/finance/' + path,
      body,
      status,
    );
  return {
    app,
    db,
    call,
    company,
    customer,
    maker,
    checker,
    deputy,
    today,
    until,
    document,
  };
}

export async function companyEvidence(
  db: DataSource,
  company: string,
  hash: string,
) {
  const documentId = randomUUID(),
    id = randomUUID();
  await db.query(
    "INSERT INTO documents(id,company_id,owner_type,owner_id,storage_key,checksum,file_name,status) VALUES($1,$2,'COMPANY',$2,$4,$3,'evidence.pdf','AVAILABLE')",
    [documentId, company, hash, 'uat/' + id],
  );
  await db.query(
    "INSERT INTO document_versions(id,company_id,document_id,version_number,status,storage_provider,storage_key,safe_file_name,detected_mime_type,file_size,sha256_hash,uploaded_at) VALUES($1,$2,$3,1,'AVAILABLE','TEST',$5,'evidence.pdf','application/pdf',5,$4,now())",
    [id, company, documentId, hash, 'uat/' + id],
  );
  await db.query('UPDATE documents SET current_version_id=$2 WHERE id=$1', [
    documentId,
    id,
  ]);
  return { documentId, id, hash };
}
