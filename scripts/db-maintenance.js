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
    migrateProductionScript: 'migration:run:tiramis:production',
    seedScript: 'seed:tiramis:config',
    seedProductionScript: 'seed:tiramis:config:production',
  },
  'insurance-portal-service': {
    name: 'insurance-portal-service',
    envDir: path.join('apps', 'insurance-portal-service'),
    migrateScript: 'migration:run:insurance-portal-service',
    migrateProductionScript: 'migration:run:insurance-portal-service:production',
    seedScript: 'seed:insurance-portal-service',
    seedProductionScript: 'seed:insurance-portal-service:production',
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
    expectedDatabase: undefined,
    skipBackup: false,
  };

  for (const arg of argv.slice(3)) {
    if (arg.startsWith('--app=')) {
      options.app = arg.slice('--app='.length);
    } else if (arg === '--seed') {
      options.seed = true;
    } else if (arg === '--confirm-production') {
      options.confirmProduction = true;
    } else if (arg.startsWith('--expect-database=')) {
      options.expectedDatabase = arg.slice('--expect-database='.length);
    } else if (arg === '--skip-backup') {
      options.skipBackup = true;
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
  node scripts/db-maintenance.js <action> [--app=all|tiramis|insurance-portal-service] [--seed] [--confirm-production] [--expect-database=NAME] [--skip-backup]

Actions:
  backup        Create a PostgreSQL backup only.
  wipe          Create and verify a backup, then reset the configured schema.
  migrate       Run TypeORM migrations.
  seed          Run configured seeders.
  reset         Backup, wipe, run migrations, and optionally seed with --seed.
  backup-reset  Alias for reset.

Production wipes require:
  --confirm-production
  --expect-database=NAME  Require an exact database name before the wipe.

Local-only bypass:
  --skip-backup    Skip pg_dump when destructive actions run in non-production.
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

  if (isProduction(config) && !options.expectedDatabase) {
    throw new Error(
      'Production reset requires --expect-database=NAME to verify the target database.',
    );
  }

  if (
    options.expectedDatabase &&
    config.database !== options.expectedDatabase
  ) {
    throw new Error(
      `Database mismatch: configured "${config.database}" but expected "${options.expectedDatabase}". No reset was performed.`,
    );
  }

  if (isProduction(config) && options.skipBackup) {
    throw new Error(
      'Refusing to skip backups for a Production database wipe/reset.',
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
  const releaseDir = fs.realpathSync(process.cwd());
  const releasesDir = path.dirname(releaseDir);
  const appDir = path.dirname(releasesDir);
  const isReleaseCheckout = path.basename(releasesDir) === 'releases';
  const backupDir =
    process.env.DB_BACKUP_DIR ||
    (isReleaseCheckout
      ? path.join(appDir, 'shared', 'backups', 'database')
      : path.join(process.cwd(), 'backups', 'database'));
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

/**
 * pg_dump from PG_DUMP_PATH, then PATH, then (on Windows) the newest
 * PostgreSQL installation under Program Files.
 */
function resolvePgDump() {
  if (process.env.PG_DUMP_PATH) {
    return process.env.PG_DUMP_PATH;
  }

  const executable = process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump';
  const onPath = (process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
    .map((directory) => path.join(directory, executable))
    .find((candidate) => fs.existsSync(candidate));

  if (onPath) {
    return onPath;
  }

  if (process.platform === 'win32') {
    const root = path.join(
      process.env.ProgramFiles || 'C:\\Program Files',
      'PostgreSQL',
    );
    const versions = fs.existsSync(root)
      ? fs
          .readdirSync(root)
          .filter((name) => /^\d+(\.\d+)?$/.test(name))
          .sort((a, b) => Number(b) - Number(a))
      : [];

    for (const version of versions) {
      const candidate = path.join(root, version, 'bin', executable);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return executable;
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

  // No shell: arguments reach pg_dump unchanged, so paths with spaces work.
  const result = spawnSync(resolvePgDump(), args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PGPASSWORD: config.password,
      PGSSLMODE: config.ssl ? 'require' : process.env.PGSSLMODE,
    },
  });

  if (result.error) {
    throw new Error(
      `pg_dump could not be started (${result.error.message}). Put it on PATH or set PG_DUMP_PATH.`,
    );
  }

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
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
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

function scriptsForEnvironment(app, config) {
  if (isProduction(config)) {
    return {
      migrate: app.migrateProductionScript,
      seed: app.seedProductionScript,
    };
  }

  return { migrate: app.migrateScript, seed: app.seedScript };
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
    const scripts = scriptsForEnvironment(app, config);

    console.log(`\nStart Database ${options.action} for ${app.name}`);
    console.log(
      `Environment=${config.environment} Database=${config.database} Host=${config.host}:${config.port} Schema=${config.schema}`,
    );

    assertDestructiveAllowed(config, options);

    if (options.action === 'migrate') {
      runNpmScript(scripts.migrate);
      return;
    }

    if (options.action === 'seed') {
      runNpmScript(scripts.seed);
      return;
    }

    await checkConnection(config);

    if (!options.skipBackup) {
      const backup = runPgDump(config);
      console.log(`Backup created and verified: ${backup}`);
    } else {
      console.log('Backup skipped by --skip-backup for local reset.');
    }

    if (options.action === 'backup') {
      return;
    }

    await wipeSchema(config);
    console.log(`Database schema reset completed: ${config.schema}`);

    if (options.action === 'reset' || options.action === 'backup-reset') {
      runNpmScript(scripts.migrate);

      if (options.seed) {
        runNpmScript(scripts.seed);
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

  const serviceFile = path.join(process.cwd(), 'SERVICE_NAME');
  if (fs.existsSync(serviceFile)) {
    const serviceName = fs.readFileSync(serviceFile, 'utf8').trim();
    if (options.app === 'all' || options.app !== serviceName) {
      throw new Error(
        `This release is for "${serviceName}". Specify --app=${serviceName} to continue.`,
      );
    }
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
