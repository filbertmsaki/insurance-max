import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

const migrationRoots = [
  'apps/insurance-portal-service/src/database/migrations',
  'apps/tiramis/src/database/migrations',
];

const baselinePath = path.join(cwd, 'config/phase0/migration-baseline.json');

const baseline = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  : { allowedDuplicateTimestamps: {} };

const errors = [];

const sorted = (values) =>
  [...values].sort((left, right) => left.localeCompare(right));

for (const root of migrationRoots) {
  const absoluteRoot = path.join(cwd, root);

  if (!fs.existsSync(absoluteRoot)) {
    errors.push(`Migration directory does not exist: ${root}`);
    continue;
  }

  const files = fs
    .readdirSync(absoluteRoot)
    .filter((file) => file.endsWith('.ts'))
    .sort();

  const byTimestamp = new Map();
  const migrationNames = new Map();

  for (const file of files) {
    const filenameMatch = /^(\d{13})-[A-Za-z0-9-]+\.ts$/.exec(file);

    if (!filenameMatch) {
      errors.push(
        `${root}/${file}: filename must begin with a 13-digit timestamp`,
      );
      continue;
    }

    const timestamp = filenameMatch[1];
    const filePath = path.join(absoluteRoot, file);
    const source = fs.readFileSync(filePath, 'utf8');

    const classMatch =
      /export\s+class\s+([A-Za-z0-9_]+)(\d{13})\s+implements\s+MigrationInterface/.exec(
        source,
      );

    const nameMatch = /\bname\s*=\s*['"]([^'"]+)['"]/.exec(source);

    if (!classMatch) {
      errors.push(
        `${root}/${file}: migration class must end with its timestamp`,
      );
    } else if (classMatch[2] !== timestamp) {
      errors.push(
        `${root}/${file}: class timestamp ${classMatch[2]} does not match filename ${timestamp}`,
      );
    }

    if (nameMatch) {
      const migrationName = nameMatch[1];

      if (!migrationName.endsWith(timestamp)) {
        errors.push(
          `${root}/${file}: migration name must end with ${timestamp}`,
        );
      }

      const previousFile = migrationNames.get(migrationName);

      if (previousFile) {
        errors.push(
          `${root}/${file}: duplicate migration name also used by ${previousFile}`,
        );
      }

      migrationNames.set(migrationName, file);
    }

    const filesForTimestamp = byTimestamp.get(timestamp) ?? [];
    filesForTimestamp.push(file);
    byTimestamp.set(timestamp, filesForTimestamp);
  }

  for (const [timestamp, duplicateFiles] of byTimestamp.entries()) {
    if (duplicateFiles.length < 2) {
      continue;
    }

    const allowed =
      baseline.allowedDuplicateTimestamps?.[root]?.[timestamp] ?? [];

    const duplicateSet = JSON.stringify(sorted(duplicateFiles));
    const allowedSet = JSON.stringify(sorted(allowed));

    if (duplicateSet !== allowedSet) {
      errors.push(
        `${root}: timestamp ${timestamp} is duplicated by ${duplicateFiles.join(
          ', ',
        )}`,
      );
    }
  }

  console.log(`Checked ${files.length} migrations in ${root}`);
}

if (errors.length > 0) {
  console.error('\nMigration validation failed:');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log('Migration validation passed.');
