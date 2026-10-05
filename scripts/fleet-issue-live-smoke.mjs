/**
 * Live smoke test for issuing a two-vehicle motor fleet through:
 * portal -> TIRAMIS gateway -> mock TIRA -> callback -> portal.
 *
 * Needs:
 *   npm run start:dev:tiramis
 *   npm run start:dev:insurance-portal-service
 *   (cd mock-tira && npm start)
 *
 * Run: npm run smoke:fleet-issue-live
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
const SUFFIX = suffix.toUpperCase().replace(/[^A-Z0-9]/g, 'A');
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 180_000);
const PRODUCT_CODE = process.env.SMOKE_FLEET_PRODUCT_CODE || 'SP014001000000';

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
      `${method} ${path} -> ${response.status}: ${JSON.stringify(json)}`,
    );
  }
  return json.data ?? json;
}

const fleet = (token, method, path, body) =>
  api(token, method, `/tenant/underwrite/fleet${path}`, body);

async function waitFor(label, check) {
  const deadline = Date.now() + TIMEOUT_MS;
  let last;
  while (Date.now() < deadline) {
    last = await check();
    if (last.done) {
      log(`ok: ${label}`);
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(
    `Timed out waiting for ${label} (last: ${JSON.stringify(last?.state)})`,
  );
}

async function fixtures() {
  const company = await db.query(
    `SELECT DISTINCT c.id FROM companies c
       JOIN tiramis_company_configurations t ON t.company_id = c.id
      WHERE c.company_type = 'INSURANCE_COMPANY' LIMIT 1`,
  );
  if (!company.rows[0]) throw new Error('No insurer with TIRAMIS config');
  const companyId = company.rows[0].id;

  const branch = await db.query(
    `SELECT b.id, s.sale_point_code FROM branches b
       JOIN tiramis_sale_points s ON s.branch_id = b.id
      WHERE b.company_id = $1 AND b.status = 'active' AND b.code IS NOT NULL
        AND s.is_default AND s.is_active AND s.deleted_at IS NULL
      ORDER BY b.created_at LIMIT 1`,
    [companyId],
  );
  if (!branch.rows[0]) throw new Error('No branch with default sale point');

  const product = await db.query(
    `SELECT p.id, p.category_id, p.supports_fleet, v.tiramis_product_code
       FROM insurance_products p
       JOIN insurance_product_versions v ON v.product_id = p.id
        AND v.status = 'PUBLISHED' AND v.review_status = 'APPROVED'
        AND v.is_submission_ready
        AND v.effective_from <= CURRENT_DATE
        AND (v.effective_to IS NULL OR v.effective_to >= CURRENT_DATE)
      WHERE p.company_id = $1 AND p.product_code = $2
        AND p.is_active AND p.business_line = 'MOTOR'
      LIMIT 1`,
    [companyId, PRODUCT_CODE],
  );
  if (!product.rows[0]) throw new Error(`Product ${PRODUCT_CODE} missing`);
  if (!product.rows[0].supports_fleet) {
    throw new Error(`Product ${PRODUCT_CODE} does not support fleet`);
  }

  return {
    companyId,
    branchId: branch.rows[0].id,
    salePointCode: branch.rows[0].sale_point_code,
    productId: product.rows[0].id,
    categoryId: product.rows[0].category_id,
    tiramisProductCode: product.rows[0].tiramis_product_code,
  };
}

async function createUser(fx) {
  const email = `fleet.issue.${suffix}@example.com`;
  const user = await db.query(
    `INSERT INTO users (user_no, first_name, last_name, email, phone, password, status,
       user_type, officer_title, is_email_verified, is_phone_verified, is_two_factor_enabled)
     VALUES ($1, 'Fleet', 'Issuer', $2, $3, $4, 'active', 'STAFF', 'Underwriter', true, true, false)
     RETURNING id`,
    [
      `USR-FI${suffix}`,
      email,
      `+25576${randomUUID().replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
      await argon2.hash(PASSWORD, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      }),
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
  await db.query(
    `INSERT INTO company_user_roles (company_user_id, role_id)
     SELECT $1, id FROM roles
      WHERE name = 'INSURANCE_ADMIN' AND company_id = $2 LIMIT 1`,
    [companyUserId, fx.companyId],
  );
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

function eat(date) {
  return new Date(date.getTime() + 3 * 3_600_000).toISOString().slice(0, 19);
}

function risk(sumInsured) {
  return {
    risk_code: 'SP014001000001',
    sum_insured: sumInsured,
    sum_insured_equivalent: sumInsured,
    premium_rate: 0,
    premium_before_discount: 0,
    premium_after_discount: 0,
    premium_excluding_tax_equivalent: 0,
    premium_including_tax: 0,
    discounts_offered: [],
    taxes_charged: [],
  };
}

function motor(entry) {
  return {
    motor_category: 1,
    motor_type: 1,
    registration_number: `T${SUFFIX.slice(0, 3)}F${entry}`,
    chassis_number: `CHF${SUFFIX}${entry}`,
    make: 'Toyota',
    model: entry === 1 ? 'Hiace' : 'Coaster',
    model_number: entry === 1 ? 'KDH200' : 'HZB50',
    body_type: 'Minibus',
    color: entry === 1 ? 'White' : 'Silver',
    engine_number: `ENF${SUFFIX}${entry}`,
    engine_capacity: '2800',
    fuel_used: 'Diesel',
    number_of_axles: 2,
    axle_distance: 2.6,
    sitting_capacity: entry === 1 ? 14 : 26,
    year_of_manufacture: 2021,
    tare_weight: 2000,
    gross_weight: 3200,
    motor_usage: 2,
    owner_name: 'Fleet Smoke Ltd',
    owner_category: 2,
    owner_address: 'Dar es Salaam',
  };
}

function fleetBody(fx) {
  const start = new Date(Date.now() + 10 * 60_000);
  const end = new Date(start.getTime() + 364 * 86_400_000);
  const holder = {
    policy_holder_name: 'Fleet Smoke Ltd',
    policy_holder_birth_date: '2005-01-01',
    policy_holder_type: 2,
    policy_holder_id_number: `TIN${SUFFIX}`,
    policy_holder_id_type: 6,
    gender: null,
    country_code: 'TZA',
    region: 'Dar es Salaam',
    district: 'Ilala',
    street: 'Samora Avenue',
    policy_holder_phone_number: `25576${randomUUID().replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
    policy_holder_fax: null,
    postal_address: 'P.O. Box 99',
    email_address: `fleet.${suffix}@example.com`,
  };

  return {
    internal_quotation: {
      insurer_company_id: fx.companyId,
      intermediary_company_id: null,
      department_id: null,
      category_id: fx.categoryId,
      product_id: fx.productId,
      sub_class_id: null,
      quotation_type: 'MOTOR',
      quotation_flow: 'MOTOR_FLEET',
      channel_type: 'DIRECT',
      is_fleet: true,
    },
    cover_note_hdr: { cover_note_type: 1 },
    cover_note_dtl: {
      fleet_hdr: {
        fleet_id: `FLT-${SUFFIX}`,
        fleet_type: 1,
        fleet_size: 2,
        comprehensive_insured: 2,
        sale_point_code: fx.salePointCode,
        cover_note_start_date: eat(start),
        cover_note_end_date: eat(end),
        payment_mode: 1,
        currency_code: 'TZS',
        exchange_rate: 1,
        total_premium_excluding_tax: 0,
        total_premium_including_tax: 0,
        commision_paid: 0,
        commision_rate: 0,
        officer_name: 'Fleet Issuer',
        officer_title: 'Underwriter',
        product_code: fx.tiramisProductCode,
        policy_holders: [holder],
      },
      fleet_dtls: [1, 2].map((entry) => ({
        fleet_entry: entry,
        prev_cover_note_reference_number: null,
        cover_note_desc: `Fleet vehicle ${entry} comprehensive cover`,
        operative_clause: 'Motor Fleet Comprehensive',
        endorsement_type: null,
        endorsement_reason: null,
        endorsement_premium_earned: null,
        risks_covered: [risk(entry === 1 ? 30_000_000 : 45_000_000)],
        subject_matters_covered: [
          {
            subject_matter_reference: `FLT-${SUFFIX}-${entry}`,
            subject_matter_desc: entry === 1 ? 'Toyota Hiace' : 'Toyota Coaster',
          },
        ],
        cover_note_addons: [],
        motor_dtl: motor(entry),
      })),
    },
  };
}

async function main() {
  await db.connect();
  const fx = await fixtures();
  const token = await createUser(fx);
  log('Fixtures and user ready');

  const draft = await fleet(token, 'POST', '/quotations/drafts', {
    category_id: fx.categoryId,
    product_id: fx.productId,
    quotation_type: 'MOTOR',
    quotation_flow: 'MOTOR_FLEET',
    channel_type: 'DIRECT',
    is_fleet: true,
    draft_payload: {},
  });
  log(`Fleet quotation ${draft.quotation_no} drafted`);

  const finalized = await fleet(
    token,
    'POST',
    `/quotations/${draft.id}/finalize`,
    fleetBody(fx),
  );
  if (finalized.status !== 'READY_FOR_SUBMISSION') {
    throw new Error(`Finalize left status ${finalized.status}`);
  }
  log('ok: finalized');

  await api(token, 'POST', `/tenant/quotations/${draft.id}/submit`, {});
  await waitFor('fleet quotation accepted by TIRA', async () => {
    const quotation = await db.query(
      `SELECT quotation_status, tira_status, tira_response_code, tira_response_description
         FROM quotations WHERE id = $1`,
      [draft.id],
    );
    const row = quotation.rows[0];
    if (['FAILED', 'REJECTED'].includes(row?.tira_status)) {
      throw new Error(
        `TIRA refused fleet quotation: ${row.tira_response_code} ${row.tira_response_description}`,
      );
    }
    return { done: row?.tira_status === 'SUCCESS', state: row };
  });

  const issued = await waitFor('fleet policy issued from callback', async () => {
    const policy = await db.query(
      `SELECT id, policy_no, cover_note_no FROM policies
        WHERE quotation_id = $1 AND policy_status = 'ACTIVE'
        ORDER BY created_at DESC LIMIT 1`,
      [draft.id],
    );
    return {
      done: Boolean(policy.rows[0]),
      state: policy.rows[0],
      policy: policy.rows[0],
    };
  });
  const notes = await db.query(
    `SELECT fleet_entry, cover_note_reference_number, sticker_number
       FROM cover_notes WHERE policy_id = $1 AND deleted_at IS NULL
      ORDER BY fleet_entry`,
    [issued.policy.id],
  );
  if (
    notes.rows.length < 2 ||
    notes.rows.some((row) => !row.cover_note_reference_number)
  ) {
    throw new Error(
      `Expected fleet cover-note references for 2 entries, got ${JSON.stringify(notes.rows)}`,
    );
  }
  log(
    `PASS: fleet quotation ${draft.quotation_no} issued as ${issued.policy.policy_no}; entries ${notes.rows
      .map((row) => `${row.fleet_entry}:${row.cover_note_reference_number}`)
      .join(', ')}`,
  );
}

main()
  .catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.end());
