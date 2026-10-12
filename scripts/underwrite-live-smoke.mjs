/**
 * Live underwrite smoke test (single-vehicle private motor) through the real
 * TIRAMIS path:
 *   portal → TIRAMIS gateway → mock TIRA (port 5050) → callback → gateway →
 *   portal webhook.
 *
 * Needs the portal, the gateway and mock TIRA running:
 *   npm run start:dev:tiramis
 *   npm run start:dev:insurance-portal-service
 *   (cd mock-tira && npm start)
 *
 * Run: node scripts/underwrite-live-smoke.mjs
 * It creates its own users, then takes one motor quotation through
 * draft → finalize → TIRA cover note → issued policy → endorsement (maker-
 * checker) → cancellation, waiting for TIRA's real callbacks at each step.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const argon2 = require('argon2');

const env = Object.fromEntries(
  readFileSync('apps/insurance-portal-service/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [
      line.slice(0, line.indexOf('=')),
      line.slice(line.indexOf('=') + 1),
    ]),
);

const API = `${process.env.PORTAL_URL || env.APP_URL || 'http://localhost:9090'}/api/v1`;
const PASSWORD = 'StrongPassword@2026';
const suffix = randomUUID().slice(0, 8);
const SUFFIX = suffix.toUpperCase();
const digits = randomUUID().replace(/\D/g, '').padEnd(12, '7');
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 120_000);
const PRODUCT_CODE = 'SP014001000000';

const db = new Client({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 5432),
  user: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE || env.DB_NAME,
});

const log = (message) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);

async function api(token, method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${method} ${path} → ${response.status}: ${JSON.stringify(json)}`,
    );
  }
  return json.data ?? json;
}

const motor = (token, method, path, body) =>
  api(token, method, `/tenant/underwrite/motor${path}`, body);

async function waitFor(label, check) {
  const deadline = Date.now() + TIMEOUT_MS;
  let last;
  while (Date.now() < deadline) {
    last = await check();
    if (last.done) {
      log(`  ✓ ${label}`);
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(
    `Timed out waiting for ${label} (last: ${JSON.stringify(last?.state)})`,
  );
}

/** Waits for a policy transaction (endorsement/cancellation) to be applied. */
async function waitForTransaction(token, kind, id) {
  return waitFor(`${kind} accepted by TIRA and applied`, async () => {
    const context = await motor(token, 'GET', `/${kind}s/${id}/context`);
    const { submission_status: submission, stage } = context.transaction;
    if (['FAILED', 'RETRYABLE', 'REJECTED'].includes(submission)) {
      throw new Error(
        `TIRA refused ${kind} ${id}: ${submission} ${JSON.stringify(context.transaction.last_error ?? context.transaction.submission_error ?? '')}`,
      );
    }
    return {
      done: submission === 'ACCEPTED' && stage === 'APPLIED',
      state: { submission, stage },
      context,
    };
  });
}

async function createUser(fx, label, roleName) {
  const email = `live.uw.${label.toLowerCase()}.${suffix}@example.com`;
  const user = await db.query(
    `INSERT INTO users (user_no, first_name, last_name, email, phone, password, status,
       user_type, officer_title, is_email_verified, is_phone_verified, is_two_factor_enabled)
     VALUES ($1, $2, 'Live', $3, $4, $5, 'active', 'STAFF', $6, true, true, false)
     RETURNING id`,
    [
      `USR-U${suffix}${label.slice(0, 2)}`,
      label,
      email,
      `+25578${randomUUID().replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
      await argon2.hash(PASSWORD, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      }),
      `Underwriting ${label}`,
    ],
  );
  const membership = await db.query(
    `INSERT INTO company_users (company_id, user_id, status, is_default, quotation_policy_data_scope)
     VALUES ($1, $2, 'active', true, 'COMPANY') RETURNING id`,
    [fx.companyId, user.rows[0].id],
  );
  const companyUserId = membership.rows[0].id;
  await db.query(
    `INSERT INTO branch_users (branch_id, company_user_id, is_primary, is_active_branch, activated_at)
     VALUES ($1, $2, true, true, now())`,
    [fx.branchId, companyUserId],
  );
  const role = await db.query(
    `INSERT INTO company_user_roles (company_user_id, role_id)
     SELECT $1, id FROM roles WHERE name = $2 AND company_id = $3 RETURNING role_id`,
    [companyUserId, roleName, fx.companyId],
  );
  if (!role.rows[0]) throw new Error(`Role ${roleName} is not seeded`);
  // Product and category access is deny-by-default.
  await db.query(
    `INSERT INTO user_product_access (company_id, company_user_id, product_id, can_view, can_create_policy, access_status, is_active)
     VALUES ($1, $2, $3, true, true, 'ALLOW', true)`,
    [fx.companyId, companyUserId, fx.productId],
  );
  await db.query(
    `INSERT INTO user_category_access (company_id, company_user_id, category_id, can_view, can_create_policy, access_status, is_active)
     VALUES ($1, $2, $3, true, true, 'ALLOW', true)`,
    [fx.companyId, companyUserId, fx.categoryId],
  );
  const login = await api(null, 'POST', '/auth/login', {
    email,
    password: PASSWORD,
  });
  return login.access_token ?? login.accessToken;
}

async function fixtures() {
  const company = await db.query(
    `SELECT DISTINCT c.id FROM companies c
       JOIN tiramis_company_configurations t ON t.company_id = c.id
      WHERE c.company_type = 'INSURANCE_COMPANY' LIMIT 1`,
  );
  if (!company.rows[0])
    throw new Error('No insurer with a TIRAMIS configuration');
  const companyId = company.rows[0].id;
  // A branch with a code and exactly one default active sale point.
  const branch = await db.query(
    `SELECT b.id FROM branches b
      WHERE b.company_id = $1 AND b.status = 'active' AND b.code IS NOT NULL
        AND (SELECT count(*) FROM tiramis_sale_points s
              WHERE s.branch_id = b.id AND s.is_default AND s.is_active AND s.deleted_at IS NULL) = 1
      ORDER BY b.created_at LIMIT 1`,
    [companyId],
  );
  if (!branch.rows[0]) throw new Error('No branch with a default sale point');
  const product = await db.query(
    `SELECT p.id, p.category_id, v.tiramis_product_code
       FROM insurance_products p
       JOIN insurance_product_versions v ON v.product_id = p.id AND v.status = 'PUBLISHED'
        AND v.review_status = 'APPROVED' AND v.is_submission_ready
        AND v.effective_from <= CURRENT_DATE AND (v.effective_to IS NULL OR v.effective_to >= CURRENT_DATE)
      WHERE p.company_id = $1 AND p.product_code = $2 AND p.is_active AND p.business_line = 'MOTOR'
      LIMIT 1`,
    [companyId, PRODUCT_CODE],
  );
  if (!product.rows[0])
    throw new Error(`Product ${PRODUCT_CODE} has no published version`);
  return {
    companyId,
    branchId: branch.rows[0].id,
    productId: product.rows[0].id,
    categoryId: product.rows[0].category_id,
    tiramisProductCode: product.rows[0].tiramis_product_code,
  };
}

/** TIRA timestamp in East Africa Time, YYYY-MM-DDTHH:mm:ss. */
function eat(date) {
  return new Date(date.getTime() + 3 * 3_600_000).toISOString().slice(0, 19);
}

function quotationBody(fx) {
  const start = new Date(Date.now() + 10 * 60_000);
  const end = new Date(start.getTime() + 364 * 86_400_000);
  return {
    internal_quotation: {
      insurer_company_id: fx.companyId,
      intermediary_company_id: null,
      department_id: null,
      category_id: fx.categoryId,
      product_id: fx.productId,
      sub_class_id: null,
      quotation_type: 'MOTOR',
      quotation_flow: 'MOTOR_SINGLE',
      channel_type: 'DIRECT',
      is_fleet: false,
    },
    cover_note_hdr: { cover_note_type: 1 },
    cover_note_dtl: {
      prev_cover_note_reference_number: null,
      cover_note_start_date: eat(start),
      cover_note_end_date: eat(end),
      cover_note_desc: 'Private motor comprehensive cover',
      operative_clause: 'Motor Comprehensive',
      payment_mode: 1,
      currency_code: 'TZS',
      exchange_rate: 1,
      total_premium_excluding_tax: 0,
      total_premium_including_tax: 0,
      commision_paid: 0,
      commision_rate: 0,
      product_code: fx.tiramisProductCode,
      endorsement_type: null,
      endorsement_reason: null,
      endorsement_premium_earned: null,
      risks_covered: [
        {
          risk_code: 'SP014001000001',
          sum_insured: 20_000_000,
          sum_insured_equivalent: 20_000_000,
          premium_rate: 0,
          premium_before_discount: 0,
          premium_after_discount: 0,
          premium_excluding_tax_equivalent: 0,
          premium_including_tax: 0,
          discounts_offered: [],
          taxes_charged: [],
        },
      ],
      subject_matters_covered: [
        {
          subject_matter_reference: `VEH-${suffix}`,
          subject_matter_desc: 'Toyota Harrier',
        },
      ],
      cover_note_addons: [],
      policy_holders: [
        {
          policy_holder_name: 'Baraka Mollel',
          policy_holder_birth_date: '1986-04-12',
          policy_holder_type: 1,
          policy_holder_id_number: `19860412${digits.slice(0, 12)}`,
          policy_holder_id_type: 1,
          gender: 'M',
          country_code: 'TZA',
          region: 'Dar es Salaam',
          district: 'Kinondoni',
          street: 'Kawawa Road',
          policy_holder_phone_number: `2557${digits.slice(0, 8)}`,
          policy_holder_fax: null,
          postal_address: 'P.O. Box 7',
          email_address: `baraka.${suffix}@example.com`,
        },
      ],
      motor_dtl: {
        motor_category: 1,
        motor_type: 1,
        registration_number: `T${digits.slice(0, 3)}${SUFFIX.replace(
          /[^A-Z]/g,
          'A',
        )
          .slice(0, 3)
          .padEnd(3, 'A')}`,
        chassis_number: `CH${SUFFIX}XX`,
        make: 'Toyota',
        model: 'Harrier',
        model_number: null,
        body_type: 'Station Wagon',
        color: 'White',
        engine_number: `EN${SUFFIX}`,
        engine_capacity: '2000',
        fuel_used: 'Petrol',
        number_of_axles: 2,
        axle_distance: 2.7,
        sitting_capacity: 5,
        year_of_manufacture: 2020,
        tare_weight: 1500,
        gross_weight: 2000,
        motor_usage: 1,
        owner_name: 'Baraka Mollel',
        owner_category: 1,
        owner_address: 'Kinondoni, Dar es Salaam',
      },
    },
  };
}

async function main() {
  await db.connect();
  const health = await fetch(`${API}/health`).catch(() => null);
  log(
    `Portal ${API} ${health?.ok ? 'is up' : 'health check did not answer (continuing)'}`,
  );

  const fx = await fixtures();
  const maker = await createUser(fx, 'Maker', 'USER');
  const checker = await createUser(fx, 'Checker', 'INSURANCE_ADMIN');
  log('Fixtures and users ready');

  // Quotation draft → finalize
  const draft = await motor(maker, 'POST', '/quotations/drafts', {
    category_id: fx.categoryId,
    product_id: fx.productId,
    quotation_type: 'MOTOR',
    quotation_flow: 'MOTOR_SINGLE',
    channel_type: 'DIRECT',
    is_fleet: false,
    draft_payload: {},
  });
  log(`Quotation ${draft.quotation_no} drafted`);
  const finalized = await motor(
    maker,
    'POST',
    `/quotations/${draft.id}/finalize`,
    quotationBody(fx),
  );
  if (
    !(
      finalized.status === 'READY_FOR_SUBMISSION' ||
      // Cash quotations wait for payment; submit generates and settles the
      // invoice (Require invoice settlement for cash quotations).
      (finalized.status === 'PENDING_REQUIREMENTS' &&
        finalized.payment_status === 'NOT_INITIATED')
    )
  ) {
    throw new Error(
      `Finalize left status ${finalized.status} (approval ${finalized.approval_status}, payment ${finalized.payment_status})`,
    );
  }
  const premium =
    finalized.cover_note_dtl?.total_premium_including_tax ??
    finalized.total_premium_including_tax;
  log(`  ✓ finalized, premium incl. tax TZS ${premium ?? '?'}`);

  // TIRA cover note → issued policy
  await api(maker, 'POST', `/tenant/quotations/${draft.id}/submit`, {});
  await waitFor('quotation accepted by TIRA', async () => {
    const quotation = await motor(maker, 'GET', `/quotations/${draft.id}`);
    if (['FAILED', 'REJECTED'].includes(quotation.tira_status)) {
      throw new Error(
        `TIRA refused quotation: ${quotation.tira_response_code} ${quotation.tira_response_description}`,
      );
    }
    return {
      done: quotation.tira_status === 'SUCCESS',
      state: { status: quotation.status, tira: quotation.tira_status },
    };
  });
  const issued = await waitFor('policy issued', async () => {
    const policy = await db.query(
      `SELECT id, policy_no, policy_status, cover_note_no, tira_status
         FROM policies WHERE quotation_id = $1`,
      [draft.id],
    );
    const row = policy.rows[0];
    return { done: row?.tira_status === 'SUCCESS', state: row, policy: row };
  });
  const policyId = issued.policy.id;
  const policy = await motor(maker, 'GET', `/policies/${policyId}`);
  log(
    `  Policy ${policy.policy_no ?? issued.policy.policy_no}, cover note ${issued.policy.cover_note_no}`,
  );

  // Endorsement (maker creates, checker approves; approve auto-submits to TIRA)
  const today = new Date().toISOString().slice(0, 10);
  const eligibility = await motor(
    maker,
    'GET',
    `/policies/${policyId}/endorsement-eligibility?effective_date=${today}`,
  );
  if (!eligibility.eligible) {
    throw new Error(
      `Policy not eligible for endorsement: ${JSON.stringify(eligibility.blockers)}`,
    );
  }
  const endorsement = await motor(
    maker,
    'POST',
    `/policies/${policyId}/endorsements`,
    {
      effective_date: today,
      endorsement_type_code: 'RISK_CORRECTION',
      reason: 'Vehicle colour recorded incorrectly',
      idempotency_key: `uw-end-${suffix}`,
    },
  );
  await motor(maker, 'POST', `/endorsements/${endorsement.id}/changes`, {
    category: 'ASSET',
    operation: 'MODIFY',
    field_path: 'entries.0.motor.color',
    new_value: 'Blue',
  });
  await motor(maker, 'POST', `/endorsements/${endorsement.id}/complete`, {});
  log(`Endorsement ${endorsement.transaction_no} completed by maker`);
  const context = await motor(
    maker,
    'GET',
    `/endorsements/${endorsement.id}/context`,
  );
  if (context.transaction.approval_required) {
    if (context.transaction.approval_status !== 'PENDING') {
      await motor(
        checker,
        'POST',
        `/endorsements/${endorsement.id}/submit-approval`,
        {},
      );
    }
    // Maker-checker: the maker must not be able to approve their own change.
    const selfApproval = await motor(
      maker,
      'POST',
      `/endorsements/${endorsement.id}/approve`,
      {},
    ).then(
      () => 'allowed',
      (error) => error.message,
    );
    if (selfApproval === 'allowed')
      throw new Error('Maker approved their own endorsement');
    log(`  ✓ maker blocked from self-approval (${selfApproval.split(':')[0]})`);
    await motor(checker, 'POST', `/endorsements/${endorsement.id}/approve`, {});
    log('  ✓ checker approved');
  }
  const afterApprove = await motor(
    checker,
    'GET',
    `/endorsements/${endorsement.id}/context`,
  );
  if (
    ['READY', 'FAILED', 'RETRYABLE', 'NOT_SUBMITTED'].includes(
      afterApprove.transaction.submission_status,
    )
  ) {
    await motor(
      checker,
      'POST',
      `/endorsements/${endorsement.id}/submit-tiramis`,
      {},
    );
  }
  const applied = await waitForTransaction(
    checker,
    'endorsement',
    endorsement.id,
  );
  log(
    `  Replacement cover note ${applied.context.endorsement?.replacement_cover_note_reference ?? '(none)'}`,
  );

  // Cancellation (maker creates, checker approves)
  const cancellation = await motor(
    maker,
    'POST',
    `/policies/${policyId}/cancellations`,
    {
      effective_date: today,
      reason_type: 'CUSTOMER_REQUEST',
      reason: 'Vehicle sold by the policyholder',
      idempotency_key: `uw-can-${suffix}`,
    },
  );
  await motor(maker, 'POST', `/cancellations/${cancellation.id}/complete`, {});
  log(`Cancellation ${cancellation.transaction_no} completed by maker`);
  const cancelContext = await motor(
    checker,
    'GET',
    `/cancellations/${cancellation.id}/context`,
  );
  if (cancelContext.transaction.approval_status === 'PENDING') {
    await motor(
      checker,
      'POST',
      `/cancellations/${cancellation.id}/approve`,
      {},
    );
    log('  ✓ checker approved');
  }
  const afterCancelApprove = await motor(
    checker,
    'GET',
    `/cancellations/${cancellation.id}/context`,
  );
  if (
    ['READY', 'FAILED', 'RETRYABLE', 'NOT_SUBMITTED'].includes(
      afterCancelApprove.transaction.submission_status,
    )
  ) {
    await motor(
      checker,
      'POST',
      `/cancellations/${cancellation.id}/submit-tiramis`,
      {},
    );
  }
  await waitForTransaction(checker, 'cancellation', cancellation.id);
  const final = await db.query(
    `SELECT policy_status FROM policies WHERE id = $1`,
    [policyId],
  );
  if (final.rows[0].policy_status !== 'CANCELLED') {
    throw new Error(`Policy ended ${final.rows[0].policy_status}`);
  }

  log(
    `PASS: quotation ${draft.quotation_no} issued, endorsed and cancelled through the real gateway and mock TIRA`,
  );
}

main()
  .catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.end());
