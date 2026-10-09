# Tiramis Ubuntu server setup

`setup-server.sh` prepares an Ubuntu 20.04, 22.04, or 24.04 x86_64 server for
the Tiramis API. Run it from the deployment folder or copy the file to the
server. It needs root access and an internet connection for Ubuntu packages and
Node.js 24.

## Run the installer

```bash
sudo bash setup-server.sh
```

The installer asks for a deployment username and a password twice. Password
entry is hidden and accepts five or more characters. For an existing account,
the script preserves its home, shell, groups, and current password unless you
choose to change that password.

It detects an installed Apache or Nginx service and asks whether to reuse it.
When neither is installed, select Apache, Nginx, or `skip`. The default
application port is `9090`, API proxy prefix `/tiramis-api`, app root
`/opt/apps/tiramis`, and PM2 logs `/var/log/pm2`.
Ports and paths can be set explicitly:

```bash
sudo bash setup-server.sh \
  --user deploy \
  --base-dir /opt/apps/tiramis \
  --log-dir /var/log/pm2 \
  --web-server nginx \
  --app-port 9090 \
  --api-prefix /tiramis-api
```

The host address is detected for the proxy site name by default. Use `--domain`
to provide a DNS name. The script does not ask for public IP/CIDR addresses.
UFW stays unchanged unless explicitly enabled with `--approve-ufw`; that option
requires `--admin-cidr` so the installer can allow SSH from your trusted source.
TIRAMIS exposes the HTTP API only.

The installer asks whether to install PostgreSQL locally. Choose no when the
database is hosted elsewhere. It does not create database roles or ask for
database credentials. To install a local PostgreSQL server without the prompt:

```bash
sudo bash setup-server.sh --with-postgres --web-server nginx
```

For noninteractive setup, pass `--user` and `--web-server`; account password
entry remains interactive and secure. Run `bash setup-server.sh --help` for all
options.

## What it prepares

- Requires Node.js 24 (installs it if absent), npm, PM2, build tools, PostgreSQL client utilities and
  other runtime prerequisites.
- Creates the deployment account if absent, with no sudo grant. A pre-existing
  account is not silently reconfigured.
- Creates `releases`, `shared`, `certificates/live`, `certificates/test`, and
  persistent request-log folders under the app root with deployment ownership.
- Creates `shared/.env` with restrictive permissions if it is absent. An
  existing file is preserved. The PM2 ecosystem file and deploy script are
  installed into `shared/` by the CI workflow from `deploy/tiramis/`, not by
  this script.
- Configures PM2 systemd startup.
- Optionally configures a dedicated Apache or Nginx reverse-proxy site. Existing
  Tiramis site files require confirmation before replacement. Other sites are
  left alone.
- Optionally allows UFW rules, only when explicitly approved.

This prepares the server; it does not deploy a release or start the application.
The environment template leaves the DB password, TIRA credentials, TIRA
certificate passwords, and `PORTAL_ADMIN_JWT_ACCESS_SECRET` (must equal the
portal `JWT_ACCESS_SECRET`) blank. `APP_URL` and the TIRA
base URLs are commented `REQUIRED` lines; an empty value fails startup
validation. Edit `/opt/apps/tiramis/shared/.env` (or your chosen app root)
before deployment. Supply the certificates separately as
`certificates/{live,test}/clientprivate.pfx` and `tiramispublic.pfx`. If no TLS certificate is supplied, configure TLS with
Certbot after DNS points at the server.

## Deploy the application

Once the environment and certificates are configured, use the existing
GitHub Actions deployment workflow. The setup script does not change the
workflow, runner labels, or any currently running application. Register or
configure the runner separately according to the repository's deployment
README.

If the script is interrupted, review the displayed error and rerun it. It
preserves an existing environment file. Review the generated files before the
first production deployment.

Hosts prepared with an earlier version of this script may still have a
`bridge` proxy site and `ecosystem.config.js`/`deploy.sh` directly in the app
root. The script warns about an enabled `bridge` site. Disable that site once
the `tiramis` site is verified. The root-level helper files are unused and
can be removed.
