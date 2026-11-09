import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { UnderwriteLine } from '@insurance-max/contracts';
import { AppModule } from '../../src/app.module';
import { QuotationsService } from '../../src/modules/tenant/quotations/quotations.service';
import { QuotationApprovalPolicyService } from '../../src/modules/tenant/quotations/approval-policy/quotation-approval-policy.service';
import { normalizeApprovalPolicy } from '../../src/modules/tenant/quotations/approval-policy/quotation-approval-policy';
import { UnderwriteQuotationCommandService } from '../../src/modules/tenant/underwrite/common/underwrite-quotation-command.service';
import { FinanceCommandService } from '../../src/modules/tenant/billing-commission/services/finance-command.service';
import { QuotationStatusTransitionAction } from '../../src/modules/tenant/quotations/enums/quotation-status-transition-action.enum';
import { UnderwriteQueryService } from '../../src/modules/tenant/underwrite/common/underwrite-query.service';
import { FleetRegisterService } from '../../src/modules/tenant/underwrite/fleet/fleet-register.service';
import { TiramisClientService } from '../../src/modules/tiramis/services/tiramis-client.service';
import { TiramisIntegrationService } from '../../src/modules/tenant/tiramis-integration/tiramis-integration.service';
import { motorJourneyPayload } from '../support/motor-journey-payload';

jest.setTimeout(180_000);

/** Real migrated database and application services. External gateway cases are added below; no working database is used. */
describe('Single Motor and Fleet business acceptance (real database)', () => {
  let app: INestApplication;
  let db: DataSource;
  let quotations: QuotationsService;
  let commands: UnderwriteQuotationCommandService;
  let finance: FinanceCommandService;
  let fx: any;
  let maker: any;
  let checker: any;
  const suffix = randomUUID().slice(0, 8);

  async function insert(table: string, values: Record<string, unknown>) {
    const keys = Object.keys(values);
    return (
      await db.query(
        `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`,
        Object.values(values),
      )
    )[0].id;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    db = app.get(DataSource);
    quotations = app.get(QuotationsService);
    commands = app.get(UnderwriteQuotationCommandService);
    finance = app.get(FinanceCommandService);
    const product = (
      await db.query(
        `SELECT p.id, p.company_id, p.category_id, p.product_code FROM insurance_products p WHERE product_code='SP014001000000' AND company_id IS NOT NULL LIMIT 1`,
      )
    )[0];
    if (!product) throw new Error('Seeded motor product missing');
    const branch = (
      await db.query(
        `SELECT b.id, s.sale_point_code FROM branches b JOIN tiramis_sale_points s ON s.branch_id=b.id WHERE b.company_id=$1 AND s.is_default AND s.is_active LIMIT 1`,
        [product.company_id],
      )
    )[0];
    fx = {
      companyId: product.company_id,
      productId: product.id,
      categoryId: product.category_id,
      branchId: branch?.id,
      salePointCode: branch?.sale_point_code,
      tiramisProductCode: product.product_code,
    };
    const permissions = (await db.query('SELECT name FROM permissions')).map(
      (row: any) => row.name,
    );
    async function actor(label: string) {
      const id = await insert('users', {
        first_name: label,
        last_name: 'Acceptance',
        email: label + suffix + '@example.com',
        phone: '+255' + Math.random().toString().slice(2, 11),
        password: 'unused',
        user_type: 'COMPANY_USER',
        status: 'active',
        officer_title: 'Underwriter',
      });
      const membership = await insert('company_users', {
        company_id: fx.companyId,
        user_id: id,
        status: 'active',
        is_default: true,
        quotation_policy_data_scope: 'COMPANY',
      });
      await db.query(
        `INSERT INTO company_user_roles (company_user_id, role_id) SELECT $1,id FROM roles WHERE name='INSURANCE_ADMIN' AND company_id=$2 LIMIT 1`,
        [membership, fx.companyId],
      );
      await db.query(
        `INSERT INTO user_product_access (company_id,company_user_id,product_id,can_view,can_create_policy,access_status,is_active) VALUES ($1,$2,$3,true,true,'ALLOW',true)`,
        [fx.companyId, membership, fx.productId],
      );
      await db.query(
        `INSERT INTO user_category_access (company_id,company_user_id,category_id,can_view,can_create_policy,access_status,is_active) VALUES ($1,$2,$3,true,true,'ALLOW',true)`,
        [fx.companyId, membership, fx.categoryId],
      );
      if (fx.branchId)
        await insert('branch_users', {
          branch_id: fx.branchId,
          company_user_id: membership,
          is_primary: true,
          is_active_branch: true,
          activated_at: new Date(),
        });
      return {
        id,
        scope: 'company',
        companyId: fx.companyId,
        companyType: 'INSURANCE_COMPANY',
        companyMembershipId: membership,
        userType: 'COMPANY_USER',
        roles: [],
        permissions,
        quotationPolicyDataScope: 'COMPANY',
        assignedBranchIds: fx.branchId ? [fx.branchId] : [],
        activeBranchId: fx.branchId,
      };
    }
    maker = await actor('maker');
    checker = await actor('checker');
  });
  afterAll(async () => {
    await app?.close();
  });
  afterEach(() => jest.restoreAllMocks());

  const row = async (id: string) =>
    (await db.query('SELECT * FROM quotations WHERE id=$1', [id]))[0];
  const latestInvoice = async (id: string) =>
    (
      await db.query(
        'SELECT * FROM invoices WHERE quotation_id=$1 ORDER BY created_at DESC LIMIT 1',
        [id],
      )
    )[0];

  async function prepare(fleet: boolean, automaticApproval = false) {
    const line = fleet ? UnderwriteLine.FLEET : UnderwriteLine.MOTOR;
    const body = motorJourneyPayload(fx, fleet);
    // Fresh vehicle identity for each independent business journey.
    const entries = fleet
      ? body.cover_note_dtl.fleet_dtls
      : [body.cover_note_dtl];
    entries.forEach((entry: any, i: number) => {
      const tag = randomUUID().slice(0, 6).toUpperCase();
      entry.motor_dtl.registration_number = 'T' + tag + i;
      entry.motor_dtl.chassis_number = 'CH' + tag + i;
    });
    const dto: any = {
      ...body.internal_quotation,
      draft_payload: {
        customerName: 'Acceptance fleet',
        cover_note_number: 'CN-' + randomUUID(),
      },
      current_wizard_step: 'details',
    };
    const draft = await commands.createDraft(maker, line, dto);
    const reloaded = await commands.getForEdit(maker, line, draft.id);
    expect(reloaded.draft_payload).toMatchObject({
      customerName: 'Acceptance fleet',
    });
    await commands.updateDraft(maker, line, draft.id, {
      ...dto,
      current_wizard_step: 'premium',
      draft_payload: { ...dto.draft_payload, edited: true },
    });
    expect(
      (await commands.getForEdit(maker, line, draft.id)).draft_payload,
    ).toMatchObject({ edited: true });
    const copy = await commands.duplicate(maker, line, draft.id, dto);
    expect(copy.id).not.toBe(draft.id);
    expect(copy.quotation_no).not.toBe(draft.quotation_no);
    expect(copy.status).toBe('DRAFT');
    expect(copy.draft_payload).toHaveProperty('cover_note_number', '');
    await commands.finalize(maker, line, draft.id, body);
    const persisted = await quotations.getAuthoritativePayload(
      fx.companyId,
      draft.id,
    );
    const header = fleet
      ? persisted.cover_note_dtl.fleet_hdr!
      : persisted.cover_note_dtl;
    expect(Number(header.total_premium_including_tax)).toBeGreaterThan(0);
    // Approval requirement is a scenario configuration, using the same lifecycle as a requiring product.
    await db.query(
      `UPDATE quotations SET requires_approval=true, approval_status='NOT_SUBMITTED', quotation_status='PENDING_REQUIREMENTS' WHERE id=$1`,
      [draft.id],
    );
    if (automaticApproval) {
      const policy = jest
        .spyOn(app.get(QuotationApprovalPolicyService), 'getPolicy')
        .mockResolvedValue(
          normalizeApprovalPolicy({
            auto_approval: {
              enabled: true,
              rules: [{ id: 'auto', name: 'Acceptance auto approval' }],
            },
          }),
        );
      await (quotations as any).tryAutoApprove(fx.companyId, draft.id);
      policy.mockRestore();
    } else {
      await quotations.submitForApprovalAction(fx.companyId, draft.id, maker);
      expect((await row(draft.id)).approval_status).toBe('PENDING');
      await quotations.transitionStatus(
        fx.companyId,
        draft.id,
        {
          action: QuotationStatusTransitionAction.APPROVE,
          comments: 'Acceptance approved',
        },
        checker,
      );
    }
    expect((await row(draft.id)).approval_status).toBe('APPROVED');
    await quotations.requestPayment(fx.companyId, draft.id, maker);
    let invoice = await latestInvoice(draft.id);
    if (invoice.status === 'DRAFT')
      invoice = await finance.issue(maker, invoice.id, {
        expected_state_version: invoice.state_version,
        idempotency_key: randomUUID(),
      });
    expect(invoice.status).toBe('ISSUED');
    return { id: draft.id, line, body, invoice, persisted };
  }

  async function pay(invoice: any) {
    const dto: any = {
      invoice_id: invoice.id,
      provider_code: 'ACCEPTANCE',
      provider_transaction_id: randomUUID(),
      payment_method: 'BANK_TRANSFER',
      payment_reference: randomUUID(),
      amount: Number(invoice.total_amount),
      currency_code: invoice.currency,
      payer_name: 'Acceptance',
      idempotency_key: randomUUID(),
    };
    const payment = await finance.recordManualPayment(maker, dto);
    expect((await finance.recordManualPayment(maker, dto)).id).toBe(payment.id);
    const receiptCommand = {
      payment_transaction_id: payment.id,
      idempotency_key: randomUUID(),
    };
    const receipt = await finance.postReceipt(maker, receiptCommand);
    expect((await finance.postReceipt(maker, receiptCommand)).id).toBe(
      receipt.id,
    );
    const allocation = {
      invoice_id: invoice.id,
      amount: Number(invoice.total_amount),
      idempotency_key: randomUUID(),
    };
    await finance.allocate(maker, receipt.id, allocation);
    await finance.allocate(maker, receipt.id, allocation);
  }

  async function submitAndIssue(
    journey: Awaited<ReturnType<typeof prepare>>,
    fleet: boolean,
  ) {
    const client: any = app.get(TiramisClientService);
    const acceptance = () => ({
      transactionId: randomUUID(),
      requestId: 'REQ-' + randomUUID(),
      status: 'ACCEPTED_BY_TIRAMIS_SERVICE',
      transactionStatus: 'SUBMITTED',
      serviceType: fleet ? 'MOTOR_FLEET' : 'MOTOR',
      rootElement: fleet ? 'MotorCoverNoteFleet' : 'MotorCoverNote',
      acceptedAt: new Date().toISOString(),
      resourceVersion: 1,
      correlationId: randomUUID(),
    });
    // Only the external gateway transport is replaced. Validation, snapshots,
    // tracking, lifecycle, callback application and issuance use real services/SQL.
    let failTransport = true;
    const transport = async () => {
      if (failTransport) {
        failTransport = false;
        throw new Error('Injected gateway timeout');
      }
      return acceptance();
    };
    const send = jest.spyOn(client, 'send').mockImplementation(transport);
    const canonical = jest
      .spyOn(client, 'sendCanonicalEnvelope')
      .mockImplementation(transport);
    await expect(
      quotations.submit(fx.companyId, journey.id, {}, maker),
    ).rejects.toThrow('Injected gateway timeout');
    expect((await row(journey.id)).tira_status).toBe('FAILED');
    await quotations.retryTiraSubmission(fx.companyId, journey.id, maker);
    const current = await row(journey.id);
    expect(current.tira_request_id).toBeTruthy();
    const calls = send.mock.calls.length + canonical.mock.calls.length;
    await quotations.submit(
      fx.companyId,
      journey.id,
      { return_existing: true },
      maker,
    );
    expect(send.mock.calls.length + canonical.mock.calls.length).toBe(calls);
    const entries = await db.query(
      `SELECT e.id, e.fleet_entry, d.registration_number, d.chassis_number FROM quotation_cover_note_entries e JOIN quotation_cover_notes c ON c.id=e.cover_note_id JOIN quotation_motor_details d ON d.entry_id=e.id WHERE c.quotation_id=$1 ORDER BY e.entry_number`,
      [journey.id],
    );
    const notes = entries
      .map((entry: any, i: number) => ({
        fleetEntry: entry.fleet_entry,
        registrationNumber: entry.registration_number,
        chassisNumber: entry.chassis_number,
        coverNoteReferenceNumber: 'CNR-' + journey.id + '-' + i,
        stickerNumber: 'STK-' + journey.id + '-' + i,
      }))
      .reverse(); // Force matching by vehicle identity, never response order.
    const callback: any = {
      eventType: 'TIRAMIS_FINAL_SUCCESS',
      sourceService: 'insurance-portal-service',
      sourceCompanyId: fx.companyId,
      sourceModule: 'quotations',
      sourceRecordId: journey.id,
      requestId: current.tira_request_id,
      responseId: 'RESP-' + randomUUID(),
      serviceType: fleet ? 'MOTOR_FLEET' : 'MOTOR',
      statusCode: '0',
      statusDescription: 'Success',
      regulatoryResponse: {
        success: true,
        requestType: fleet ? 'MOTOR_FLEET' : 'MOTOR',
        requestId: current.tira_request_id,
        responseId: 'RESP-' + randomUUID(),
        transactionId: randomUUID(),
        statusCode: '0',
        statusDescription: 'Success',
        coverNotes: notes,
      },
    };
    const integration = app.get(TiramisIntegrationService);
    await integration.handleTiramisNotification(callback);
    await integration.handleTiramisNotification(callback);
    const policies = await db.query(
      'SELECT id FROM policies WHERE quotation_id=$1',
      [journey.id],
    );
    expect(policies).toHaveLength(1);
    const linked = await app
      .get(UnderwriteQueryService)
      .listPolicies(maker, journey.line, { quotation_id: journey.id });
    expect(linked.data.map((policy: { id: string }) => policy.id)).toEqual([
      policies[0].id,
    ]);
    const unrelated = await app
      .get(UnderwriteQueryService)
      .listPolicies(maker, journey.line, { quotation_id: randomUUID() });
    expect(unrelated.data).toEqual([]);
    const coverNotes = await db.query(
      'SELECT quotation_entry_id, policy_id, cover_note_reference_number, sticker_number FROM cover_notes WHERE quotation_id=$1',
      [journey.id],
    );
    expect(coverNotes).toHaveLength(fleet ? 2 : 1);
    for (const entry of entries) {
      const expected = notes.find(
        (note: any) => note.registrationNumber === entry.registration_number,
      )!;
      expect(
        coverNotes.find((note: any) => note.quotation_entry_id === entry.id),
      ).toMatchObject({
        policy_id: policies[0].id,
        cover_note_reference_number: expected.coverNoteReferenceNumber,
        sticker_number: expected.stickerNumber,
      });
    }
    expect((await row(journey.id)).tira_status).toBe('SUCCESS');
  }

  function changePremium(body: any, fleet: boolean) {
    const changed = structuredClone(body);
    const entries = fleet
      ? changed.cover_note_dtl.fleet_dtls
      : [changed.cover_note_dtl];
    entries[0].risks_covered[0].sum_insured += 20_000_000;
    entries[0].risks_covered[0].sum_insured_equivalent =
      entries[0].risks_covered[0].sum_insured;
    return changed;
  }

  it('retains fleet-register failures across reloads and clears them after retry', async () => {
    const journey = await prepare(true);
    const register = app.get(FleetRegisterService);
    const failure = jest
      .spyOn(register as any, 'syncInTransaction')
      .mockRejectedValueOnce(new Error('Injected register outage'));
    await expect(
      register.syncFromQuotation(fx.companyId, journey.id),
    ).rejects.toThrow('Injected register outage');
    const failed = await row(journey.id);
    expect(failed.fleet_register_sync_status).toBe('FAILED');
    expect(failed.fleet_register_sync_error).toContain('Retry');
    expect(failed.fleet_register_sync_attempted_at).toBeTruthy();
    failure.mockRestore();
    await register.syncFromQuotation(fx.companyId, journey.id);
    expect((await row(journey.id)).fleet_register_sync_status).toBe('SYNCED');
    expect((await row(journey.id)).fleet_register_sync_error).toBeNull();
  });

  for (const fleet of [false, true]) {
    it(
      (fleet ? 'Fleet' : 'Single Motor') +
        ': creates, reloads, edits, duplicates, prices, approves, pays, submits, applies callback and issues idempotently',
      async () => {
        const journey = await prepare(fleet, true);
        await expect(
          quotations.submit(fx.companyId, journey.id, {}, maker),
        ).rejects.toThrow('Quotation payment is not complete');
        await pay(journey.invoice);
        expect((await row(journey.id)).payment_status).toBe('PAID');
        await quotations.replace(fx.companyId, journey.id, journey.body, maker);
        await submitAndIssue(journey, fleet);
        if (fleet) {
          const register = app.get(FleetRegisterService);
          const first = await register.syncFromQuotation(
            fx.companyId,
            journey.id,
          );
          expect(
            (await register.syncFromQuotation(fx.companyId, journey.id))
              .fleetId,
          ).toBe(first.fleetId);
          expect((await row(journey.id)).fleet_register_sync_status).toBe(
            'SYNCED',
          );
        }
      },
    );

    it(
      (fleet ? 'Fleet' : 'Single Motor') +
        ': rolls back invoice-void failure and retries the premium edit safely',
      async () => {
        const journey = await prepare(fleet);
        const before = await row(journey.id);
        const payloadBefore = await quotations.getAuthoritativePayload(
          fx.companyId,
          journey.id,
        );
        const failure = jest
          .spyOn(finance, 'voidInvoice')
          .mockRejectedValueOnce(new Error('Injected invoice void failure'));
        const changed = changePremium(journey.body, fleet);
        await expect(
          quotations.replace(fx.companyId, journey.id, changed, maker),
        ).rejects.toThrow('Injected invoice void failure');
        expect((await row(journey.id)).approval_status).toBe(
          before.approval_status,
        );
        expect((await latestInvoice(journey.id)).status).toBe('ISSUED');
        expect(
          await quotations.getAuthoritativePayload(fx.companyId, journey.id),
        ).toEqual(payloadBefore);
        failure.mockRestore();
        await quotations.replace(fx.companyId, journey.id, changed, maker);
        expect((await latestInvoice(journey.id)).status).toBe('VOIDED');
        expect((await row(journey.id)).payment_status).toBe('NOT_INITIATED');
        expect((await row(journey.id)).approval_status).not.toBe('APPROVED');
        await quotations.replace(fx.companyId, journey.id, changed, maker);
        expect(
          await db.query(
            `SELECT id FROM quotation_status_history WHERE quotation_id=$1 AND transition_type='PREMIUM_CHANGED_RESET'`,
            [journey.id],
          ),
        ).toHaveLength(1);
      },
    );

    it(
      (fleet ? 'Fleet' : 'Single Motor') +
        ': refuses a premium change when payment arrives during edit preparation',
      async () => {
        const journey = await prepare(fleet);
        const before = await quotations.getAuthoritativePayload(
          fx.companyId,
          journey.id,
        );
        const service = quotations as any;
        const original = service.assertPremiumMayChange.bind(service);
        jest
          .spyOn(service, 'assertPremiumMayChange')
          .mockImplementationOnce(async (...args: any[]) => {
            const result = await original(...args);
            await pay(journey.invoice);
            return result;
          });
        await expect(
          quotations.replace(
            fx.companyId,
            journey.id,
            changePremium(journey.body, fleet),
            maker,
          ),
        ).rejects.toMatchObject({
          response: expect.objectContaining({
            code: 'QUOTATION_PREMIUM_LOCKED_BY_PAYMENT',
          }),
        });
        expect((await row(journey.id)).payment_status).toBe('PAID');
        const after = await quotations.getAuthoritativePayload(
          fx.companyId,
          journey.id,
        );
        expect(after.cover_note_dtl).toEqual(before.cover_note_dtl);
        expect((await latestInvoice(journey.id)).status).not.toBe('VOIDED');
      },
    );
  }
});
