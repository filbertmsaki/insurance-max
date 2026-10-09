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

## One-command Ubuntu server setup

`setup-server.sh` supports Ubuntu 20.04, 22.04, and 24.04 x86_64. Copy the
deployment folder to the host, then run:

```bash
sudo bash setup-server.sh
```

The installer prompts securely for a deployment username and password, detects
an existing Apache or Nginx installation, and lets you choose whether to reuse
it, install a server, or skip proxy configuration. Existing deployment accounts
and app environment/config files are preserved; an existing account's password
changes only if you opt in. It requires Node.js 24 (and installs it if absent), PM2, PostgreSQL client tools,
and prepares the app folders, environment template, proxy site, permissions,
and PM2 systemd startup.

Defaults are `/opt/apps/tiramis`, `/var/log/pm2`, HTTP port `9090`, and
`/tiramis-api`. Override settings as needed:

```bash
sudo bash setup-server.sh --user deploy --base-dir /opt/apps/tiramis \
  --web-server nginx --app-port 9090 \
  --api-prefix /tiramis-api --domain api.example.com
```

Database credentials and TIRA settings are not prompted for; the generated
`shared/.env` leaves them blank for configuration before deployment. The
installer asks whether to install PostgreSQL locally. UFW remains untouched
unless you pass `--approve-ufw` and a trusted `--admin-cidr`.

See [UBUNTU_SERVER_SETUP.md](UBUNTU_SERVER_SETUP.md) for the full setup guide
and `bash setup-server.sh --help` for supported options. Setup prepares the host
but does not deploy app code or configure a GitHub runner. Configure server 2's
runner and workflow labels using the instructions below when it is ready.

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

- Install Node.js 24, npm, PM2, Python 3, Bash, curl, tar, sha256sum, and flock.
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
`https://api.example.com/tiramis-api/api/health`. The Apache check resolves
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
