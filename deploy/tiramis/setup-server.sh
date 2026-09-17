#!/usr/bin/env bash
# Basic TIRAMIS server prerequisites. Run on Ubuntu/Debian x64 with sudo.
set -Eeuo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

usage() {
  cat <<'USAGE'
Usage: sudo bash setup-server.sh [--user alliance] [--with-postgres]

Installs Node.js 22, npm, PM2, native build tools, and PostgreSQL
client tools. Creates the deployment user, app/runner folders, permissions,
and PM2 boot startup. No certificates, .env, or GitHub token are needed.

  --user NAME       Deployment/PM2 account (default: alliance)
  --with-postgres   Also install and start a local PostgreSQL server
  --help            Show this help

Configure .env, certificates, GitHub runner, and database credentials
manually afterward. Application npm dependencies are installed by deployment.
USAGE
}

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
DEPLOY_USER=alliance
WITH_POSTGRES=false
BASE_DIR=/opt/apps/tiramis
WORK_DIR=''

while (($#)); do
  case "$1" in
    --user)
      [[ $# -ge 2 && -n "$2" && "$2" != --* ]] || die '--user needs a value'
      DEPLOY_USER=$2; shift 2 ;;
    --with-postgres) WITH_POSTGRES=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done

[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ && "$DEPLOY_USER" != root ]] || die 'Choose a valid non-root deployment user'
[[ $EUID -eq 0 ]] || die 'Run with sudo bash setup-server.sh'
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || die 'Requires Linux x64'
[[ -f /etc/os-release && -d /run/systemd/system ]] || die 'Requires a systemd Linux host'
# shellcheck source=/dev/null
. /etc/os-release
[[ "$ID" == ubuntu || "$ID" == debian ]] || die 'Only Ubuntu and Debian are supported'

# Avoid replacing a different system Node used by other hosted applications.
if command -v node >/dev/null; then
  [[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]] ||
    die 'Existing Node is not v22. Upgrade it to Node 22 before running setup.'
fi
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  [[ "$(id -u "$DEPLOY_USER")" != 0 ]] || die 'Deployment account must not have UID 0'
fi

exec 9>/run/lock/tiramis-server-setup.lock
flock -n 9 || die 'Another setup is running'
WORK_DIR=$(mktemp -d /tmp/tiramis-setup.XXXXXXXX)
trap 'rm -rf -- "$WORK_DIR"' EXIT
trap 'printf "Setup failed at line %s. Fix the error and rerun.\n" "$LINENO" >&2' ERR

printf '\nInstalling server dependencies...\n'
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  ca-certificates curl git python3 tar gzip coreutils util-linux \
  build-essential pkg-config openssl acl postgresql-client

if ! command -v node >/dev/null; then
  curl --fail --silent --show-error --location --retry 3 \
    https://deb.nodesource.com/setup_22.x -o "$WORK_DIR/nodesource.sh"
  bash "$WORK_DIR/nodesource.sh"
  apt-get install -y nodejs
fi
command -v npm >/dev/null || die 'npm is missing from the system PATH'
if ! command -v pm2 >/dev/null; then npm install -g pm2; fi

if "$WITH_POSTGRES"; then
  apt-get install -y postgresql
  systemctl enable --now postgresql
fi

printf '\nPreparing user and directories...\n'
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
DEPLOY_GROUP=$(id -gn "$DEPLOY_USER")
DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
[[ "$DEPLOY_HOME" == /* && "$DEPLOY_HOME" != / && -d "$DEPLOY_HOME" ]] || die 'Deployment user needs a valid home'

# Set ownership on these directories only; preserve existing files and releases.
for dir in "$BASE_DIR" "$BASE_DIR/releases" "$BASE_DIR/shared" \
  "$BASE_DIR/certificates" "$BASE_DIR/certificates/live" "$BASE_DIR/certificates/test" \
  /opt/actions-runner-tiramis-server-2; do
  [[ ! -L "$dir" ]] || die "Expected a real directory, not a symlink: $dir"
  install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 750 "$dir"
done

# Other applications may share this log directory. Keep its existing owner.
mkdir -p /var/log/pm2
setfacl -m "u:$DEPLOY_USER:rwx" /var/log/pm2
setfacl -d -m "u:$DEPLOY_USER:rwx" /var/log/pm2
for logfile in /var/log/pm2/tiramis-out.log /var/log/pm2/tiramis-error.log; do
  if [[ -e "$logfile" ]]; then setfacl -m "u:$DEPLOY_USER:rw" "$logfile"; fi
done

printf '\nEnabling PM2 startup...\n'
pm2 startup systemd -u "$DEPLOY_USER" --hp "$DEPLOY_HOME"
# deploy.sh saves the process list after starting TIRAMIS. Do not overwrite an
# existing PM2 dump with an empty list during setup.
runuser -u "$DEPLOY_USER" -- env HOME="$DEPLOY_HOME" PATH="$PATH" node --version
runuser -u "$DEPLOY_USER" -- env HOME="$DEPLOY_HOME" PATH="$PATH" npm --version
runuser -u "$DEPLOY_USER" -- env HOME="$DEPLOY_HOME" PATH="$PATH" pm2 --version
psql --version
pg_dump --version

cat <<DONE

Basic server setup complete. Deployment user: $DEPLOY_USER

App:          $BASE_DIR
Releases:     $BASE_DIR/releases
Environment:  $BASE_DIR/shared/.env (create manually, owner $DEPLOY_USER, mode 600)
Certificates: $BASE_DIR/certificates/{live,test} (copy manually, mode 640)
Runner:       /opt/actions-runner-tiramis-server-2
PM2 logs:     /var/log/pm2

Next: add .env and certificates, configure the GitHub runner,
then enable server 2 in the deployment workflow. Use $DEPLOY_USER for PM2
and the runner. The deployment creates the current symlink and installs npm
packages. Database users, passwords, and application databases are manual.
DONE
