const { spawnSync } = require('child_process');

const steps = [
  {
    name: 'TIRAMIS service migrations',
    script: 'migration:run:tiramis',
    skipEnv: 'SKIP_TIRAMIS_MIGRATIONS',
  },
  {
    name: 'Portal service migrations',
    script: 'migration:run:insurance-portal-service',
    skipEnv: 'SKIP_PORTAL_MIGRATIONS',
  },
  {
    name: 'TIRAMIS endpoint/config seed',
    script: 'seed:tiramis:config',
    skipEnv: 'SKIP_TIRAMIS_CONFIG_SEED',
  },
  {
    name: 'Portal lookup/config seeds',
    script: 'seed:insurance-portal-service',
    skipEnv: 'SKIP_PORTAL_SEED',
  },
];

function isSkipped(step) {
  return ['1', 'true', 'yes'].includes(
    String(process.env[step.skipEnv] || '').toLowerCase(),
  );
}

for (const step of steps) {
  if (isSkipped(step)) {
    console.log(`SKIP ${step.name} (${step.skipEnv})`);
    continue;
  }

  console.log(`\n========== ${step.name} ==========`);
  const result = spawnSync('npm', ['run', step.script], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('\nTIRAMIS compliance database preparation complete.');
