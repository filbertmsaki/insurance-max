const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function loadEnv(file) {
  if (!fs.existsSync(file)) {
    return;
  }

  const content = fs.readFileSync(file, 'utf8');

  for (const line of content.split('\n')) {
    const value = line.trim();

    if (!value || value.startsWith('#')) {
      continue;
    }

    const index = value.indexOf('=');

    if (index < 0) {
      continue;
    }

    const key = value.slice(0, index).trim();
    const val = value.slice(index + 1).trim();

    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnv(path.join(process.cwd(), '.env.e2e'));

const baseUrl = (process.env.PORTAL_BASE_URL ?? 'http://localhost:9090').replace(
  /\/$/,
  '',
);
const api = `${baseUrl}/api/v1`;
const token = process.env.E2E_AUTH_TOKEN;
const policyId = process.env.E2E_ENDORSEMENT_POLICY_ID;
const type = process.env.E2E_ENDORSEMENT_TYPE_CODE;
const fieldPath = process.env.E2E_ENDORSEMENT_FIELD_PATH;
const newValue = process.env.E2E_ENDORSEMENT_NEW_VALUE;
const category = process.env.E2E_ENDORSEMENT_CATEGORY ?? 'ASSET';

if (!token || !policyId || !type || !fieldPath) {
  throw new Error('Missing endorsement E2E configuration.');
}

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${method} ${url} failed: ${response.status} ${text}`);
  }

  return payload?.data ?? payload;
}

async function main() {
  console.log('1. Check eligibility');
  const eligibility = await request(
    'GET',
    `${api}/tenant/policies/${policyId}/endorsement-eligibility`,
  );

  if (!eligibility.eligible) {
    throw new Error(JSON.stringify(eligibility.blockers));
  }

  console.log('2. Create endorsement');
  const today = new Date().toISOString().slice(0, 10);
  const transaction = await request(
    'POST',
    `${api}/tenant/policies/${policyId}/endorsements`,
    {
      effective_date: process.env.E2E_ENDORSEMENT_EFFECTIVE_DATE ?? today,
      endorsement_type_code: type,
      reason: 'Automated UAT endorsement validation',
      idempotency_key: randomUUID(),
    },
  );
  const id = transaction.id;

  console.log('3. Record change');
  await request('POST', `${api}/tenant/endorsements/${id}/changes`, {
    category,
    operation: 'MODIFY',
    field_path: fieldPath,
    new_value: newValue,
  });

  console.log('4. Recalculate');
  await request('POST', `${api}/tenant/endorsements/${id}/recalculate`);

  console.log('5. Complete');
  const completed = await request(
    'POST',
    `${api}/tenant/endorsements/${id}/complete`,
  );

  console.log({
    endorsementId: id,
    premiumEffect: completed.premium_effect,
    approvalRequired: completed.approval_required,
    paymentRequired: completed.payment_required,
    submissionStatus: completed.submission_status,
  });

  if (completed.approval_required || completed.payment_required) {
    console.log('PASS: endorsement reached its required business gate.');
    return;
  }

  console.log('6. Issue endorsement');
  await request('POST', `${api}/tenant/endorsements/${id}/submit-tiramis`);
  console.log('PASS: endorsement submitted to TIRAMIS.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
