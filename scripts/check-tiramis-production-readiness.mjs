import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const envFileArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--env-file='));
const envFile = envFileArg
  ? envFileArg.slice('--env-file='.length)
  : 'apps/tiramis/.env';
const strict = args.has('--strict');
const errors = [];
const warnings = [];

function parseEnv(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    errors.push(`Environment file not found: ${filePath}`);
    return new Map();
  }

  const values = new Map();
  const content = fs.readFileSync(absolutePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const index = line.indexOf('=');

    if (index === -1) {
      continue;
    }

    values.set(line.slice(0, index), line.slice(index + 1).trim());
  }

  return values;
}

function requireValue(env, key) {
  const value = env.get(key);

  if (!value) {
    errors.push(`Missing required value: ${key}`);
  }

  return value;
}

function warnIfLocalhost(key, value) {
  if (value && /localhost|127\.0\.0\.1/i.test(value)) {
    warnings.push(`${key} points to localhost: ${value}`);
  }
}

function checkCertificatePath(key, value) {
  if (!value) {
    return;
  }

  const resolved = path.resolve(process.cwd(), value);

  if (!fs.existsSync(resolved)) {
    warnings.push(`${key} path is not present on this machine: ${value}`);
  }
}

const env = parseEnv(envFile);
const targetEnv = env.get('TIRAMIS_TARGET_ENV');

if (targetEnv !== 'live') {
  const message = `TIRAMIS_TARGET_ENV is ${targetEnv || '<missing>'}, not live`;
  if (strict) {
    errors.push(message);
  } else {
    warnings.push(message);
  }
}

const appUrl = requireValue(env, 'APP_URL');
const liveBaseUrl = requireValue(env, 'TIRAMIS_LIVE_BASE_URL');
const encryptionKey = requireValue(env, 'TIRAMIS_SECRET_ENCRYPTION_KEY');

requireValue(env, 'APP_GLOBAL_PREFIX');
requireValue(env, 'ALLIANCE_TIRA_CLIENT_KEY_LIVE');
requireValue(env, 'ALLIANCE_CLIENT_PRIVATE_CERT_PASSWORD_LIVE');
requireValue(env, 'TIRA_PUBLIC_CERT_PASSWORD_LIVE');

warnIfLocalhost('APP_URL', appUrl);
warnIfLocalhost('TIRAMIS_LIVE_BASE_URL', liveBaseUrl);

if (encryptionKey) {
  const key = Buffer.from(encryptionKey, 'base64');

  if (key.length !== 32) {
    errors.push('TIRAMIS_SECRET_ENCRYPTION_KEY must decode to 32 bytes');
  }
}

const certificateBaseDir = env.get('TIRAMIS_CERTIFICATE_BASE_DIR');

if (certificateBaseDir) {
  checkCertificatePath(
    'live client private certificate',
    path.join(certificateBaseDir, 'live', 'clientprivate.pfx'),
  );
  checkCertificatePath(
    'live TIRA public certificate',
    path.join(certificateBaseDir, 'live', 'tiramispublic.pfx'),
  );
} else {
  warnings.push('TIRAMIS_CERTIFICATE_BASE_DIR is not set');
}

if (warnings.length > 0) {
  console.warn('TIRAMIS production readiness warnings:');
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (errors.length > 0) {
  console.error('TIRAMIS production readiness failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('TIRAMIS production readiness check passed.');
