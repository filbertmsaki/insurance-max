const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { Client } = require('pg');
const { config: loadEnv } = require('dotenv');

const APPS = {
  tiramis: {
    name: 'tiramis',
    envDir: path.join('apps', 'tiramis'),
    migrateScript: 'migration:run:tiramis',
    seedScript: 'seed:tiramis:config',
  },
  'insurance-portal-service': {
    name: 'insurance-portal-service',
    envDir: path.join('apps', 'insurance-portal-service'),
    migrateScript: 'migration:run:insurance-portal-service',
    seedScript: 'seed:insurance-portal-service',
  },
};

const DESTRUCTIVE_ACTIONS = new Set(['wipe', 'reset', 'backup-reset']);
const FORBIDDEN_DATABASES = new Set(['postgres', 'template0', 'template1']);

function parseArgs(argv) {
  const options = {
    action: argv[2],
    app: 'all',
    seed: false,
    confirmProduction: false,
  };

  for (const arg of argv.slice(3)) {
    if (arg.startsWith('--app=')) {
      options.app = arg.slice('--app='.length);
    } else if (arg === '--seed') {
      options.seed = true;
    } else if (arg === '--confirm-production') {
      options.confirmProduction = true;
    } else if (arg === '--help' || arg === '-h') {
      options.action = 'help';
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function usage() {
  console.log(`
Usage:
  node scripts/db-maintenance.js <action> [--app=all|tiramis|insurance-portal-service] [--seed] [--confirm-production]

Actions:
  backup        Create a PostgreSQL backup only.
  wipe          Create and verify a backup, then reset the configured schema.
  migrate       Run TypeORM migrations.
  seed          Run configured seeders.
  reset         Backup, wipe, run migrations, and optionally seed with --seed.
  backup-reset  Alias for reset.

Production wipes require:
  --confirm-production
`);
}

function selectedApps(app) {
  if (app === 'all') {
    return Object.values(APPS);
  }

  const selected = APPS[app];

  if (!selected) {
    throw new Error(
      `Unsupported app "${app}". Use all, tiramis, or insurance-portal-service.`,
    );
  }

  return [selected];
}

function loadEnvironment(app) {
  const cwd = process.cwd();
  const envFiles = [path.join(cwd, '.env'), path.join(cwd, app.envDir, '.env')];

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      loadEnv({ path: envFile, override: false, quiet: true });
    }
  }

  const environmentName =
    process.env.APP_ENV || process.env.NODE_ENV || 'development';
  const environmentFile = path.join(cwd, app.envDir, `.env.${environmentName}`);

  if (fs.existsSync(environmentFile)) {
    loadEnv({ path: environmentFile, override: false, quiet: true });
  }
}

function readDbConfig() {
  const config = {
    type: process.env.DB_TYPE || 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || process.env.DB_NAME,
    schema: process.env.DB_SCHEMA || 'public',
    ssl: String(process.env.DB_SSL || '').toLowerCase() === 'true',
    environment: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  };

  const missing = [];

  for (const key of ['host', 'username', 'database']) {
    if (!config[key]) {
      missing.push(`DB_${key.toUpperCase()}`);
    }
  }

  if (config.type !== 'postgres') {
    throw new Error(
      `Database maintenance supports PostgreSQL only. Current DB_TYPE=${config.type}`,
    );
  }

  if (!Number.isInteger(config.port) || config.port <= 0) {
    throw new Error(
      `DB_PORT must be a valid port. Received: ${process.env.DB_PORT}`,
    );
  }

  if (missing.length > 0) {
    throw new Error(`Missing database configuration: ${missing.join(', ')}`);
  }

  return config;
}

function isProduction(config) {
  return ['production', 'prod'].includes(
    String(config.environment).toLowerCase(),
  );
}

function assertDestructiveAllowed(config, options) {
  if (!DESTRUCTIVE_ACTIONS.has(options.action)) {
    return;
  }

  if (FORBIDDEN_DATABASES.has(config.database.toLowerCase())) {
    throw new Error(`Refusing to wipe reserved database "${config.database}".`);
  }

  if (isProduction(config) && !options.confirmProduction) {
    throw new Error(
      'Refusing to wipe a Production database without --confirm-production.',
    );
  }
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function timestampParts() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replaceAll(':', '');

  return { date, time };
}

function backupPath(config) {
  const { date, time } = timestampParts();
  const backupDir = path.join(process.cwd(), 'backups', 'database');
  const filename = [
    safeName(config.database),
    safeName(config.environment),
    date,
    `${time}.sql`,
  ].join('_');

  return path.join(backupDir, filename);
}

async function checkConnection(config) {
  const client = new Client(clientConfig(config));

  await client.connect();
  await client.query('SELECT 1');
  await client.end();
}

function runPgDump(config) {
  const outputPath = backupPath(config);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const args = [
    '--host',
    config.host,
    '--port',
    String(config.port),
    '--username',
    config.username,
    '--format',
    'plain',
    '--no-owner',
    '--no-privileges',
    '--file',
    outputPath,
    config.database,
  ];

  const result = spawnSync('pg_dump', args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PGPASSWORD: config.password,
      PGSSLMODE: config.ssl ? 'require' : process.env.PGSSLMODE,
    },
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error('pg_dump failed. Database wipe/reset has been stopped.');
  }

  const stat = fs.statSync(outputPath);

  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`Backup verification failed for ${outputPath}`);
  }

  return outputPath;
}

function clientConfig(config) {
  return {
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  };
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function wipeSchema(config) {
  const client = new Client(clientConfig(config));
  const schema = quoteIdentifier(config.schema);

  await client.connect();

  try {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(
      `GRANT ALL ON SCHEMA ${schema} TO ${quoteIdentifier(config.username)}`,
    );

    if (config.schema === 'public') {
      await client.query(`GRANT ALL ON SCHEMA ${schema} TO public`);
    }
  } finally {
    await client.end();
  }
}

function runNpmScript(script, extraEnv = {}) {
  const result = spawnSync('npm', ['run', script], {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`npm run ${script} failed.`);
  }
}

async function withAppEnvironment(app, callback) {
  const previousEnv = { ...process.env };

  try {
    loadEnvironment(app);
    await callback();
  } finally {
    process.env = previousEnv;
  }
}

async function runForApp(app, options) {
  await withAppEnvironment(app, async () => {
    const config = readDbConfig();

    console.log(`\nStart Database ${options.action} for ${app.name}`);
    console.log(
      `Environment=${config.environment} Database=${config.database} Host=${config.host}:${config.port} Schema=${config.schema}`,
    );

    assertDestructiveAllowed(config, options);

    if (options.action === 'migrate') {
      runNpmScript(app.migrateScript);
      return;
    }

    if (options.action === 'seed') {
      runNpmScript(app.seedScript);
      return;
    }

    await checkConnection(config);

    const backup = runPgDump(config);

    console.log(`Backup created and verified: ${backup}`);

    if (options.action === 'backup') {
      return;
    }

    await wipeSchema(config);
    console.log(`Database schema reset completed: ${config.schema}`);

    if (options.action === 'reset' || options.action === 'backup-reset') {
      runNpmScript(app.migrateScript);

      if (options.seed) {
        runNpmScript(app.seedScript);
      }
    }
  });
}

async function main() {
  const options = parseArgs(process.argv);

  if (!options.action || options.action === 'help') {
    usage();
    return;
  }

  if (
    !['backup', 'wipe', 'migrate', 'seed', 'reset', 'backup-reset'].includes(
      options.action,
    )
  ) {
    throw new Error(`Unsupported action: ${options.action}`);
  }

  for (const app of selectedApps(options.app)) {
    await runForApp(app, options);
  }

  console.log('\nDatabase maintenance completed successfully.');
}

main().catch((error) => {
  console.error(`\nDatabase maintenance failed: ${error.message}`);
  process.exit(1);
});
