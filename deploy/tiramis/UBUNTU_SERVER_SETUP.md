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
application port is `9090`, internal TCP port `4001`, API proxy prefix
`/tiramis-api`, app root `/opt/apps/tiramis`, and PM2 logs `/var/log/pm2`.
Ports and paths can be set explicitly:

```bash
sudo bash setup-server.sh \
  --user deploy \
  --base-dir /opt/apps/tiramis \
  --log-dir /var/log/pm2 \
  --web-server nginx \
  --app-port 9090 \
  --tcp-port 4001 \
  --api-prefix /tiramis-api
```

The host address is detected for the proxy site name by default. Use `--domain`
to provide a DNS name. The script does not ask for public IP/CIDR addresses.
UFW stays unchanged unless explicitly enabled with `--approve-ufw`; that option
requires `--admin-cidr` so the installer can allow SSH from your trusted source.
Use repeatable `--portal-cidr` options to add TCP gateway firewall rules.

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
- Creates `shared/.env` with restrictive permissions, PM2 ecosystem and a
  deployment helper if those files are absent. Existing files are preserved.
- Configures PM2 systemd startup.
- Optionally configures a dedicated Apache or Nginx reverse-proxy site. Existing
  Tiramis site files require confirmation before replacement. Other sites are
  left alone.
- Optionally allows UFW rules, only when explicitly approved.

This prepares the server; it does not deploy a release or start the application.
The environment template leaves the DB password, TIRA URLs and credentials,
TIRA certificate passwords, and bootstrap API key blank. Edit
`/opt/apps/tiramis/shared/.env` (or your chosen app root) before deployment.
Supply `.pfx` files separately under `certificates/live` and
`certificates/test`. If no TLS certificate is supplied, configure TLS with
Certbot after DNS points at the server.

## Deploy the application

Once the environment and certificates are configured, use the existing
GitHub Actions deployment workflow. The setup script does not change the
workflow, runner labels, or any currently running application. Register or
configure the runner separately according to the repository's deployment
README.

If the script is interrupted, review the displayed error and rerun it. It
preserves existing environment, ecosystem, and deployment-helper files. Review
the generated files before the first production deployment.
