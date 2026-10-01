/**
 * Live smoke test of fleet add/remove-vehicle endorsements through the real
 * TIRAMIS path: portal -> TIRAMIS gateway -> mock TIRA (port 5050) ->
 * callback -> gateway -> portal webhook.
 *
 * Needs the portal, the gateway and mock TIRA running:
 *   npm run start:dev:tiramis
 *   npm run start:dev:insurance-portal-service
 *   (cd mock-tira && npm start)
 *
 * Run: npm run smoke:fleet-endorsements-live
 *
 * Fixture: a copy of the newest issued fleet policy (policy, current version,
 * risks, cover notes) with TIRA cover-note references, so existing policies
 * are never touched. Then, through /tenant/underwrite/fleet:
 *   1. add a vehicle -> approve -> pay -> TIRA -> applied (own cover note);
 *   2. remove vehicle 2 -> approve -> TIRA -> applied (risk cancelled).
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
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 120_000);

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
      log(`  ok: ${label}`);
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(
    `Timed out waiting for ${label} (last: ${JSON.stringify(last?.state)})`,
  );
}

/** Waits for TIRA's callback to apply the endorsement to the policy. */
async function waitApplied(token, endorsementId) {
  return waitFor('TIRA accepted and the endorsement is applied', async () => {
    const context = await fleet(
      token,
      'GET',
      `/endorsements/${endorsementId}/context`,
    );
    const tx = context.transaction;
    if (['FAILED', 'REJECTED'].includes(tx.submission_status)) {
      throw new Error(
        `TIRA refused the endorsement: ${JSON.stringify(tx.regulatory_response)}`,
      );
    }
    return {
      done: tx.stage === 'APPLIED',
      state: `${tx.stage}/${tx.submission_status}`,
      context,
    };
  });
}

async function createUser(companyId, branchId, label) {
  const email = `fleet.${label.toLowerCase()}.${suffix}@example.com`;
  const user = await db.query(
    `INSERT INTO users (user_no, first_name, last_name, email, phone, password, status,
       user_type, officer_title, is_email_verified, is_phone_verified, is_two_factor_enabled)
     VALUES ($1, $2, 'Fleet', $3, $4, $5, 'active', 'STAFF', 'Underwriter', true, true, false)
     RETURNING id`,
    [
      `USR-F${suffix}${label.slice(0, 2)}`,
      label,
      email,
      `+25577${randomUUID().replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
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
    [companyId, user.rows[0].id],
  );
  await db.query(
    `INSERT INTO branch_users (branch_id, company_user_id, is_primary, is_active_branch, activated_at)
     VALUES ($1, $2, true, true, now())`,
    [branchId, membership.rows[0].id],
  );
  await db.query(
    `INSERT INTO company_user_roles (company_user_id, role_id)
     SELECT $1, id FROM roles WHERE name = 'INSURANCE_ADMIN' AND company_id = $2 LIMIT 1`,
    [membership.rows[0].id, companyId],
  );
  // Finance steps (recording the endorsement payment) and every underwrite
  // gate, in case the role does not carry them.
  await db.query(
    `INSERT INTO company_user_permissions (company_user_id, permission_id)
     SELECT $1, id FROM permissions
      WHERE name LIKE 'underwrite.%' OR name LIKE 'endorsements:%'
         OR name LIKE 'payments:%' OR name LIKE 'receipts:%'
         OR name LIKE 'invoices:%' OR name LIKE 'finance:%'
         OR name IN ('policies:read', 'claims:create', 'claims:read')
     ON CONFLICT DO NOTHING`,
    [membership.rows[0].id],
  );
  const login = await api(null, 'POST', '/auth/login', {
    email,
    password: PASSWORD,
  });
  return login.access_token ?? login.accessToken;
}

/** Clones a row with column overrides (keeps every other column). */
async function cloneRow(table, where, params, overrides) {
  const { rows } = await db.query(
    `INSERT INTO ${table}
     SELECT (jsonb_populate_record(NULL::${table}, to_jsonb(src) || $${params.length + 1}::jsonb)).*
       FROM ${table} src WHERE ${where}
     RETURNING *`,
    [...params, JSON.stringify(overrides)],
  );
  return rows;
}

async function fixture() {
  const source = (
    await db.query(
      `SELECT p.* FROM policies p
         JOIN quotations q ON q.id = p.quotation_id
         JOIN tiramis_company_configurations t ON t.company_id = p.company_id
        WHERE q.quotation_flow = 'MOTOR_FLEET' AND p.deleted_at IS NULL
          AND p.policy_status IN ('ACTIVE', 'ENDORSED')
          AND p.pending_transaction_id IS NULL
          AND p.policy_no NOT LIKE 'POL-FLT-%'
        ORDER BY p.created_at DESC LIMIT 1`,
    )
  ).rows[0];
  if (!source) throw new Error('No issued fleet policy to copy');

  const policyId = randomUUID();
  const versionId = randomUUID();
  const policyNo = `POL-FLT-${suffix}`;
  const reference = (entry) => `REF-${suffix}-${entry}`;

  const version = (
    await db.query(`SELECT * FROM policy_versions WHERE id = $1`, [
      source.active_version_id,
    ])
  ).rows[0];
  // Rename the copied vehicles: the source policy still insures the originals,
  // and TIRA refuses a fleet resubmission for a vehicle insured elsewhere.
  const tag = suffix.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let snapshotText = JSON.stringify(version.policy_snapshot);
  for (const [index, entry] of (
    version.policy_snapshot.entries ?? []
  ).entries()) {
    const motor = entry.motor ?? {};
    for (const [field, prefix] of [
      ['registrationNumber', 'T'],
      ['chassisNumber', 'CH'],
      ['engineNumber', 'EN'],
    ]) {
      const value = motor[field];
      if (typeof value !== 'string' || !value) continue;
      const renamed = `${prefix}${tag.slice(0, 5)}${index + 1}`;
      snapshotText = snapshotText
        .split(JSON.stringify(value))
        .join(JSON.stringify(renamed));
    }
  }
  const snapshot = JSON.parse(snapshotText);
  snapshot.policyId = policyId;
  snapshot.policyNo = policyNo;
  snapshot.coverNotes = (snapshot.coverNotes ?? []).map((note, index) => ({
    ...note,
    fleetEntry: note.fleetEntry ?? index + 1,
    coverNoteReferenceNumber: reference(note.fleetEntry ?? index + 1),
    stickerNumber: `STK-${suffix}-${note.fleetEntry ?? index + 1}`,
  }));

  await cloneRow('policies', 'src.id = $1', [source.id], {
    id: policyId,
    policy_no: policyNo,
    cover_note_no: reference(1),
    // (quotation_id, source_quotation_revision) is unique per issued policy.
    source_quotation_revision: 900000 + Math.floor(Math.random() * 99999),
    active_version_id: null,
    pending_transaction_id: null,
    regulatory_sync_status: 'IN_SYNC',
    tira_status: 'SUCCESS',
  });
  await cloneRow('policy_versions', 'src.id = $1', [version.id], {
    id: versionId,
    policy_id: policyId,
    policy_snapshot: snapshot,
    is_current: true,
    superseded_at: null,
    supersedes_version_id: null,
  });
  await db.query(`UPDATE policies SET active_version_id = $1 WHERE id = $2`, [
    versionId,
    policyId,
  ]);
  await db.query(
    `INSERT INTO policy_risks
     SELECT (jsonb_populate_record(NULL::policy_risks,
               to_jsonb(src) || jsonb_build_object('id', gen_random_uuid(), 'policy_id', $2::uuid))).*
       FROM policy_risks src WHERE src.policy_id = $1 AND src.deleted_at IS NULL`,
    [source.id, policyId],
  );
  const notes = await db.query(
    `SELECT id, fleet_entry FROM cover_notes
      WHERE policy_id = $1 AND deleted_at IS NULL ORDER BY fleet_entry`,
    [source.id],
  );
  for (const [index, note] of notes.rows.entries()) {
    const entry = note.fleet_entry ?? index + 1;
    const [copy] = await cloneRow('cover_notes', 'src.id = $1', [note.id], {
      id: randomUUID(),
      policy_id: policyId,
      quotation_entry_id: null,
      cover_note_number: `CN-${suffix}-${entry}`,
      cover_note_reference_number: reference(entry),
      sticker_number: `STK-${suffix}-${entry}`,
    });
    await db.query(
      `INSERT INTO policy_cover_notes (company_id, policy_id, cover_note_id, sequence_number)
       VALUES ($1, $2, $3, $4)`,
      [source.company_id, policyId, copy.id, index + 1],
    );
  }

  const branchId =
    source.branch_id ??
    (
      await db.query(
        `SELECT id FROM branches WHERE company_id = $1 AND status = 'active'
          ORDER BY created_at LIMIT 1`,
        [source.company_id],
      )
    ).rows[0].id;
  return {
    companyId: source.company_id,
    branchId,
    policyId,
    policyNo,
    vehicles: (snapshot.entries ?? []).length,
  };
}

async function createEndorsement(token, policyId, typeCode, reason) {
  return fleet(token, 'POST', `/policies/${policyId}/endorsements`, {
    effective_date: new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10),
    endorsement_type_code: typeCode,
    reason,
    idempotency_key: randomUUID(),
  });
}

async function approveAndSubmit(maker, checker, endorsementId) {
  const path = `/endorsements/${endorsementId}`;
  await fleet(maker, 'POST', `${path}/complete`);
  let context = await fleet(maker, 'GET', `${path}/context`);
  if (context.transaction.approval_required) {
    await fleet(maker, 'POST', `${path}/submit-approval`);
    await fleet(checker, 'POST', `${path}/approve`);
    log('  ok: approved by a second user');
  }
  context = await fleet(maker, 'GET', `${path}/context`);
  const tx = context.transaction;
  if (tx.payment_required) {
    const requested = await fleet(maker, 'POST', `${path}/request-payment`);
    const invoiceId = requested.id ?? requested.invoice?.id;
    // The endorsement invoice starts as a draft; finance issues it first.
    const draft = await api(
      maker,
      'GET',
      `/tenant/finance/invoices/${invoiceId}`,
    );
    const invoice =
      draft.status === 'DRAFT'
        ? await api(
            maker,
            'POST',
            `/tenant/finance/invoices/${invoiceId}/issue`,
            {
              expected_state_version: Number(draft.state_version),
              idempotency_key: randomUUID(),
            },
          )
        : draft;
    const amount = Number(
      invoice.balance_amount ?? invoice.total_amount ?? tx.additional_premium,
    );
    const payment = await api(
      maker,
      'POST',
      '/tenant/finance/payment-transactions/manual',
      {
        invoice_id: invoiceId,
        payment_method: 'BANK_TRANSFER',
        provider_code: 'MANUAL',
        payment_reference: `FT-${suffix}`,
        amount,
        currency_code: tx.currency_code,
        payer_name: 'Fleet Smoke Ltd',
        idempotency_key: randomUUID(),
      },
    );
    await api(maker, 'POST', '/tenant/finance/receipts/post', {
      payment_transaction_id: payment.id,
      invoice_id: invoiceId,
      allocation_amount: amount,
      idempotency_key: randomUUID(),
    });
    await waitFor('additional premium paid', async () => {
      const current = await fleet(maker, 'GET', `${path}/context`);
      return {
        done: current.transaction.payment_status === 'PAID',
        state: current.transaction.payment_status,
      };
    });
  }
  // Approval submits on its own when nothing is left to pay.
  const before = (await fleet(maker, 'GET', `${path}/context`)).transaction;
  if (
    !['PROCESSING', 'SUBMITTED', 'ACCEPTED'].includes(before.submission_status)
  ) {
    await fleet(maker, 'POST', `${path}/submit-tiramis`);
  }
  return waitApplied(maker, endorsementId);
}

async function main() {
  await db.connect();
  const { companyId, branchId, policyId, policyNo, vehicles } = await fixture();
  log(
    `Fixture ${policyNo}: copy of an issued fleet policy (${vehicles} vehicles)`,
  );
  const maker = await createUser(companyId, branchId, 'Maker');
  const checker = await createUser(companyId, branchId, 'Checker');
  log('Users ready');

  // 1. Add a vehicle first, so a 2-vehicle fleet can then lose one.
  const addition = await createEndorsement(
    maker,
    policyId,
    'FLEET_ADD_VEHICLE',
    'New vehicle joins the fleet',
  );
  const tag = suffix.toUpperCase().replace(/[^A-Z0-9]/g, '');
  await fleet(maker, 'POST', `/endorsements/${addition.id}/vehicles`, {
    motor: {
      motorCategory: 1,
      motorType: 1,
      registrationNumber: `T${tag.slice(0, 3)}ABC`,
      chassisNumber: `CH${tag}001`,
      make: 'Toyota',
      model: 'Hiace',
      modelNumber: 'KDH200',
      bodyType: 'Minibus',
      color: 'White',
      engineNumber: `EN${tag}001`,
      engineCapacity: '2800',
      fuelUsed: 'Diesel',
      numberOfAxles: 2,
      axleDistance: 2.6,
      sittingCapacity: 14,
      yearOfManufacture: 2021,
      tareWeight: 2000,
      grossWeight: 3200,
      motorUsage: 2,
      ownerName: 'Fleet Smoke Ltd',
      ownerCategory: 2,
      ownerAddress: 'Dar es Salaam',
    },
  });
  log(`Addition ${addition.transaction_no}: vehicle priced`);
  await approveAndSubmit(maker, checker, addition.id);
  const newNote = await db.query(
    `SELECT cover_note_reference_number, sticker_number FROM cover_notes
      WHERE policy_id = $1 AND quotation_entry_id IS NULL
        AND cover_note_number LIKE $2`,
    [policyId, `${addition.transaction_no}%`],
  );
  if (!newNote.rows[0]?.cover_note_reference_number) {
    throw new Error('Added vehicle has no TIRA cover-note reference');
  }
  log(
    `  ok: new vehicle cover note ${newNote.rows[0].cover_note_reference_number}, sticker ${newNote.rows[0].sticker_number}`,
  );

  // 2. Remove vehicle 2 (the fleet keeps its minimum of 2 vehicles).
  const removal = await createEndorsement(
    maker,
    policyId,
    'FLEET_REMOVE_VEHICLE',
    'Vehicle sold',
  );
  const removed = await fleet(
    maker,
    'DELETE',
    `/endorsements/${removal.id}/vehicles/2`,
  );
  const refund = removed.transaction.pricing_snapshot?.fleetRemovalRefund;
  log(
    `Removal ${removal.transaction_no}: return premium ${refund?.refundAmount} (${refund?.cancellationMethod})`,
  );
  await approveAndSubmit(maker, checker, removal.id);
  const cancelled = await db.query(
    `SELECT COUNT(*)::int AS n FROM policy_risks
      WHERE policy_id = $1 AND status = 'CANCELLED' AND cancelled_at IS NOT NULL`,
    [policyId],
  );
  if (!cancelled.rows[0].n) {
    throw new Error('Removed vehicle risks were not cancelled');
  }
  log(`  ok: ${cancelled.rows[0].n} policy risk(s) cancelled`);

  const panel = await fleet(maker, 'GET', `/policies/${policyId}/vehicles`);
  log(
    `  ok: vehicles panel ${panel.vehicles
      .map((v) => `${v.entry_number}:${v.vehicle_status}`)
      .join(', ')} (on cover ${panel.totals.vehicles})`,
  );

  log(
    `PASS: ${policyNo} lost and gained a vehicle through the gateway and mock TIRA`,
  );
}

main()
  .catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.end());
