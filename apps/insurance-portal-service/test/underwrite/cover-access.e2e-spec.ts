import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { SHORT_TERM_COVER, UnderwriteLine } from '@insurance-max/contracts';

import { AppModule } from '../../src/app.module';
import { UnderwriteCoverAccess1796000000000 } from '../../src/database/migrations/1796000000000-UnderwriteCoverAccess';
import { CompaniesService } from '../../src/modules/platform/companies/companies.service';
import { AuthorizationVersionService } from '../../src/modules/shared/authorization/authorization-version.service';
import { DataAccessScopeService } from '../../src/modules/shared/authorization/data-access-scope.service';
import { PoliciesService } from '../../src/modules/tenant/policies/policies.service';
import { QuotationStatusTransitionAction } from '../../src/modules/tenant/quotations/enums/quotation-status-transition-action.enum';
import { QuotationsService } from '../../src/modules/tenant/quotations/quotations.service';
import { QuotationsRepository } from '../../src/modules/tenant/quotations/repositories/quotations.repository';
import { MotorInsuranceQueryService } from '../../src/modules/tenant/underwrite/common/motor-insurance-query.service';
import { UnderwriteQueryService } from '../../src/modules/tenant/underwrite/common/underwrite-query.service';
import { UnderwriteQuotationCommandService } from '../../src/modules/tenant/underwrite/common/underwrite-quotation-command.service';
import { motorJourneyPayload } from '../support/motor-journey-payload';

jest.setTimeout(240_000);

const DAY_MS = 24 * 60 * 60 * 1000;

/** What an administrator grants a Short-Term (In-Transit) underwriter. */
const SHORT_TERM_UNDERWRITER = [
  'quotations:read',
  'quotations:create',
  'quotations:update',
  'quotations:complete',
  'quotations:submit-approval',
  'quotations:request-payment',
  'quotations:delete-draft',
  'policies:read',
  'customers:read',
  'underwrite.short_term.view',
  'underwrite.short_term.create',
  'underwrite.short_term.edit',
  'underwrite.short_term.delete',
  'underwrite.short_term.submit',
  'underwrite.short_term.policies.view',
];

const ALL_LINES = [
  'quotations:read',
  'policies:read',
  'underwrite.motor.view',
  'underwrite.fleet.view',
  'underwrite.non_motor.view',
  'underwrite.motor.policies.view',
  'underwrite.fleet.policies.view',
  'underwrite.non_motor.policies.view',
];

/**
 * Cover-level underwriting access against the migrated schema: server-side
 * list filtering, record and action checks on the general and Underwrite
 * routes' services, the Short-Term journey, migration backfill and
 * revocation.
 */
describe('Underwriting cover access (real database)', () => {
  let app: INestApplication;
  let db: DataSource;
  let quotations: QuotationsService;
  let policies: PoliciesService;
  let underwrite: UnderwriteQueryService;
  let motorInsurance: MotorInsuranceQueryService;
  let commands: UnderwriteQuotationCommandService;
  let scopes: DataAccessScopeService;
  let repository: QuotationsRepository;

  const suffix = randomUUID().slice(0, 8).toUpperCase();
  let companyId: string;
  let stProductId: string;
  let otherProductId: string;
  let categoryId: string;
  let branchA: string;
  let branchB: string;
  let customerId: string;
  const q: Record<string, string> = {};
  const p: Record<string, string> = {};

  async function insert(table: string, values: Record<string, unknown>) {
    const columns = Object.keys(values);
    const rows = await db.query(
      `INSERT INTO ${table} (${columns.join(', ')})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})
       RETURNING id`,
      Object.values(values),
    );
    return rows[0].id as string;
  }

  const viewer = (
    permissions: string[],
    overrides: Record<string, unknown> = {},
  ) =>
    ({
      id: randomUUID(),
      email: 'viewer@example.com',
      scope: 'company',
      companyId,
      companyType: 'INSURANCE_COMPANY',
      companyMembershipId: randomUUID(),
      roles: [],
      permissions,
      userType: 'COMPANY_USER',
      quotationPolicyDataScope: 'COMPANY',
      assignedBranchIds: [],
      activeBranchId: null,
      ...overrides,
    }) as any;

  async function quotation(
    key: string,
    flow: 'MOTOR_SINGLE' | 'MOTOR_FLEET' | 'NON_MOTOR',
    cover: string | null,
    extra: Record<string, unknown> = {},
  ) {
    q[key] = await insert('quotations', {
      company_id: companyId,
      insurer_company_id: companyId,
      category_id: categoryId,
      product_id: stProductId,
      branch_id: branchA,
      quotation_no: `QC${suffix}${key}`.slice(0, 30),
      quotation_type: flow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR',
      quotation_flow: flow,
      is_fleet: flow === 'MOTOR_FLEET',
      channel_type: 'DIRECT',
      underwrite_cover: cover,
      ...extra,
    });
    return q[key];
  }

  async function policy(
    key: string,
    line: 'MOTOR' | 'FLEET' | 'NON_MOTOR',
    quotationId: string | null,
  ) {
    p[key] = await insert('policies', {
      company_id: companyId,
      insurer_company_id: companyId,
      customer_id: customerId,
      category_id: categoryId,
      product_id: stProductId,
      branch_id: branchA,
      quotation_id: quotationId,
      policy_no: `POL-CA-${suffix}-${key}`,
      channel_type: 'DIRECT',
      business_line: line,
      start_date: '2026-11-01',
      end_date: '2026-11-30',
      issue_date: '2026-11-01',
    });
  }

  const listedQuotations = async (user: any, query: any = {}) =>
    (
      await quotations.findAllForUser(user, { page: 1, limit: 200, ...query })
    ).items
      .map((item: any) => item.id)
      .filter((id: string) => Object.values(q).includes(id));

  const listedPolicies = async (user: any) =>
    (await policies.findAllForUser(user, { page: 1, limit: 200 } as any)).data
      .map((item: any) => item.id)
      .filter((id: string) => Object.values(p).includes(id));

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DataSource);
    quotations = app.get(QuotationsService);
    policies = app.get(PoliciesService);
    underwrite = app.get(UnderwriteQueryService);
    motorInsurance = app.get(MotorInsuranceQueryService);
    commands = app.get(UnderwriteQuotationCommandService);
    scopes = app.get(DataAccessScopeService);
    repository = app.get(QuotationsRepository);

    const product = (
      await db.query(
        `SELECT id, company_id, category_id FROM insurance_products
         WHERE product_code = $1 AND company_id IS NOT NULL LIMIT 1`,
        [SHORT_TERM_COVER.productCode],
      )
    )[0];
    companyId = product.company_id;
    stProductId = product.id;
    categoryId = product.category_id;
    otherProductId = (
      await db.query(
        `SELECT id FROM insurance_products
         WHERE product_code = 'SP014002000000' AND company_id = $1 LIMIT 1`,
        [companyId],
      )
    )[0]?.id;

    branchA = await insert('branches', {
      company_id: companyId,
      name: `CA Branch A ${suffix}`,
      code: `CAA${suffix.slice(0, 4)}`,
      policy_numbering_code: String(8000 + Math.floor(Math.random() * 900)),
    });
    branchB = await insert('branches', {
      company_id: companyId,
      name: `CA Branch B ${suffix}`,
      code: `CAB${suffix.slice(0, 4)}`,
      policy_numbering_code: String(8900 + Math.floor(Math.random() * 99)),
    });
    customerId = await insert('customers', {
      company_id: companyId,
      customer_no: `CUST-CA-${suffix}`,
      customer_type: 'INDIVIDUAL',
      first_name: 'Neema',
      last_name: 'Transit',
      phone: '0712345678',
      country_code: 'TZA',
      region: 'Dar es Salaam',
      district: 'Ilala',
      status: 'ACTIVE',
    });

    await quotation('motor', 'MOTOR_SINGLE', 'MOTOR');
    await quotation('fleet', 'MOTOR_FLEET', 'FLEET');
    await quotation('nonMotor', 'NON_MOTOR', 'NON_MOTOR');
    await quotation('shortTerm', 'MOTOR_SINGLE', 'SHORT_TERM_SINGLE');
    await quotation('shortTermFleet', 'MOTOR_FLEET', 'SHORT_TERM_FLEET');
    await quotation('shortTermB', 'MOTOR_SINGLE', 'SHORT_TERM_SINGLE', {
      branch_id: branchB,
    });
    // Written before covers were stored: falls back to its line.
    await quotation('unclassified', 'MOTOR_SINGLE', null);

    await policy('shortTerm', 'MOTOR', q.shortTerm);
    await policy('motor', 'MOTOR', q.motor);
    await policy('fleet', 'FLEET', q.fleet);
    await policy('manual', 'MOTOR', null);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('list and search filtering', () => {
    it('shows a Short-Term-only user only Short-Term Single quotations', async () => {
      const ids = await listedQuotations(viewer(SHORT_TERM_UNDERWRITER));
      expect(new Set(ids)).toEqual(new Set([q.shortTerm, q.shortTermB]));
    });

    it('filters search results on the server', async () => {
      const user = viewer(SHORT_TERM_UNDERWRITER);
      expect(
        await listedQuotations(user, { search: `QC${suffix}motor` }),
      ).toEqual([]);
      expect(
        await listedQuotations(user, { search: `QC${suffix}shortTerm` }),
      ).toContain(q.shortTerm);
    });

    it('filters the Underwrite Motor line and the unified Motor register', async () => {
      const user = viewer(SHORT_TERM_UNDERWRITER);
      const line = (
        await underwrite.listQuotations(user, UnderwriteLine.MOTOR, {
          page: 1,
          limit: 200,
        } as any)
      ).items.map((item: any) => item.id);
      expect(line).toContain(q.shortTerm);
      expect(line).not.toContain(q.motor);
      expect(line).not.toContain(q.unclassified);

      const unified = (
        await motorInsurance.listQuotations(user, {
          page: 1,
          limit: 200,
        } as any)
      ).items.map((item: any) => item.id);
      expect(unified).toContain(q.shortTerm);
      expect(unified).not.toContain(q.motor);
      expect(unified).not.toContain(q.fleet);
    });

    it('keeps existing broad access to every cover, including unclassified rows', async () => {
      const ids = await listedQuotations(viewer(ALL_LINES));
      expect(new Set(ids)).toEqual(new Set(Object.values(q)));
    });

    it('combines Short-Term with Fleet and Non-Motor grants', async () => {
      const ids = await listedQuotations(
        viewer([
          ...SHORT_TERM_UNDERWRITER,
          'underwrite.fleet.view',
          'underwrite.non_motor.view',
        ]),
      );
      expect(new Set(ids)).toEqual(
        new Set([
          q.shortTerm,
          q.shortTermB,
          q.shortTermFleet,
          q.fleet,
          q.nonMotor,
        ]),
      );
    });

    it('distinguishes Short-Term Single from Short-Term Fleet', async () => {
      const ids = await listedQuotations(
        viewer(['quotations:read', 'underwrite.short_term_fleet.view']),
      );
      expect(ids).toEqual([q.shortTermFleet]);
    });

    it('applies the cover restriction together with the branch data scope', async () => {
      const ids = await listedQuotations(
        viewer(SHORT_TERM_UNDERWRITER, {
          quotationPolicyDataScope: 'BRANCH',
          assignedBranchIds: [branchB],
          activeBranchId: branchB,
        }),
      );
      expect(ids).toEqual([q.shortTermB]);
    });

    it('filters policies by the cover of their source quotation', async () => {
      expect(await listedPolicies(viewer(SHORT_TERM_UNDERWRITER))).toEqual([
        p.shortTerm,
      ]);
      expect(new Set(await listedPolicies(viewer(ALL_LINES)))).toEqual(
        new Set(Object.values(p)),
      );
    });
  });

  describe('direct record and action attempts', () => {
    const user = () => viewer(SHORT_TERM_UNDERWRITER);

    it('hides Motor, Fleet and Non-Motor records (404, not 403)', async () => {
      for (const key of ['motor', 'fleet', 'nonMotor', 'unclassified']) {
        await expect(
          quotations.findOneForUser(user(), q[key]),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
      await expect(
        underwrite.getQuotation(user(), UnderwriteLine.MOTOR, q.motor),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        policies.findOneForUser(user(), p.motor),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        policies.findOneForUser(user(), p.manual),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('serves its own records and their documents', async () => {
      // Fixture rows have no cover note, so check readability directly.
      await expect(
        quotations.assertReadableForUser(user(), q.shortTerm),
      ).resolves.toBeUndefined();
      await expect(
        policies.findOneForUser(user(), p.shortTerm),
      ).resolves.toMatchObject({ id: p.shortTerm });
      await expect(
        quotations.getDocumentSourceForUser(user(), q.motor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses payment, submission and edit actions on other covers', async () => {
      await expect(
        quotations.requestPayment(companyId, q.motor, user()),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        quotations.submitForApprovalAction(companyId, q.fleet, user()),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        quotations.findOneForEditForUser(user(), q.motor),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        quotations.removeDraftForUser(user(), q.motor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('requires the approve grant on the cover to approve', async () => {
      const withoutGrant = viewer([
        ...SHORT_TERM_UNDERWRITER,
        'quotations:approve',
      ]);
      await expect(
        quotations.transitionStatus(
          companyId,
          q.shortTerm,
          { action: QuotationStatusTransitionAction.APPROVE } as any,
          withoutGrant,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      const approver = viewer([
        'quotations:approve',
        'underwrite.short_term.approve',
      ]);
      const scope = scopes.resolve(approver, 'quotations:approve');
      await expect(repository.assertWritable(scope, q.shortTerm)).resolves.toBe(
        undefined,
      );
      await expect(
        repository.assertWritable(scope, q.motor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not let a Short-Term grant enter Motor policy transactions', () => {
      expect(() =>
        motorInsurance.permittedLines(user(), 'endorsements.view' as any),
      ).toThrow(ForbiddenException);
    });
  });

  describe('Short-Term Single journey', () => {
    let underwriter: any;
    let fx: any;

    beforeAll(async () => {
      const branch = (
        await db.query(
          `SELECT b.id, s.sale_point_code FROM branches b
           JOIN tiramis_sale_points s ON s.branch_id = b.id
           WHERE b.company_id = $1 AND s.is_default AND s.is_active LIMIT 1`,
          [companyId],
        )
      )[0];
      fx = {
        companyId,
        productId: stProductId,
        categoryId,
        branchId: branch?.id,
        salePointCode: branch?.sale_point_code,
        tiramisProductCode: SHORT_TERM_COVER.productCode,
      };
      const userId = await insert('users', {
        first_name: 'Transit',
        last_name: 'Underwriter',
        email: `transit${suffix}@example.com`,
        phone: '+255' + Math.random().toString().slice(2, 11),
        password: 'unused',
        user_type: 'COMPANY_USER',
        status: 'active',
        officer_title: 'Underwriter',
      });
      const membership = await insert('company_users', {
        company_id: companyId,
        user_id: userId,
        status: 'active',
        is_default: true,
        quotation_policy_data_scope: 'COMPANY',
      });
      for (const [table, column, id] of [
        ['user_product_access', 'product_id', stProductId],
        ['user_category_access', 'category_id', categoryId],
      ]) {
        await db.query(
          `INSERT INTO ${table} (company_id, company_user_id, ${column}, can_view, can_create_policy, access_status, is_active)
           VALUES ($1, $2, $3, true, true, 'ALLOW', true)`,
          [companyId, membership, id],
        );
      }
      if (fx.branchId) {
        await insert('branch_users', {
          branch_id: fx.branchId,
          company_user_id: membership,
          is_primary: true,
          is_active_branch: true,
          activated_at: new Date(),
        });
      }
      underwriter = viewer(SHORT_TERM_UNDERWRITER, {
        id: userId,
        companyMembershipId: membership,
        assignedBranchIds: fx.branchId ? [fx.branchId] : [],
        activeBranchId: fx.branchId ?? null,
      });
    });

    function shortTermBody() {
      const body = motorJourneyPayload(fx, false);
      const tag = randomUUID().slice(0, 6).toUpperCase();
      body.cover_note_dtl.motor_dtl.registration_number = `T${tag}`;
      body.cover_note_dtl.motor_dtl.chassis_number = `CH${tag}`;
      body.cover_note_dtl.risks_covered = body.cover_note_dtl.risks_covered.map(
        (risk: any) => ({ ...risk, risk_code: SHORT_TERM_COVER.riskCode }),
      );
      const start = new Date(`${body.cover_note_dtl.cover_note_start_date}Z`);
      body.cover_note_dtl.cover_note_end_date = new Date(
        start.getTime() + 29 * DAY_MS,
      )
        .toISOString()
        .slice(0, 19);
      return body;
    }

    const draftDto = (body: any, extra: Record<string, unknown> = {}) => ({
      ...body.internal_quotation,
      current_wizard_step: 'details',
      draft_payload: { customerName: 'Transit customer' },
      ...extra,
    });

    const coverOf = async (id: string) =>
      (
        await db.query(
          'SELECT underwrite_cover FROM quotations WHERE id = $1',
          [id],
        )
      )[0].underwrite_cover;

    it('creates, reopens, edits and completes a Short-Term draft', async () => {
      const body = shortTermBody();
      const draft = await commands.createDraft(
        underwriter,
        UnderwriteLine.MOTOR,
        draftDto(body, { underwrite_cover: 'SHORT_TERM_SINGLE' }),
      );
      expect(await coverOf(draft.id)).toBe('SHORT_TERM_SINGLE');

      // Reopen the draft (Underwrite edit route service).
      await expect(
        commands.getForEdit(underwriter, UnderwriteLine.MOTOR, draft.id),
      ).resolves.toMatchObject({ id: draft.id });

      await commands.updateDraft(
        underwriter,
        UnderwriteLine.MOTOR,
        draft.id,
        draftDto(body, {
          current_wizard_step: 'premium',
          draft_payload: { risks: [{ risk_code: SHORT_TERM_COVER.riskCode }] },
        }),
      );
      expect(await coverOf(draft.id)).toBe('SHORT_TERM_SINGLE');

      await commands.finalize(
        underwriter,
        UnderwriteLine.MOTOR,
        draft.id,
        body,
      );
      expect(await coverOf(draft.id)).toBe('SHORT_TERM_SINGLE');
      await expect(
        quotations.getDocumentSourceForUser(underwriter, draft.id),
      ).resolves.toBeDefined();
    });

    it('rejects an unlabelled draft (it would be ordinary Motor)', async () => {
      await expect(
        commands.createDraft(
          underwriter,
          UnderwriteLine.MOTOR,
          draftDto(shortTermBody()),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a Short-Term label on another product', async () => {
      if (!otherProductId) return;
      await db.query(
        `INSERT INTO user_product_access (company_id, company_user_id, product_id, can_view, can_create_policy, access_status, is_active)
         VALUES ($1, $2, $3, true, true, 'ALLOW', true) ON CONFLICT DO NOTHING`,
        [companyId, underwriter.companyMembershipId, otherProductId],
      );
      const body = shortTermBody();
      await expect(
        quotations.createDraft(
          companyId,
          {
            ...draftDto(body, { underwrite_cover: 'SHORT_TERM_SINGLE' }),
            product_id: otherProductId,
          },
          underwriter,
        ),
      ).rejects.toMatchObject({
        response: { code: 'UNDERWRITE_COVER_MISMATCH' },
      });
    });

    it('prevents changing a draft into ordinary Motor, and keeps it unchanged', async () => {
      const body = shortTermBody();
      const draft = await commands.createDraft(
        underwriter,
        UnderwriteLine.MOTOR,
        draftDto(body, { underwrite_cover: 'SHORT_TERM_SINGLE' }),
      );
      await expect(
        commands.updateDraft(
          underwriter,
          UnderwriteLine.MOTOR,
          draft.id,
          draftDto(body, {
            draft_payload: {
              risks: [
                { risk_code: SHORT_TERM_COVER.riskCode },
                { risk_code: 'SP014001000001' },
              ],
            },
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await coverOf(draft.id)).toBe('SHORT_TERM_SINGLE');

      const motorBody = motorJourneyPayload(fx, false);
      motorBody.cover_note_dtl.motor_dtl.registration_number = `T${randomUUID().slice(0, 6)}`;
      await expect(
        commands.finalize(
          underwriter,
          UnderwriteLine.MOTOR,
          draft.id,
          motorBody,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await coverOf(draft.id)).toBe('SHORT_TERM_SINGLE');
    });

    it('rejects a Short-Term cover longer than 30 days', async () => {
      const body = shortTermBody();
      body.cover_note_dtl.cover_note_end_date = new Date(
        new Date(`${body.cover_note_dtl.cover_note_start_date}Z`).getTime() +
          364 * DAY_MS,
      )
        .toISOString()
        .slice(0, 19);
      const draft = await commands.createDraft(
        underwriter,
        UnderwriteLine.MOTOR,
        draftDto(body, { underwrite_cover: 'SHORT_TERM_SINGLE' }),
      );
      await expect(
        commands.finalize(underwriter, UnderwriteLine.MOTOR, draft.id, body),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('migration backfill', () => {
    it('classifies historical rows conservatively and backfills gates', async () => {
      const stRisks = { risks: [{ risk_code: SHORT_TERM_COVER.riskCode }] };
      await quotation('histShortTerm', 'MOTOR_SINGLE', null, {
        draft_payload: stRisks,
      });
      await quotation('histShortTermFleet', 'MOTOR_FLEET', null, {
        draft_payload: { fleet: { items: [stRisks] } },
      });
      await quotation('histMixed', 'MOTOR_SINGLE', null, {
        draft_payload: {
          risks: [
            { risk_code: SHORT_TERM_COVER.riskCode },
            { risk_code: 'SP014001000001' },
          ],
        },
      });
      await quotation('histEmpty', 'MOTOR_SINGLE', null, { draft_payload: {} });
      await quotation('histNonMotor', 'NON_MOTOR', null);
      if (otherProductId) {
        await quotation('histOtherProduct', 'MOTOR_SINGLE', null, {
          product_id: otherProductId,
          draft_payload: stRisks,
        });
      }

      const role = async (name: string, permissions: string[]) => {
        const id = await insert('roles', {
          name: `${name}_${suffix}`,
          display_name: name,
          company_id: companyId,
        });
        await db.query(
          `INSERT INTO permission_role (roles_id, permissions_id)
           SELECT $1, id FROM permissions WHERE name = ANY($2::text[])`,
          [id, permissions],
        );
        return id;
      };
      const legacyRole = await role('LEGACY', [
        'quotations:read',
        'quotations:submit-approval',
      ]);
      const motorOnlyRole = await role('MOTOR_ONLY', [
        'quotations:read',
        'quotations:request-payment',
        'underwrite.motor.view',
      ]);

      const runner = db.createQueryRunner();
      try {
        await new UnderwriteCoverAccess1796000000000().up(runner);
      } finally {
        await runner.release();
      }

      expect(await coverOf('histShortTerm')).toBe('SHORT_TERM_SINGLE');
      expect(await coverOf('histShortTermFleet')).toBe('SHORT_TERM_FLEET');
      expect(await coverOf('histMixed')).toBe('MOTOR');
      expect(await coverOf('histEmpty')).toBe('MOTOR');
      expect(await coverOf('histNonMotor')).toBe('NON_MOTOR');
      if (otherProductId)
        expect(await coverOf('histOtherProduct')).toBe('MOTOR');
      // Already classified rows are left alone.
      expect(await coverOf('shortTerm')).toBe('SHORT_TERM_SINGLE');

      const granted = async (roleId: string) =>
        (
          await db.query(
            `SELECT p.name FROM permission_role pr JOIN permissions p ON p.id = pr.permissions_id
             WHERE pr.roles_id = $1 AND p.name LIKE 'underwrite.%' ORDER BY p.name`,
            [roleId],
          )
        ).map((row: any) => row.name);

      // Never configured: every line, exactly the access it had before.
      expect(await granted(legacyRole)).toEqual([
        'underwrite.fleet.submit',
        'underwrite.fleet.view',
        'underwrite.motor.submit',
        'underwrite.motor.view',
        'underwrite.non_motor.submit',
        'underwrite.non_motor.view',
      ]);
      // Configured for Motor: stays Motor; Short-Term is never derived.
      expect(await granted(motorOnlyRole)).toEqual([
        'underwrite.motor.submit',
        'underwrite.motor.view',
      ]);
    });

    async function coverOf(key: string) {
      return (
        await db.query(
          'SELECT underwrite_cover FROM quotations WHERE id = $1',
          [q[key]],
        )
      )[0].underwrite_cover;
    }
  });

  describe('revocation', () => {
    it('removes access on the next request after a role loses the grant', async () => {
      const userId = await insert('users', {
        first_name: 'Revoked',
        last_name: 'Underwriter',
        email: `revoked${suffix}@example.com`,
        phone: '+255' + Math.random().toString().slice(2, 11),
        password: 'unused',
        user_type: 'COMPANY_USER',
        status: 'active',
      });
      const membership = await insert('company_users', {
        company_id: companyId,
        user_id: userId,
        status: 'active',
        is_default: true,
        quotation_policy_data_scope: 'COMPANY',
      });
      const roleId = await insert('roles', {
        name: `ST_${suffix}`,
        display_name: 'Short-Term underwriter',
        company_id: companyId,
      });
      await db.query(
        `INSERT INTO permission_role (roles_id, permissions_id)
         SELECT $1, id FROM permissions WHERE name = ANY($2::text[])`,
        [roleId, SHORT_TERM_UNDERWRITER],
      );
      await db.query(
        `INSERT INTO company_user_roles (company_user_id, role_id) VALUES ($1, $2)`,
        [membership, roleId],
      );

      const companies = app.get(CompaniesService);
      const before = await companies.getMembershipContext(userId, companyId);
      expect(before.permissions).toContain('underwrite.short_term.view');
      const asUser = (context: typeof before) =>
        viewer(context.permissions, {
          id: userId,
          companyMembershipId: membership,
        });
      expect(await listedQuotations(asUser(before))).toContain(q.shortTerm);

      // What the role editor does: change permissions, bump the version.
      await db.query(
        `DELETE FROM permission_role WHERE roles_id = $1 AND permissions_id IN
           (SELECT id FROM permissions WHERE name = 'underwrite.short_term.view')`,
        [roleId],
      );
      await app.get(AuthorizationVersionService).bumpForRole(roleId);

      const after = await companies.getMembershipContext(userId, companyId);
      // A token carrying the old version is rejected by JwtStrategy.
      expect(after.authorizationVersion).toBeGreaterThan(
        before.authorizationVersion,
      );
      expect(await listedQuotations(asUser(after))).toEqual([]);
    });
  });
});
