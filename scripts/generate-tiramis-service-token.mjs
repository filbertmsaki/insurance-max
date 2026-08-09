import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const encodedHeader = base64Url(
    JSON.stringify({
      alg: 'HS256',
      typ: 'JWT',
    }),
  );
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${signature}`;
}

let companyId = readArg('company-id');
const companySlug = readArg('company-slug');
const scopes = (readArg('scopes', 'tiramis:verify') ?? '')
  .split(',')
  .map((scope) => scope.trim())
  .filter(Boolean);
const secret = process.env.SERVICE_AUTH_SECRET ?? readArg('secret');
const issuer = readArg('issuer', 'insurance-portal-service');
const subject = readArg('subject', issuer);
const audience = readArg('audience', 'tiramis-service');
const expiresInSeconds = Number(readArg('expires-in-seconds', '600'));

async function resolveCompanyIdFromSlug(slug) {
  const client = new pg.Client({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database:
      process.env.DB_DATABASE ??
      process.env.DB_NAME ??
      'insurance_portal_db',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  try {
    const result = await client.query(
      `
      SELECT id
      FROM companies
      WHERE slug = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [slug],
    );

    return result.rows[0]?.id ?? null;
  } finally {
    await client.end();
  }
}

if (!companyId && companySlug) {
  companyId = await resolveCompanyIdFromSlug(companySlug);

  if (!companyId) {
    console.error(`No active company found for slug: ${companySlug}`);
    process.exit(1);
  }
}

if (!companyId) {
  console.error('Missing --company-id <company-id> or --company-slug <slug>');
  process.exit(1);
}

if (!secret) {
  console.error(
    'Missing SERVICE_AUTH_SECRET. Set it in the environment or pass --secret <secret>.',
  );
  process.exit(1);
}

if (!scopes.length) {
  console.error('Missing --scopes <comma-separated-scopes>');
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const token = signJwt(
  {
    scopes,
    tenant: { companyId },
    iss: issuer,
    sub: subject,
    aud: audience,
    iat: now,
    exp: now + expiresInSeconds,
    jti: randomUUID(),
  },
  secret,
);

console.log(token);
console.error('');
console.error('Swagger headers:');
console.error(`Authorization: Bearer ${token}`);
console.error(`X-Tenant-Company-Id: ${companyId}`);
console.error('x-source-service: insurance-portal-service');
