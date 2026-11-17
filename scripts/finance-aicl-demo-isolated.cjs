/* Disposable local clone and G04 rehearsal. Never writes to the source database. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');

const repo = path.resolve(__dirname, '..');
const source = dotenv.parse(
  fs.readFileSync(path.join(repo, 'apps/insurance-portal-service/.env')),
);
if (
  !['localhost', '127.0.0.1', '::1'].includes(source.DB_HOST) ||
  !source.DB_DATABASE ||
  !(source.DB_USERNAME || source.DB_USER) ||
  !source.DB_PASSWORD
)
  throw new Error('A local source database configuration is required.');
const bin =
  process.env.FINANCE_TEST_PG_BIN ||
  path.join(
    process.env.ProgramFiles || 'C:/Program Files',
    'PostgreSQL',
    '18',
    'bin',
  );
const exe = (name) =>
  path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
const owned = fs.mkdtempSync(path.join(os.tmpdir(), 'aicl-finance-rehearsal-'));
const cluster = path.join(owned, 'cluster'),
  dump = path.join(owned, 'source.dump'),
  log = path.join(owned, 'postgres.log');
const password = crypto.randomBytes(24).toString('hex');
const passfile = path.join(owned, 'password');
fs.writeFileSync(passfile, password, { mode: 0o600 });
const suffix = crypto.randomBytes(3).toString('hex');
const template =
  'insurance_portal_test_' +
  new Date().toISOString().replace(/\D/g, '').slice(0, 14) +
  '_' +
  suffix +
  '_g04tpl';
const destinationEnv = { ...process.env, PGPASSWORD: password };
const runnerLog = path.join(owned, 'runner.log');
let started = false;
function command(name, args, env = process.env) {
  const fd = fs.openSync(runnerLog, 'a');
  let result;
  try {
    result = spawnSync(exe(name), args, {
      env,
      stdio: ['ignore', fd, fd],
      windowsHide: true,
      timeout: 600000,
    });
  } finally {
    fs.closeSync(fd);
  }
  if (result.error || result.status !== 0)
    throw new Error(name + ' failed in the isolated rehearsal.');
}
async function main() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  try {
    command('initdb', [
      '-D',
      cluster,
      '-U',
      'finance_test_admin',
      '--auth-local=scram-sha-256',
      '--auth-host=scram-sha-256',
      '--pwfile',
      passfile,
      '--encoding=UTF8',
      '--locale=C',
    ]);
    fs.unlinkSync(passfile);
    command('pg_ctl', [
      '-D',
      cluster,
      '-l',
      log,
      '-o',
      `-h 127.0.0.1 -p ${port}`,
      '-w',
      '-t',
      '30',
      'start',
    ]);
    started = true;
    console.log(
      'Private PostgreSQL started; copying the local source read-only.',
    );
    command(
      'pg_dump',
      [
        '-h',
        source.DB_HOST,
        '-p',
        source.DB_PORT || '5432',
        '-U',
        source.DB_USERNAME || source.DB_USER,
        '-d',
        source.DB_DATABASE,
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '-f',
        dump,
      ],
      { ...process.env, PGPASSWORD: source.DB_PASSWORD },
    );
    command(
      'createdb',
      [
        '-h',
        '127.0.0.1',
        '-p',
        String(port),
        '-U',
        'finance_test_admin',
        template,
      ],
      destinationEnv,
    );
    command(
      'pg_restore',
      [
        '-h',
        '127.0.0.1',
        '-p',
        String(port),
        '-U',
        'finance_test_admin',
        '-d',
        template,
        '--no-owner',
        '--no-privileges',
        '--exit-on-error',
        dump,
      ],
      destinationEnv,
    );
    console.log('Private template restored; running AICL G04 rehearsal.');
    const reports = [];
    for (const bookCode of ['AICL-IFRS-GL']) {
      console.log('Rehearsing three books in one disposable database.');
      const result = spawnSync(
        process.execPath,
        [path.join(repo, 'scripts/finance-g04-rehearsal.cjs')],
        {
          cwd: repo,
          windowsHide: true,
          encoding: 'utf8',
          timeout: 600000,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            APP_ENV: 'test',
            FINANCE_TEST_PG_ENABLED: '1',
            FINANCE_TEST_PG_HOST: '127.0.0.1',
            FINANCE_TEST_PG_PORT: String(port),
            FINANCE_TEST_PG_USER: 'finance_test_admin',
            FINANCE_TEST_PG_PASSWORD: password,
            FINANCE_G04_CLUSTER_DIRECTORY: cluster,
            FINANCE_G04_TEST_DATABASE: template,
            FINANCE_G04_AICL_DEMO: '1',
            FINANCE_G04_INTEGRATED: '1',
            FINANCE_G04_AICL_BOOK: bookCode,
            FINANCE_G04_OUTPUT: path.join(owned, 'result.json'),
          },
        },
      );
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr)
        process.stderr.write(result.stderr.replaceAll(password, '[redacted]'));
      if (result.error || result.status !== 0) {
        if (fs.existsSync(path.join(owned, 'result.json'))) {
          const report = JSON.parse(
            fs.readFileSync(path.join(owned, 'result.json'), 'utf8'),
          );
          console.error(
            JSON.stringify({
              checks: report.checks?.length,
              failure: report.failure,
              detail: report.failureDetails?.detail,
            }),
          );
        }
        throw new Error('AICL G04 rehearsal failed.');
      }
      const report = JSON.parse(
        fs.readFileSync(path.join(owned, 'result.json'), 'utf8'),
      );
      reports.push({
        purpose: 'ISOLATED_SYNTHETIC_DEMONSTRATION_ONLY',
        startedAt: report.startedAt,
        finishedAt: report.finishedAt,
        passed: report.passed,
        checkCount: report.checks.length,
        checks: report.checks.map(({ name, passed }) => ({ name, passed })),
        companyAcceptanceGranted: report.companyAcceptanceGranted,
        policiesActivated: report.policiesActivated,
        sourceWrites: report.sourceWrites,
        limitations: report.aiclDemo,
        bookRuns: report.bookRuns,
      });
    }
    fs.writeFileSync(
      path.join(repo, 'docs/finance/AICL-G04-Rehearsal-Result.json'),
      JSON.stringify(
        { purpose: 'ISOLATED_INTEGRATED_THREE_BOOK_REHEARSAL', runs: reports },
        null,
        2,
      ) + '\n',
    );
  } finally {
    if (started)
      command('pg_ctl', [
        '-D',
        cluster,
        '-m',
        'fast',
        '-w',
        '-t',
        '30',
        'stop',
      ]);
    const root = path.resolve(os.tmpdir()),
      target = path.resolve(owned);
    if (
      !target.startsWith(root + path.sep) ||
      !path.basename(target).startsWith('aicl-finance-rehearsal-')
    )
      throw new Error('Refusing cleanup of unexpected path.');
    fs.rmSync(target, { recursive: true, force: true });
    console.log('Private cluster stopped and temporary clone removed.');
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
