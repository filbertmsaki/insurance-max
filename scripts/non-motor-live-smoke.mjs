/**
 * Live non-motor cover-note smoke through:
 * portal -> TIRAMIS gateway -> mock TIRA -> callback -> portal notification.
 *
 * Run: npm run smoke:non-motor-live
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
const PRODUCT_CODE = process.env.SMOKE_NON_MOTOR_PRODUCT_CODE || null;

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

const nonMotor = (token, method, path, body) =>
  api(token, method, `/tenant/underwrite/non-motor${path}`, body);

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
    `SELECT p.id, p.category_id, p.product_code, v.tiramis_product_code,
            r.id AS risk_id, r.risk_code, r.sub_class_id
       FROM insurance_products p
       JOIN insurance_product_versions v ON v.product_id = p.id
        AND v.status = 'PUBLISHED' AND v.review_status = 'APPROVED'
        AND v.is_submission_ready
        AND v.effective_from <= CURRENT_DATE
        AND (v.effective_to IS NULL OR v.effective_to >= CURRENT_DATE)
       JOIN insurance_risks r ON r.product_id = p.id
        AND r.is_active AND r.deleted_at IS NULL
      JOIN risk_rating_rules rule ON rule.risk_id = r.id
        AND rule.company_id = p.company_id
        AND rule.is_active
        AND rule.deleted_at IS NULL
      LEFT JOIN pricing_rate_books book ON book.id = rule.rate_book_id
      WHERE p.company_id = $1
        AND p.is_active
        AND p.business_line = 'NON_MOTOR'
        AND ($2::text IS NULL OR p.product_code = $2)
        AND (rule.rate_book_id IS NULL OR (
          book.status = 'PUBLISHED'
          AND book.effective_from <= CURRENT_DATE
          AND (book.effective_to IS NULL OR book.effective_to >= CURRENT_DATE)
        ))
        AND NOT EXISTS (
          SELECT 1
            FROM risk_required_factors factor
           WHERE factor.company_id = p.company_id
             AND factor.risk_id = r.id
             AND factor.is_required
             AND (factor.rate_book_id IS NULL OR factor.rate_book_id = rule.rate_book_id)
        )
      ORDER BY (r.sub_class_id IS NULL) DESC, p.product_code, r.risk_code
      LIMIT 1`,
    [companyId, PRODUCT_CODE],
  );
  if (!product.rows[0]) {
    throw new Error('No published non-motor product with an active risk');
  }

  return {
    companyId,
    branchId: branch.rows[0].id,
    salePointCode: branch.rows[0].sale_point_code,
    productId: product.rows[0].id,
    productCode: product.rows[0].product_code,
    categoryId: product.rows[0].category_id,
    tiramisProductCode: product.rows[0].tiramis_product_code,
    riskId: product.rows[0].risk_id,
    riskCode: product.rows[0].risk_code,
    subClassId: product.rows[0].sub_class_id,
  };
}

async function createUser(fx) {
  const email = `nonmotor.smoke.${suffix}@example.com`;
  const user = await db.query(
    `INSERT INTO users (user_no, first_name, last_name, email, phone, password, status,
       user_type, officer_title, is_email_verified, is_phone_verified, is_two_factor_enabled)
     VALUES ($1, 'NonMotor', 'Smoke', $2, $3, $4, 'active', 'STAFF', 'Underwriter', true, true, false)
     RETURNING id`,
    [
      `USR-NM${suffix}`,
      email,
      `+25575${randomUUID().replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
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
  await db.query(
    `INSERT INTO company_user_permissions (company_user_id, permission_id)
     SELECT $1, id FROM permissions
      WHERE name IN ('pricing.calculate', 'pricing.view_breakdown', 'premium-calculation:calculate')
         OR name LIKE 'quotations:%'
         OR name LIKE 'underwrite.%'
     ON CONFLICT ON CONSTRAINT "UQ_company_user_permissions_membership_permission" DO NOTHING`,
    [companyUserId],
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

async function calculatePricing(token, fx, start, end, sumInsured) {
  const pricing = await api(token, 'POST', '/premium-calculation/single', {
    client_reference: `NM-${SUFFIX}`,
    risk_id: fx.riskId,
    sum_insured: sumInsured,
    factors: {},
    cover_start_date: start.toISOString().slice(0, 10),
    cover_end_date: end.toISOString().slice(0, 10),
    effective_date: start.toISOString().slice(0, 10),
    quotation_type: 'NON_MOTOR',
    currency_code: 'TZS',
    exchange_rate: 1,
    tax_codes: ['VAT-MAINLAND'],
  });
  return {
    ...(pricing.result_payload ?? pricing),
    pricing_quote_id: pricing.pricing_quote_id,
  };
}

function numberFrom(source, keys) {
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  throw new Error(`Pricing response did not include numeric ${keys.join('/')}`);
}

async function body(token, fx) {
  const start = new Date(Date.now() + 10 * 60_000);
  const end = new Date(start.getTime() + 364 * 86_400_000);
  const sumInsured = 25_000_000;
  const pricing = await calculatePricing(token, fx, start, end, sumInsured);
  const premium = numberFrom(pricing, [
    'premium_before_discount',
    'final_premium',
  ]);
  const tax =
    pricing.total_tax_amount === undefined && pricing.tax_amount === undefined
      ? 0
      : numberFrom(pricing, ['total_tax_amount', 'tax_amount']);
  const premiumRate =
    Math.round(numberFrom(pricing, ['percentage_rate', 'premium_rate']) * 1e6) /
    1e6;
  const premiumAfterDiscount = numberFrom(pricing, ['premium_after_discount']);
  const premiumExcludingTax = numberFrom(pricing, [
    'premium_excluding_tax_equivalent',
    'premium_excluding_tax',
  ]);
  const premiumIncludingTax = numberFrom(pricing, [
    'premium_including_tax',
    'premium_including_charges',
  ]);
  log(`Pricing quote ${pricing.pricing_quote_id} calculated`);

  return {
    internal_quotation: {
      insurer_company_id: fx.companyId,
      intermediary_company_id: null,
      department_id: null,
      category_id: fx.categoryId,
      product_id: fx.productId,
      sub_class_id: fx.subClassId,
      quotation_type: 'NON_MOTOR',
      quotation_flow: 'NON_MOTOR',
      channel_type: 'DIRECT',
      is_fleet: false,
    },
    cover_note_hdr: { cover_note_type: 1 },
    cover_note_dtl: {
      prev_cover_note_reference_number: null,
      cover_note_start_date: eat(start),
      cover_note_end_date: eat(end),
      cover_note_desc: 'Non-motor smoke cover',
      operative_clause: 'Non-motor standard cover',
      payment_mode: 1,
      currency_code: 'TZS',
      exchange_rate: 1,
      total_premium_excluding_tax: premium,
      total_premium_including_tax: premium + tax,
      commision_paid: 0,
      commision_rate: 0,
      officer_name: 'NonMotor Smoke',
      officer_title: 'Underwriter',
      product_code: fx.tiramisProductCode,
      endorsement_type: null,
      endorsement_reason: null,
      endorsement_premium_earned: null,
      risks_covered: [
        {
          pricing_quote_id: pricing.pricing_quote_id,
          risk_code: fx.riskCode,
          sum_insured: sumInsured,
          sum_insured_equivalent: Number(
            pricing.sum_insured_equivalent ?? sumInsured,
          ),
          premium_rate: premiumRate,
          premium_before_discount: premium,
          premium_after_discount: premiumAfterDiscount,
          premium_excluding_tax_equivalent: premiumExcludingTax,
          premium_including_tax: premiumIncludingTax,
          discounts_offered: [],
          taxes_charged: tax > 0
            ? [
                {
                  tax_code: 'VAT-MAINLAND',
                  is_tax_exempted: 'N',
                  tax_exemption_type: null,
                  tax_exemption_reference: null,
                  tax_rate: Number(pricing.tax_rate ?? 0),
                  tax_amount: tax,
                },
              ]
            : [],
        },
      ],
      subject_matters_covered: [
        {
          subject_matter_reference: `NM-${SUFFIX}`,
          subject_matter_desc: 'Smoke test insured property',
        },
      ],
      cover_note_addons: [],
      policy_holders: [
        {
          policy_holder_name: 'Non Motor Smoke Customer',
          policy_holder_birth_date: '1985-01-01',
          policy_holder_type: 1,
          policy_holder_id_number: `19850101${randomUUID().replace(/\D/g, '').slice(0, 12).padEnd(12, '0')}`,
          policy_holder_id_type: 1,
          gender: 'M',
          country_code: 'TZA',
          region: 'Dar es Salaam',
          district: 'Ilala',
          street: 'Samora Avenue',
          policy_holder_phone_number: `25575${randomUUID().replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
          policy_holder_fax: null,
          postal_address: 'P.O. Box 100',
          email_address: `nonmotor.${suffix}@example.com`,
        },
      ],
    },
  };
}

async function main() {
  await db.connect();
  const fx = await fixtures();
  const token = await createUser(fx);
  log(`Fixtures ready (${fx.productCode}, risk ${fx.riskCode})`);

  const draft = await nonMotor(token, 'POST', '/quotations/drafts', {
    category_id: fx.categoryId,
    product_id: fx.productId,
    sub_class_id: fx.subClassId,
    quotation_type: 'NON_MOTOR',
    quotation_flow: 'NON_MOTOR',
    channel_type: 'DIRECT',
    is_fleet: false,
    draft_payload: {},
  });
  log(`Non-motor quotation ${draft.quotation_no} drafted`);

  const finalized = await nonMotor(
    token,
    'POST',
    `/quotations/${draft.id}/finalize`,
    await body(token, fx),
  );
  if (finalized.status !== 'READY_FOR_SUBMISSION') {
    throw new Error(`Finalize left status ${finalized.status}`);
  }
  log('ok: finalized');

  await api(token, 'POST', `/tenant/quotations/${draft.id}/submit`, {});
  const accepted = await waitFor('non-motor quotation accepted by TIRA', async () => {
    const quotation = await db.query(
      `SELECT quotation_status, tira_status, tira_response_code, tira_response_description,
              tira_request_id, tira_response_id
         FROM quotations WHERE id = $1`,
      [draft.id],
    );
    const row = quotation.rows[0];
    if (['FAILED', 'REJECTED'].includes(row?.tira_status)) {
      throw new Error(
        `TIRA refused non-motor quotation: ${row.tira_response_code} ${row.tira_response_description}`,
      );
    }
    return { done: row?.tira_status === 'SUCCESS', state: row, quotation: row };
  });

  const issued = await waitFor('non-motor policy issued from callback', async () => {
    const policy = await db.query(
      `SELECT id, policy_no, cover_note_no, sticker_no, policy_status
         FROM policies
        WHERE quotation_id = $1 AND policy_status = 'ACTIVE'
        ORDER BY created_at DESC LIMIT 1`,
      [draft.id],
    );
    return {
      done: Boolean(policy.rows[0]?.cover_note_no),
      state: policy.rows[0],
      policy: policy.rows[0],
    };
  });

  await waitFor('portal notification receipt completed', async () => {
    const receipt = await db.query(
      `SELECT event_key, processing_status, receive_count, last_error
         FROM tiramis_notification_receipts
        WHERE request_id = $1
        ORDER BY created_at DESC LIMIT 1`,
      [accepted.quotation.tira_request_id],
    );
    return {
      done: receipt.rows[0]?.processing_status === 'COMPLETED',
      state: receipt.rows[0],
    };
  });

  log(
    `PASS: non-motor quotation ${draft.quotation_no} issued as ${issued.policy.policy_no}; cover note ${issued.policy.cover_note_no}`,
  );
}

main()
  .catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.end());
