import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

const files = {
  portal: 'apps/insurance-portal-service/.env.example',
  tiramis: 'apps/tiramis/.env.example',
  web: 'apps/insurance-portal-web/.env.example',
};

const errors = [];

function parseEnv(relativePath) {
  const absolutePath = path.join(cwd, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const values = new Map();

  content.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      return;
    }

    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);

    if (!match) {
      errors.push(
        `${relativePath}:${index + 1}: invalid environment line: ${line}`,
      );
      return;
    }

    const [, key, value] = match;

    if (values.has(key)) {
      errors.push(
        `${relativePath}:${index + 1}: duplicate environment key ${key}`,
      );
    }

    values.set(key, value.trim());
  });

  return values;
}

const env = Object.fromEntries(
  Object.entries(files).map(([service, file]) => [service, parseEnv(file)]),
);

function expect(service, key, expected) {
  const actual = env[service].get(key);

  if (actual !== expected) {
    errors.push(
      `${files[service]}: expected ${key}=${expected}, received ${
        actual ?? '<missing>'
      }`,
    );
  }
}

expect('portal', 'APP_PORT', '9090');
expect('portal', 'APP_URL', 'http://localhost:9090');
expect('portal', 'APP_FRONTEND_URL', 'http://localhost:9092');
expect('portal', 'CORS_ALLOWED_ORIGINS', 'http://localhost:9092');
expect('portal', 'TIRAMIS_SERVICE_BASE_URL', 'http://127.0.0.1:9091');
expect('portal', 'DB_SYNCHRONIZE', 'false');

expect('tiramis', 'APP_PORT', '9091');
expect('tiramis', 'APP_URL', 'http://localhost:9091');
expect(
  'tiramis',
  'INSURANCE_PORTAL_WEBHOOK_URL',
  'http://localhost:9090/api/v1/webhooks/tiramis/notifications',
);
expect('tiramis', 'DB_SYNCHRONIZE', 'false');

expect('web', 'VITE_APP_PORT', '9092');
expect('web', 'VITE_APP_URL', 'http://localhost:9092');
expect('web', 'VITE_BACKEND_URL', 'http://localhost:9090');
expect('web', 'VITE_API_PREFIX', 'api/v1');

if (errors.length > 0) {
  console.error('Environment example validation failed:');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log('Environment example validation passed.');
