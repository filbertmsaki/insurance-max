const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../../../..');
const executable = (name) =>
  name + (process.platform === 'win32' ? '.exe' : '');

function postgresBin() {
  if (process.env.FINANCE_TEST_PG_BIN) {
    return path.resolve(process.env.FINANCE_TEST_PG_BIN);
  }
  if (process.platform === 'win32') {
    const base = path.join(
      process.env.ProgramFiles || 'C:/Program Files',
      'PostgreSQL',
    );
    if (fs.existsSync(base)) {
      const versions = fs
        .readdirSync(base)
        .filter((v) => /^\d+(?:\.\d+)*$/.test(v));
      versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      for (const version of versions) {
        const bin = path.join(base, version, 'bin');
        if (fs.existsSync(path.join(bin, executable('initdb')))) return bin;
      }
    }
  }
  throw new Error(
    'Set FINANCE_TEST_PG_BIN to an existing PostgreSQL bin directory. This runner installs nothing.',
  );
}

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function main() {
  const bin = postgresBin();
  for (const name of ['initdb', 'pg_ctl']) {
    if (!fs.existsSync(path.join(bin, executable(name))))
      throw new Error(`Missing PostgreSQL ${name} executable.`);
  }
  const argument = process.argv.indexOf('--evidence-dir');
  if (argument >= 0 && !process.argv[argument + 1])
    throw new Error('--evidence-dir requires a directory.');
  const selection = process.argv.indexOf('--test-file');
  const selected = selection >= 0 ? process.argv[selection + 1] : null;
  if (
    selection >= 0 &&
    (!selected ||
      !/^finance-[a-z-]+\.finance-integration\.ts$/.test(selected) ||
      !fs.existsSync(path.join(__dirname, selected)))
  )
    throw new Error(
      '--test-file requires an existing dedicated Finance integration filename.',
    );
  const ownedRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'insurance-finance-'),
  );
  const cluster = path.join(ownedRoot, 'cluster');
  const evidence =
    argument >= 0
      ? path.resolve(process.argv[argument + 1])
      : path.join(ownedRoot, 'evidence');
  fs.mkdirSync(evidence, { recursive: true });
  const password = randomBytes(24).toString('hex');
  const passwordFile = path.join(ownedRoot, 'init-password');
  fs.writeFileSync(passwordFile, password + '\n', { mode: 0o600 });
  const port = await unusedPort();
  const record = {
    cluster,
    host: '127.0.0.1',
    port,
    started: false,
    stopped: false,
    testExitCode: null,
    cleanupError: null,
    selectedTestFile: selected,
    testProcessTimeoutMs: 600000,
    testProcessErrorCode: null,
  };
  function pg(name, args) {
    const log = path.join(evidence, 'postgres-lifecycle.log');
    fs.appendFileSync(log, `${name}\n`);
    const offset = fs.statSync(log).size;
    const descriptor = fs.openSync(log, 'a');
    let result;
    try {
      // Background postgres can inherit pg_ctl's pipe handles on Windows.
      // A file descriptor lets the control command return without waiting for
      // the server's lifetime. It also retains startup failures for review.
      result = spawnSync(path.join(bin, executable(name)), args, {
        stdio: ['ignore', descriptor, descriptor],
        windowsHide: true,
        timeout: 60000,
      });
    } finally {
      fs.closeSync(descriptor);
    }
    if (result.error || result.status !== 0)
      throw new Error(
        `Isolated PostgreSQL ${name} failed. See ${path.join(evidence, 'postgres-lifecycle.log')}`,
      );
    return fs.readFileSync(log).subarray(offset).toString('utf8');
  }
  let failure;
  try {
    record.postgresVersion = pg('initdb', ['--version']).trim();
    pg('initdb', [
      '-D',
      cluster,
      '-U',
      'finance_test_admin',
      '--auth-local=scram-sha-256',
      '--auth-host=scram-sha-256',
      '--pwfile',
      passwordFile,
      '--encoding=UTF8',
      '--locale=C',
    ]);
    fs.unlinkSync(passwordFile);
    pg('pg_ctl', [
      '-D',
      cluster,
      '-l',
      path.join(ownedRoot, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${port}`,
      '-w',
      '-t',
      '30',
      'start',
    ]);
    record.started = true;
    const result = spawnSync(
      process.execPath,
      [
        path.join(repo, 'node_modules/jest/bin/jest.js'),
        '--config',
        path.join(__dirname, '../jest-finance-integration.json'),
        '--runInBand',
        ...(selected
          ? ['--runTestsByPath', path.join(__dirname, selected)]
          : []),
        '--passWithNoTests=false',
        '--coverage=false',
        '--cacheDirectory',
        path.join(ownedRoot, 'jest-cache'),
        '--json',
        '--outputFile',
        path.join(evidence, 'jest-results.json'),
      ],
      {
        cwd: repo,
        encoding: 'utf8',
        windowsHide: true,
        // B12 adds owned-exception databases to the B11 compatibility coverage.
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
          FINANCE_TEST_PG_CLUSTER_DIRECTORY: cluster,
        },
      },
    );
    fs.writeFileSync(
      path.join(evidence, 'jest-run.log'),
      (result.stdout || '') + (result.stderr || ''),
    );
    record.testExitCode = result.status ?? 1;
    record.testProcessErrorCode = result.error?.code ?? null;
    if (result.error)
      throw new Error(
        'Finance integration runner failed or timed out; see the retained run log.',
      );
    if (result.status !== 0)
      throw new Error(
        'Finance integration tests failed; see the retained Jest results.',
      );
  } catch (error) {
    failure = error;
  } finally {
    // Only this invocation's private cluster. No stale/global DB cleanup.
    if (fs.existsSync(path.join(cluster, 'postmaster.pid'))) {
      try {
        pg('pg_ctl', ['-D', cluster, '-m', 'fast', '-w', '-t', '30', 'stop']);
        record.stopped = true;
      } catch (error) {
        record.cleanupError = error.message;
        failure = failure
          ? new AggregateError(
              [failure, error],
              'Test run and private-cluster cleanup failed.',
            )
          : error;
      }
    }
    if (fs.existsSync(passwordFile)) fs.unlinkSync(passwordFile);
    fs.writeFileSync(
      path.join(evidence, 'cluster-lifecycle.json'),
      JSON.stringify(record, null, 2),
    );
  }
  if (failure) throw failure;
  console.log(
    `Finance integration tests passed. Private PostgreSQL cluster stopped. Evidence: ${evidence}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
