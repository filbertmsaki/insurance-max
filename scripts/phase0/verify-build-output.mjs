import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

const requiredFiles = [
  'dist/apps/tiramis/apps/tiramis/src/main.js',

  'dist/apps/tiramis/apps/tiramis/src/database/data-source.js',

  'dist/apps/insurance-portal-service/apps/insurance-portal-service/src/main.js',

  'dist/apps/insurance-portal-service/apps/insurance-portal-service/src/database/data-source.js',

  'apps/insurance-portal-web/dist/index.html',

  'apps/insurance-portal-web/dist/health.json',
];

const missingFiles = requiredFiles.filter(
  (relativePath) => !fs.existsSync(path.join(cwd, relativePath)),
);

if (missingFiles.length > 0) {
  console.error('Build output verification failed:');

  for (const file of missingFiles) {
    console.error(`- Missing ${file}`);
  }

  process.exit(1);
}

console.log('All three application build outputs were verified.');
