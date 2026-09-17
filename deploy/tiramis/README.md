# Tiramis production deployment

The `Insurance Max - Tiramis CI/CD` workflow currently deploys only to server 1
using its original `tiramis-self-hosted-runner` label. No runner configuration
change is needed on that server. Server 2 is not set up and is disabled in the
deployment matrix, so the workflow will not queue a job or wait for it.

When server 2 is enabled, the workflow deploys the same release artifact to both
servers, one server at a time. A failed
deployment stops the remaining rollout. Production workflow runs cannot overlap,
including their database migrations. A successful first deployment is not
automatically rolled back if the other server fails.

## One-command setup for server 2

Copy `setup-server.sh` to server 2 and run it on **Ubuntu/Debian x64 with
systemd**:

```bash
sudo bash setup-server.sh
```

The default deployment user is `alliance`. To choose another account:

```bash
sudo bash setup-server.sh --user deploy
```

The script installs:

- Node.js 22 and npm if Node is absent, plus PM2.
- Python 3, Git, curl, OpenSSL, archive tools, and native package build tools.
- PostgreSQL client tools (`psql` and `pg_dump`) from the OS package repository.
- PM2 systemd startup for the deployment account.

It creates the user if missing and prepares these directories with ownership
assigned to that user and mode `750`:

```text
/opt/apps/tiramis/
  releases/
  shared/
  certificates/
    live/
    test/
/opt/actions-runner-tiramis-server-2/
```

It grants access to `/var/log/pm2` using ACLs, preserving that shared directory's
owner. Existing files and release contents are preserved. The deployment user
is not granted sudo privileges or a login password. Configure SSH access
separately if needed. An existing system Node version other than 22 must be
upgraded deliberately before running setup.

For a database hosted **on server 2**, optionally install and start PostgreSQL:

```bash
sudo bash setup-server.sh --with-postgres
```

Use the default command when connecting to an existing database on another
server. Database users, passwords, application databases, and network access
are configured manually. The PostgreSQL version comes from the OS repositories;
ensure the client version is compatible with your database before using backups.

After setup, manually:

1. Create `/opt/apps/tiramis/shared/.env` using `shared.env.example`, owned by
   the deployment user with mode `600`.
2. Copy certificate files into `certificates/live` and `certificates/test`,
   readable by that user (typically mode `640`). Setup requires no certificates
   and does not copy, validate, or modify certificate files.
3. Register the GitHub runner under the same user and follow the steps below
   to enable server 2 in the workflow.

For a shared production database, retain server 1's encryption key and set
`TIRAMIS_RETRY_ENABLED=false` on server 2; keep automatic retries on one host.

Deployment installs application npm dependencies, runs migrations, creates the
`current` release symlink, and saves PM2's process list. Setup does not deploy
the app or create an empty PM2 startup dump. Reuse the setup command if it is
interrupted; existing application files are preserved.

## Enable the second server later

In the GitHub repository, open **Settings → Actions → Runners → New self-hosted
runner** and follow the Linux x64 installation instructions on server 2.
Use a different runner name, install it as a service, and assign these
labels (the first three are normally assigned automatically):

| Server | Required labels |
| --- | --- |
| 1 (existing) | `self-hosted`, `linux`, `x64`, `tiramis-self-hosted-runner` |
| 2 (disabled) | `self-hosted`, `linux`, `x64`, `tiramis-server-2` |

Keep `tiramis-self-hosted-runner` exclusive to server 1 and `tiramis-server-2`
exclusive to server 2, so each deployment reaches its intended host.
After preparing server 2 as described below and confirming its runner is online,
uncomment its two-line entry under `jobs.deploy.strategy.matrix.include` in
`.github/workflows/insurance-tiramis-cicd.yml`. Leave that entry commented out
until server 2 is ready. Once enabled, both runners must be available to this
repository before a complete rollout can finish.

## Prepare each server

Match the existing production setup on both servers:

- Install Node.js 22, npm, PM2, Python 3, Bash, curl, tar, sha256sum, and flock.
- Provide `/opt/apps/tiramis/shared/.env` with that server's configuration and
  the certificates and other external files referenced by it.
- Allow the runner service user to manage `/opt/apps/tiramis`, write PM2 logs
  under `/var/log/pm2`, and create PID files under `/opt/apps/tiramis/shared`.
  Run deployments under the account that owns the Tiramis PM2 process.
- Configure Apache's Tiramis reverse proxy on each server. The application
  uses port 9090 by default.

Each host installs dependencies and runs TypeORM migrations before reloading
its local PM2 process. With a shared database, the second migration invocation
normally finds no pending migrations. With separate databases, each database
is migrated separately. Migrations must remain compatible with the old app
version while the other server is awaiting deployment. The workflow does not
roll back database migrations.

## Health URLs

All enabled deployment jobs use the existing `production` GitHub environment and its
protection rules. The existing `INTERNAL_HEALTH_URL` and `PUBLIC_HEALTH_URL`
variables remain shared defaults. If the servers use different URLs, add these
optional variables to that environment:

| Variable | Purpose |
| --- | --- |
| `TIRAMIS_SERVER_1_INTERNAL_HEALTH_URL` | Server 1 application health URL |
| `TIRAMIS_SERVER_2_INTERNAL_HEALTH_URL` | Server 2 application health URL |
| `TIRAMIS_SERVER_1_PUBLIC_HEALTH_URL` | Server 1 Apache health URL |
| `TIRAMIS_SERVER_2_PUBLIC_HEALTH_URL` | Server 2 Apache health URL |

The internal default is `http://127.0.0.1:9090/api/health`; keep internal checks
local to each host. The public default is
`https://ussdvd.alliance.co.tz/tiramis-api/api/health`. The Apache check resolves
the configured public hostname and port to `127.0.0.1`, so it checks the server
being deployed even if public DNS points at a load balancer.

## Running a deployment

- A matching push to `main` builds, tests, and deploys to enabled servers (currently server 1 only).
- Pull requests and manual runs without `run_id` only build and test.
- A manual run with a previous successful run's `run_id` deploys its exact
  artifact to enabled servers without rebuilding.

After a failed rollout, inspect the per-server job logs and fix the failure
before retrying. The GitHub concurrency group retains at most one pending run
by default; a newer pending production run can replace an older pending run.

This workflow deploys the application. Traffic routing, load balancer membership,
and any shared storage or application coordination must be configured separately
if both servers will serve the same service endpoint.
