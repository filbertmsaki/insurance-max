import type { fixtureBank } from './finance-bank-observation-fixture';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { ReinsuranceRecoveryService } from '../../src/modules/tenant/reinsurance/services/reinsurance-recovery.service';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { FinanceJournalService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal.service';
import { CommissionTransaction } from '../../src/modules/tenant/finance/payables/commission-payables/entities/commission-transaction.entity';
import { CommissionAccrualStatus } from '@insurance-max/contracts';

export async function exerciseNativeJournals(f: {
  db: DataSource;
  bank: ReturnType<typeof fixtureBank>;
  journal: FinanceJournalService;
  cededRecoveries: ReinsuranceRecoveryService;
  company: string;
  invoice: string;
  branch: string;
  maker: string;
  checker: string;
  query: string;
  call: (user: string, path: string, body?: any) => Promise<any>;
  approve: (c: { id: string; hash: string }) => Promise<string>;
}) {
  const {
    db,
    journal,
    company,
    invoice,
    branch,
    maker,
    checker,
    query,
    call,
    approve,
  } = f;
  const postSource = async (id: string, kind: string) => {
    const queued = await call(
      checker,
      'foundation/operating-postings?' + query,
    );
    const [c] = queued.filter(
      (c: any) =>
        c.snapshot.sourceId === id &&
        (c.snapshot.originalSourceType ?? c.snapshot.eventType) === kind,
    );
    expect(c).toBeDefined();
    return approve({ id: c.candidateId, hash: c.hash });
  };
  const accrual = await db.transaction(async (m) => {
    const a = await m.getRepository(CommissionTransaction).save(
      m.getRepository(CommissionTransaction).create({
        company_id: company,
        insurer_company_id: company,
        intermediary_company_id: company,
        invoice_id: invoice,
        commission_type: 'INTERMEDIARY',
        calculation_base: 'QUOTATION_PREMIUM',
        commission_amount: '4.00',
        balance_amount: '4.00',
        status: CommissionAccrualStatus.ACCRUED,
        accrued_by: maker,
        accrued_at: new Date(),
        accrual_no: 'UAT-ACCRUAL',
      }),
    );
    await journal.postCommissionAccrual(m, a, 'source-commission-1', maker);
    return a;
  });
  await postSource(accrual.id, 'COMMISSION_ACCRUED');
  await call(checker, 'commission-accruals/' + accrual.id + '/approve', {
    idempotency_key: 'accrual-approved',
  });
  const payment = await call(maker, 'commission-payments', {
    intermediary_company_id: company,
    branch_id: branch,
    payment_method: 'CASH',
    payment_reference: 'UAT-COMMISSION',
    currency_code: 'TZS',
    amount: '4.00',
    allocations: [{ commission_transaction_id: accrual.id, amount: '4.00' }],
    idempotency_key: 'comm-pay-1',
  });
  await call(checker, 'commission-payments/' + payment.id + '/approve', {
    idempotency_key: 'comm-pay-approved',
  });
  await call(maker, 'commission-payments/' + payment.id + '/pay', {
    idempotency_key: 'comm-paid',
    settlement_observation: await f.bank.observe(
      'COMMISSION_PAYMENT',
      payment.id,
    ),
  });
  await postSource(payment.id, 'COMMISSION_PAYMENT_PAID');
  await call(maker, 'commission-payments/' + payment.id + '/reverse', {
    reason: 'Returned commission payment',
    idempotency_key: 'comm-return',
  });
  await postSource(payment.id, 'COMMISSION_PAYMENT');
  await call(maker, 'commission-accruals/' + accrual.id + '/reverse', {
    reason: 'Corrected commission calculation',
    idempotency_key: 'comm-reverse',
  });
  await postSource(accrual.id, 'COMMISSION_ACCRUAL');
  const settled = async (kind: string, no: string) => {
    const id = randomUUID();
    await db.transaction(async (m) => {
      await m.query(
        `INSERT INTO reinsurance_settlements(id,company_id,branch_id,counterparty_company_id,settlement_no,settlement_type,currency,gross_amount,net_amount,balance_amount,status,payment_method,submitted_by) VALUES($1,$2,$3,$2,$5,$6,'TZS',12.5,12.5,12.5,'SUBMITTED','CASH',$4)`,
        [id, company, branch, maker, no, kind],
      );
      await m.query(
        "UPDATE reinsurance_settlements SET status='APPROVED',approved_by=$2,approved_at=now() WHERE id=$1",
        [id, checker],
      );
      const [r] = await m.query(
        "WITH paid AS (UPDATE reinsurance_settlements SET status='PAID',paid_amount=net_amount,balance_amount=0,settled_by=$2,settled_at=now() WHERE id=$1 RETURNING *) SELECT * FROM paid",
        [id, checker],
      );
      await journal.postReinsuranceSettlement(
        m,
        {
          companyId: company,
          settlementId: id,
          settlementNo: r.settlement_no,
          counterpartyCompanyId: company,
          settlementType: r.settlement_type,
          amount: r.net_amount,
          currencyCode: r.currency,
          settlementAccountCode: r.settlement_account_code,
        },
        'reinsurance-settlement:' + id,
        maker,
      );
    });
    return postSource(id, 'REINSURANCE_SETTLEMENT_PAID');
  };
  await settled('PREMIUM', 'UAT-SETTLEMENT');
  const incoming = await settled('CLAIM_RECOVERY', 'UAT-INCOMING');
  const claim = randomUUID(),
    claimPayment = randomUUID(),
    disbursement = randomUUID(),
    recovery = randomUUID(),
    policy = randomUUID();
  const disb = {
    companyId: company,
    disbursementId: disbursement,
    disbursementNo: 'UAT-DISBURSE',
    customerId: null,
    amount: '8.00',
    currencyCode: 'TZS',
    settlementAccountCode: '1100',
  };
  await db.transaction(async (m) => {
    const [category] = await m.query(
      "INSERT INTO insurance_categories(company_id,code,name) VALUES($1,'UAT-CLAIM','Claim test category') RETURNING id",
      [company],
    );
    const [product] = await m.query(
      "INSERT INTO insurance_products(company_id,category_id,product_code,product_name) VALUES($1,$2,'UAT-CLAIM','Claim test product') RETURNING id",
      [company, category.id],
    );
    const [i] = await m.query(
      'SELECT customer_id FROM invoices WHERE company_id=$1 AND id=$2',
      [company, invoice],
    );
    await m.query(
      "INSERT INTO policies(id,company_id,insurer_company_id,customer_id,category_id,product_id,policy_no,channel_type,start_date,end_date,issue_date) VALUES($1,$2,$2,$3,$4,$5,'UAT-CLAIM-POLICY','BROKER',current_date,current_date+30,current_date)",
      [policy, company, i.customer_id, category.id, product.id],
    );
    await m.query(
      "INSERT INTO claims(id,company_id,insurer_company_id,policy_id,customer_id,branch_id,claim_no,claim_notification_number,cover_note_reference_number,claim_report_date,loss_date,loss_nature,loss_type,loss_location,description,currency_code) VALUES($1,$2,$2,$3,$4,$5,'UAT-CLM','UAT-NOTIFY','UAT-COVER',now(),now(),'Loss','Accident','Dar es Salaam','Claim acceptance fixture','TZS')",
      [claim, company, policy, i.customer_id, branch],
    );
    await m.query(
      "INSERT INTO claim_payments(id,company_id,claim_id,claim_payment_number,cover_note_reference_number,currency_code) VALUES($1,$2,$3,'UAT-CLMPAY','UAT-COVER','TZS')",
      [claimPayment, company, claim],
    );
    const [r] = await m.query(
      "INSERT INTO claim_disbursements(id,company_id,claim_id,claim_payment_id,disbursement_no,amount,currency_code,requested_by,idempotency_key,payment_method,status,confirmed_at) VALUES($1,$2,$3,$4,'UAT-DISBURSE',8,'TZS',$5,'uat-claim-disburse','CASH','PAID',now()) RETURNING *",
      [disbursement, company, claim, claimPayment, maker],
    );
    await journal.postClaimDisbursement(
      m,
      { ...disb, settlementAccountCode: r.settlement_account_code },
      'uat-disbursement:' + disbursement,
      maker,
    );
  });
  await postSource(disbursement, 'CLAIM_DISBURSEMENT_PAID');
  await db.transaction(async (m) => {
    await m.query(
      "UPDATE claim_disbursements SET status='REVERSED',updated_at=now() WHERE id=$1",
      [disbursement],
    );
    await journal.reverseClaimDisbursement(
      m,
      { ...disb, reason: 'Returned claim payout' },
      'uat-return:' + disbursement,
      maker,
    );
  });
  await postSource(disbursement, 'CLAIM_DISBURSEMENT');
  await db.query(
    "INSERT INTO claim_recoveries(id,company_id,claim_id,recovery_no,recovery_type,expected_amount) VALUES($1,$2,$3,'UAT-RECOVERY','SALVAGE',10)",
    [recovery, company, claim],
  );
  for (const amount of ['3.25', '6.75']) {
    const event = randomUUID();
    await db.transaction(async (m) => {
      await m.query(
        'UPDATE claim_recoveries SET received_amount=received_amount+$1 WHERE id=$2',
        [amount, recovery],
      );
      await m.query(
        "INSERT INTO claim_events(id,company_id,claim_id,event_type,actor_id,subject_type,subject_id,summary,metadata) VALUES($1,$2,$3,'RECOVERY_RECEIPT_RECORDED',$4,'CLAIM_RECOVERY',$5,'Salvage receipt',$6)",
        [event, company, claim, maker, recovery, { received_amount: amount }],
      );
      const args = {
        companyId: company,
        recoveryId: recovery,
        recoveryNo: 'UAT-RECOVERY',
        recoveryType: 'SALVAGE',
        amount,
        currencyCode: 'TZS',
      };
      const first = await journal.postClaimRecoveryReceipt(
        m,
        args,
        'recovery-receipt:' + event,
        maker,
      );
      expect(
        (
          await journal.postClaimRecoveryReceipt(
            m,
            args,
            'recovery-receipt:' + event,
            maker,
          )
        ).id,
      ).toBe(first.id);
    });
    await postSource(event, 'RECOVERY_RECEIPT_RECORDED');
  }
  const [sum] = await db.query(
    "SELECT sum(l.transaction_debit)::text debit,count(DISTINCT j.id)::int n FROM finance_operating_postings p JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE' JOIN finance_foundation_lines l ON l.journal_id=j.id WHERE p.company_id=$1 AND p.snapshot->>'aggregateId'=$2",
    [company, recovery],
  );
  expect(sum.n).toBe(2);
  expect(Number(sum.debit)).toBe(10);
  const [cession] = await db.query(
    "INSERT INTO policy_cessions(company_id,branch_id,policy_id,cession_no,cession_type,effective_from,effective_to,currency,gross_sum_insured,gross_premium,retention_amount,retained_premium,ceded_sum_insured,ceded_premium,ceded_share_percent) VALUES($1,$2,$3,'UAT-CESSION','TREATY',current_date,current_date+30,'TZS',100,10,50,5,50,5,50) RETURNING id",
    [company, branch, policy],
  );
  const [part] = await db.query(
    "INSERT INTO policy_cession_participants(company_id,cession_id,participant_company_id,participant_code,participation_date,premium_share,sum_insured_share,ceded_premium_share) VALUES($1,$2,$1,'UAT-P',now(),100,50,5) RETURNING id",
    [company, cession.id],
  );
  const [ceded] = await db.query(
    "INSERT INTO reinsurance_claim_recoveries(company_id,branch_id,claim_id,cession_id,cession_participant_id,participant_company_id,recovery_no,currency,gross_claim_amount,participant_share_percent,expected_recovery,admitted_recovery,outstanding_recovery,status) VALUES($1,$2,$3,$4,$5,$1,'UAT-CEDED','TZS',25,50,12.5,12.5,12.5,'ADMITTED') RETURNING id",
    [company, branch, claim, cession.id, part.id],
  );
  const cedant: Parameters<ReinsuranceRecoveryService['recordReceipt']>[0] = {
    id: maker,
    email: 'cedant@example.test',
    scope: 'company',
    userType: 'COMPANY_USER',
    sessionId: randomUUID(),
    accessTokenId: randomUUID(),
    authorizationVersion: 1,
    companyId: company,
    companyType: CompanyType.INSURANCE_COMPANY,
    roles: [],
    permissions: [],
  };
  await expect(
    f.cededRecoveries.recordReceipt(cedant, ceded.id, {
      amount: '12.50',
      settlement_no: 'UAT-SETTLEMENT',
    }),
  ).rejects.toThrow('posted incoming settlement');
  const input = { amount: '12.50', settlement_no: 'UAT-INCOMING' };
  const [one, two] = await Promise.all([
    f.cededRecoveries.recordReceipt(cedant, ceded.id, input),
    f.cededRecoveries.recordReceipt(cedant, ceded.id, input),
  ]);
  expect(one.receipt.id).toBe(two.receipt.id);
  expect(one.journalId).toBe(incoming);
  expect(
    await db.query(
      'SELECT amount FROM finance_gl_recovery_cash WHERE journal_id=$1',
      [incoming],
    ),
  ).toEqual([{ amount: '12.50' }]);
}
