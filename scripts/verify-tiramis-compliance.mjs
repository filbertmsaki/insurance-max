import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const errors = [];

function read(relativePath) {
  return fs.readFileSync(path.join(cwd, relativePath), 'utf8');
}

function expectFile(relativePath) {
  if (!fs.existsSync(path.join(cwd, relativePath))) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

function expectContains(relativePath, expected, label = expected) {
  const content = read(relativePath);

  if (!content.includes(expected)) {
    errors.push(`${relativePath}: missing ${label}`);
  }
}

function expectPackageScript(name) {
  const packageJson = JSON.parse(read('package.json'));

  if (!packageJson.scripts?.[name]) {
    errors.push(`package.json: missing script ${name}`);
  }
}

const requiredEndpointSeeds = new Map([
  ['COVER_NOTE_NON_MOTOR', '/ecovernote/api/covernote/non-life/other/v2/request'],
  ['MOTOR_COVER_NOTE_NON_FLEET', '/ecovernote/api/covernote/non-life/motor/v2/request'],
  ['MOTOR_COVER_NOTE_FLEET', '/ecovernote/api/covernote/non-life/motor-fleet/v2/request'],
  ['REINSURANCE', '/ecovernote/api/reinsurance/v1/request'],
  ['POLICY', '/ecovernote/api/policy/v1/request'],
  ['CLAIM_NOTIFICATION', '/eclaim/api/claim/claim-notification/v1/request'],
  ['CLAIM_INTIMATION', '/eclaim/api/claim/claim-intimation/v1/request'],
  ['CLAIM_ASSESSMENT', '/eclaim/api/claim/claim-assessment/v1/request'],
  ['DISCHARGE_VOUCHER', '/eclaim/api/claim/claim-dischargevoucher/v1/request'],
  ['CLAIM_PAYMENT', '/eclaim/api/claim/claim-payment/v1/request'],
  ['CLAIM_REJECTION', '/eclaim/api/claim/claim-rejection/v1/request'],
  ['COVER_NOTE_VERIFICATION', '/ecovernote/api/covernote/verification/v1/request'],
  ['MOTOR_VERIFICATION', '/dispatch/api/motor/verification/v3/request'],
  ['NIN_VERIFICATION', '/dispatch/api/nin/verification/v1/request'],
  ['COMPANY_VERIFICATION', '/dispatch/api/company/verification/v1/request'],
]);

function expectEndpointSeeds() {
  const content = read('apps/tiramis/src/database/seeders/seed-tiramis-config.ts');

  for (const [serviceType, endpoint] of requiredEndpointSeeds) {
    const serviceIndex = content.indexOf(`serviceType: '${serviceType}'`);

    if (serviceIndex === -1) {
      errors.push(`seed-tiramis-config.ts: missing endpoint seed ${serviceType}`);
      continue;
    }

    const block = content.slice(serviceIndex, serviceIndex + 220);

    if (!block.includes(`endpointUrl: '${endpoint}'`)) {
      errors.push(
        `seed-tiramis-config.ts: ${serviceType} must use ${endpoint}`,
      );
    }
  }
}

function expectLookupGroups() {
  const content = read(
    'apps/insurance-portal-service/src/database/seeds/data/tiramis-lookups.seed-data.ts',
  );
  const groups = [
    'COVER_NOTE_TYPE',
    'PAYMENT_MODE',
    'POLICY_HOLDER_TYPE',
    'IDENTITY_TYPE',
    'GENDER',
    'MOTOR_CATEGORY',
    'MOTOR_TYPE',
    'MOTOR_USAGE',
    'OWNER_CATEGORY',
    'TAX_CODE',
    'REINSURANCE_CATEGORY',
    'PARTICIPANT_TYPE',
    'REINSURANCE_FORM',
    'REINSURANCE_TYPE',
    'LOSS_ASSESSMENT_OPTION',
  ];

  for (const group of groups) {
    if (!content.includes(`group: '${group}'`)) {
      errors.push(`tiramis-lookups.seed-data.ts: missing lookup group ${group}`);
    }
  }
}

function expectAuditHashMigration() {
  const migration =
    'apps/tiramis/src/database/migrations/1783194327692-AddAuditHashesToTiramisEvents.ts';

  expectFile(migration);
  expectContains(migration, 'payload_hash', 'payload_hash migration column');
  expectContains(
    migration,
    'payload_size_bytes',
    'payload_size_bytes migration column',
  );
}

function expectBackendGates() {
  const validator =
    'apps/insurance-portal-service/src/modules/tiramis/services/tiramis-business-validation.service.ts';

  expectContains(validator, 'approvalStatus must be approved');
  expectContains(validator, 'paymentStatus must be paid');
  expectContains(validator, 'previousCoverNoteReferenceNumber is required');
  expectContains(validator, 'coverNoteReferenceNumbers');
  expectContains(validator, 'participants');
  expectContains(validator, 'claimIntimationNumber');
  expectContains(validator, 'claimAssessmentNumber');
}

function expectFrontendReadiness() {
  expectContains(
    'apps/insurance-portal-web/src/modules/tenant/tiramis/components/TiramisSubmissionDialog.tsx',
    'useTiramisBusinessReadiness',
  );
  expectContains(
    'apps/insurance-portal-web/src/modules/tenant/tiramis/api.ts',
    '/tiramis/business/validate',
  );
  expectContains(
    'apps/insurance-portal-web/src/modules/tenant/policies/pages/PolicyDetailPage.tsx',
    'readiness=',
  );
}

expectPackageScript('db:apply:tiramis-compliance');
expectPackageScript('tiramis:compliance:check');
expectFile('scripts/apply-tiramis-compliance-db.js');
expectFile('scripts/tiramis-e2e-test.js');
expectFile('data/tiramis-reference/Countries.xlsx');
expectFile('data/tiramis-reference/CURRENCIES.xlsx');
expectFile('data/tiramis-reference/Regions and Respective Districts -test.xlsx');
expectEndpointSeeds();
expectLookupGroups();
expectAuditHashMigration();
expectBackendGates();
expectFrontendReadiness();

if (errors.length > 0) {
  console.error('TIRAMIS compliance check failed:');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log('TIRAMIS compliance check passed.');
