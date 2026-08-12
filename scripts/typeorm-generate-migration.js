const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APPS = {
  tiramis: {
    dataSource: path.join('apps', 'tiramis', 'src', 'database', 'data-source.ts'),
    migrationsDir: path.join('apps', 'tiramis', 'src', 'database', 'migrations'),
    filePrefix: 'BaselineMigration',
  },
  'insurance-portal-service': {
    dataSource: path.join(
      'apps',
      'insurance-portal-service',
      'src',
      'database',
      'data-source.ts',
    ),
    migrationsDir: path.join(
      'apps',
      'insurance-portal-service',
      'src',
      'database',
      'migrations',
    ),
    filePrefix: 'BaselineMigration',
  },
};

function parseArgs(argv) {
  const options = {
    app: '',
    name: '',
  };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--app=')) {
      options.app = arg.slice('--app='.length);
      continue;
    }

    if (arg.startsWith('--name=')) {
      options.name = arg.slice('--name='.length);
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function usage() {
  console.log(`
Usage:
  node scripts/typeorm-generate-migration.js --app=tiramis|insurance-portal-service [--name=MigrationName]
`);
}

function toSafeClassName(value) {
  const normalized = String(value).trim().replace(/[^a-zA-Z0-9]+/g, ' ');
  const parts = normalized
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return 'BaselineMigration';
  }

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function listMigrationFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith('.ts'))
    .sort();
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed.`);
  }
}

function ensureUuidExtensionMigration(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');

  if (source.includes('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')) {
    return;
  }

  const upMethodSignature =
    '  public async up(queryRunner: QueryRunner): Promise<void> {';

  if (!source.includes(upMethodSignature)) {
    throw new Error(`Could not find migration up() method in ${filePath}.`);
  }

  const updatedSource = source.replace(
    upMethodSignature,
    `${upMethodSignature}\n    await queryRunner.query(\`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"\`);`,
  );

  fs.writeFileSync(filePath, updatedSource);
}

function main() {
  const options = parseArgs(process.argv);

  if (options.help || !options.app) {
    usage();
    return;
  }

  const selectedApp = APPS[options.app];

  if (!selectedApp) {
    throw new Error(
      `Unsupported app "${options.app}". Use tiramis or insurance-portal-service.`,
    );
  }

  const className = toSafeClassName(options.name || selectedApp.filePrefix);
  const migrationTarget = path.join(selectedApp.migrationsDir, className);

  fs.mkdirSync(selectedApp.migrationsDir, { recursive: true });

  const beforeFiles = new Set(listMigrationFiles(selectedApp.migrationsDir));

  runCommand('node', [
    '-r',
    'ts-node/register',
    '-r',
    'tsconfig-paths/register',
    './node_modules/typeorm/cli.js',
    '-d',
    selectedApp.dataSource,
    'migration:generate',
    migrationTarget,
  ]);

  const afterFiles = listMigrationFiles(selectedApp.migrationsDir);
  const createdFiles = afterFiles
    .filter((fileName) => !beforeFiles.has(fileName))
    .map((fileName) => path.join(selectedApp.migrationsDir, fileName));

  if (createdFiles.length === 0) {
    throw new Error('TypeORM did not create a migration file.');
  }

  for (const createdFile of createdFiles) {
    ensureUuidExtensionMigration(createdFile);
  }

  runCommand('npx', ['prettier', '--write', ...createdFiles]);

  for (const createdFile of createdFiles) {
    console.log(`Generated migration: ${createdFile}`);
  }
}

main();
