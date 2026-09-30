/**
 * Live claims smoke test through the real TIRAMIS path:
 *   portal (APP_URL) → TIRAMIS gateway → mock TIRA (port 5050) → callback →
 *   gateway → portal webhook.
 *
 * Needs the portal, the gateway and mock TIRA running:
 *   npm run start:dev:tiramis
 *   npm run start:dev:insurance-portal-service
 *   (cd mock-tira && npm start)
 *
 * Run: node scripts/claims-live-smoke.mjs
 * It creates its own customer, policy and users, then takes one claim from
 * notification to settlement, waiting for TIRA's real callbacks at each step.
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
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 90_000);

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

const claims = (token, method, path, body) =>
  api(token, method, `/tenant/claims${path}`, body);

/** Waits until TIRA's callback has moved the claim (or a record) on. */
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

async function waitForStatus(token, claimId, status) {
  return waitFor(`claim is ${status}`, async () => {
    const claim = await claims(token, 'GET', `/${claimId}`);
    return { done: claim.status === status, state: claim.status, claim };
  });
}

async function waitForOperation(token, claimId, recordId) {
  return waitFor(`TIRA accepted ${recordId.slice(0, 8)}`, async () => {
    const claim = await claims(token, 'GET', `/${claimId}`);
    const operation = [...claim.regulatory_operations]
      .reverse()
      .find((item) => item.source_record_id === recordId);
    if (['REJECTED', 'FAILED'].includes(operation?.status)) {
      throw new Error(
        `TIRA refused ${recordId}: ${operation.final_response_code} ${operation.final_response_message}`,
      );
    }
    return {
      done: operation?.status === 'ACCEPTED',
      state: operation?.status,
      claim,
    };
  });
}

async function createUser(companyId, branchId, label, roleName) {
  const email = `live.${label.toLowerCase()}.${suffix}@example.com`;
  const user = await db.query(
    `INSERT INTO users (user_no, first_name, last_name, email, phone, password, status,
       user_type, officer_title, is_email_verified, is_phone_verified, is_two_factor_enabled)
     VALUES ($1, $2, 'Live', $3, $4, $5, 'active', 'STAFF', $6, true, true, false)
     RETURNING id`,
    [
      `USR-L${suffix}${label.slice(0, 2)}`,
      label,
      email,
      `+25575${randomUUID().replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
      await argon2.hash(PASSWORD, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      }),
      `Claims ${label}`,
    ],
  );
  const membership = await db.query(
    `INSERT INTO company_users (company_id, user_id, status, is_default, quotation_policy_data_scope)
     VALUES ($1, $2, 'active', true, 'COMPANY') RETURNING id`,
    [companyId, user.rows[0].id],
  );
  await db.query(
    `INSERT INTO branch_users (branch_id, company_user_id, is_primary, is_active_branch, activated_at)
     VALUES ($1, $2, true, true, now())`,
    [branchId, membership.rows[0].id],
  );
  await db.query(
    `INSERT INTO company_user_roles (company_user_id, role_id)
     SELECT $1, id FROM roles WHERE name = $2 AND company_id = $3`,
    [membership.rows[0].id, roleName, companyId],
  );
  const login = await api(null, 'POST', '/auth/login', {
    email,
    password: PASSWORD,
  });
  return login.access_token ?? login.accessToken;
}

async function fixtures() {
  // The insurer with an active TIRAMIS configuration (seeded: Alliance).
  const company = await db.query(
    `SELECT DISTINCT c.id FROM companies c
       JOIN tiramis_company_configurations t ON t.company_id = c.id
       JOIN roles r ON r.company_id = c.id AND r.name = 'CLAIMS_OFFICER'
      WHERE c.company_type = 'INSURANCE_COMPANY' LIMIT 1`,
  );
  if (!company.rows[0])
    throw new Error('No insurer with a TIRAMIS configuration');
  const companyId = company.rows[0].id;
  const branch = await db.query(
    `SELECT id FROM branches WHERE company_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1`,
    [companyId],
  );
  const branchId = branch.rows[0].id;
  const product = await db.query(
    `SELECT id, category_id FROM insurance_products LIMIT 1`,
  );
  const customer = await db.query(
    `INSERT INTO customers (company_id, customer_no, customer_type, first_name, last_name,
       phone, country_code, region, district, status)
     VALUES ($1, $2, 'INDIVIDUAL', 'Neema', 'Mushi', $3, 'TZA', 'Dar es Salaam', 'Ilala', 'ACTIVE')
     RETURNING id`,
    [
      companyId,
      `CUST-LIVE-${suffix}`,
      `+25576${suffix.replace(/\D/g, '1').slice(0, 7).padEnd(7, '1')}`,
    ],
  );
  const day = 86_400_000;
  const iso = (date) => date.toISOString().slice(0, 10);
  const start = iso(new Date(Date.now() - 30 * day));
  const end = iso(new Date(Date.now() + 335 * day));
  const policy = await db.query(
    `INSERT INTO policies (company_id, insurer_company_id, customer_id, category_id, product_id,
       policy_no, channel_type, policy_status, start_date, end_date, issue_date, cover_note_no,
       branch_id, currency)
     VALUES ($1, $1, $2, $3, $4, $5, 'DIRECT', 'ACTIVE', $6, $7, $6, $8, $9, 'TZS')
     RETURNING id`,
    [
      companyId,
      customer.rows[0].id,
      product.rows[0].category_id,
      product.rows[0].id,
      `POL-LIVE-${suffix}`,
      start,
      end,
      `CN-LIVE-${suffix}`,
      branchId,
    ],
  );
  await db.query(
    `INSERT INTO policy_versions (company_id, policy_id, version_number, version_type, status,
       effective_from, effective_to, policy_snapshot, policy_snapshot_hash, pricing_snapshot,
       pricing_result_hash, customer_snapshot, customer_snapshot_hash, asset_manifest, asset_manifest_hash)
     VALUES ($1, $2, 1, 'NEW_BUSINESS', 'ACTIVE', $3, $4, '{}', 'live', '{}', 'live', '{}', 'live', '{}', 'live')`,
    [companyId, policy.rows[0].id, start, end],
  );
  return { companyId, branchId, policyId: policy.rows[0].id };
}

async function main() {
  await db.connect();
  const health = await fetch(
    `${API.replace(/\/api\/v1$/, '')}/api/v1/health`,
  ).catch(() => null);
  log(
    `Portal ${API} ${health?.ok ? 'is up' : 'health check did not answer (continuing)'}`,
  );

  const { companyId, branchId, policyId } = await fixtures();
  const officer = await createUser(
    companyId,
    branchId,
    'Officer',
    'CLAIMS_OFFICER',
  );
  const manager = await createUser(
    companyId,
    branchId,
    'Manager',
    'CLAIMS_MANAGER',
  );
  const assessor = await createUser(
    companyId,
    branchId,
    'Assessor',
    'CLAIMS_ASSESSOR',
  );
  const finance = await createUser(
    companyId,
    branchId,
    'Finance',
    'CLAIMS_FINANCE',
  );
  log('Fixtures and users ready');

  // §9 Notification
  const claim = await claims(officer, 'POST', '', {
    policy_id: policyId,
    loss_date: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    claim_report_date: new Date(Date.now() - 86_400_000).toISOString(),
    loss_nature: 'Collision',
    loss_type: 'Own damage',
    loss_location: 'Bagamoyo Road, Dar es Salaam',
    description: 'Side impact at a junction.',
    estimated_amount: '1500000.00',
    claim_form_dully_filled: true,
    claimants: [
      {
        claimant_type: 'POLICYHOLDER',
        is_primary: true,
        full_name: 'Neema Mushi',
        claimant_category: 1,
        party_type: 1,
        id_type: 1,
        identification_number: `1985020211111000${suffix.replace(/\D/g, '2').slice(0, 4)}`,
        birth_date: '1985-02-02',
        gender: 'F',
        country_code: 'TZA',
        region: 'Dar es Salaam',
        district: 'Ilala',
        street: 'Uhuru Street',
        phone: '255714000000',
        postal_address: 'P.O. Box 2',
        email: `neema.${suffix}@example.com`,
      },
    ],
  });
  log(`Claim ${claim.claim_no} created`);
  await claims(officer, 'POST', `/${claim.id}/notification/submit`, {});
  const notified = await waitForStatus(
    officer,
    claim.id,
    'NOTIFICATION_ACCEPTED',
  );
  log(`  TIRA claim reference ${notified.claim.claim_reference_number}`);

  // §10 Intimation
  const intimation = await claims(officer, 'POST', `/${claim.id}/intimations`, {
    claim_estimated_amount: '1500000.00',
    claim_reserve_amount: '1200000.00',
    claim_reserve_method: 'Case estimate',
    loss_assessment_option: 1,
    assessor_name: 'Kilimanjaro Assessors Ltd',
    assessor_id_number: '100-200-301',
    assessor_id_type: 6,
  });
  await claims(officer, 'POST', `/intimations/${intimation.id}/submit`, {});
  await waitForStatus(officer, claim.id, 'INTIMATED');

  // §11 Assessment
  const assessment = await claims(
    assessor,
    'POST',
    `/${claim.id}/assessments`,
    {
      assessment_received_date: new Date().toISOString(),
      assessment_report_summary: 'Driver door and B-pillar repaired.',
      assessment_amount: '1100000.00',
      approved_claim_amount: '1000000.00',
      assessor_name: 'Kilimanjaro Assessors Ltd',
    },
  );
  await claims(assessor, 'POST', `/assessments/${assessment.id}/submit`);
  await claims(manager, 'POST', `/assessments/${assessment.id}/approve`, {
    comments: 'Agreed',
  });
  await waitForOperation(officer, claim.id, assessment.id);

  // §12 Discharge voucher
  const detail = await claims(officer, 'GET', `/${claim.id}`);
  const voucher = await claims(
    officer,
    'POST',
    `/${claim.id}/discharge-vouchers`,
    {
      claim_offer_amount: '1000000.00',
      claimant_id: detail.claimants[0].id,
    },
  );
  await claims(officer, 'POST', `/discharge-vouchers/${voucher.id}/submit`);
  await claims(
    manager,
    'POST',
    `/discharge-vouchers/${voucher.id}/approve`,
    {},
  );
  await claims(officer, 'POST', `/discharge-vouchers/${voucher.id}/respond`, {
    response: 'ACCEPT',
    claimant_response_date: new Date().toISOString(),
  });
  await waitForStatus(officer, claim.id, 'DISCHARGE_ACCEPTED');

  // §13 Payment and settlement
  const payment = await claims(officer, 'POST', `/${claim.id}/payments`, {
    paid_amount: '1000000.00',
    payment_mode: 3,
    claimant_id: detail.claimants[0].id,
    payee_type: 'CLAIMANT',
    payee_bank_details: {
      bank_name: 'NMB',
      account_name: 'Neema Mushi',
      account_number: '20110012345',
    },
    parties_notified: 'Y',
    claim_resulted_litigation: false,
  });
  await claims(officer, 'POST', `/payments/${payment.id}/submit`);
  await claims(manager, 'POST', `/payments/${payment.id}/approve`, {});
  const disbursement = await claims(
    finance,
    'POST',
    `/payments/${payment.id}/request-disbursement`,
    {
      idempotency_key: `claim-payment:${payment.id}:1`,
    },
  );
  await claims(finance, 'POST', `/disbursements/${disbursement.id}/confirm`, {
    payment_method: 'EFT / bank transfer',
    provider_reference: `FT-LIVE-${suffix}`,
  });
  await waitForStatus(officer, claim.id, 'SETTLED');

  log(
    `PASS: claim ${claim.claim_no} settled through the real gateway and mock TIRA`,
  );
}

main()
  .catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.end());
