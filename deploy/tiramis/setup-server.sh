#!/usr/bin/env bash
# Interactive, repeatable Ubuntu host setup for the Bridge TR service.
set -Eeuo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

usage() {
  cat <<'USAGE'
Usage: sudo bash setup-server.sh [options]

Prepares Ubuntu 20.04/22.04/24.04 x86_64 for Bridge TR: deployment account,
Node.js 22, PM2, app directories and permissions, environment template,
systemd startup, optional Apache/Nginx reverse proxy and optional UFW rules.

Options:
  --user NAME             Deployment account (prompted when omitted)
  --base-dir PATH         App root (default /opt/apps/trbrdg)
  --log-dir PATH          PM2 log directory (default /var/log/pm2)
  --web-server VALUE      apache|nginx|skip (prompted/detected when omitted)
  --app-port PORT         Local HTTP port (default 8090)
  --tcp-port PORT         Internal TCP gateway port (default 4001)
  --api-prefix PATH       Reverse-proxy prefix (default /bridge-api)
  --domain NAME           API hostname (auto-detected when omitted)
  --admin-cidr CIDR       Trusted SSH source; only needed with --approve-ufw
  --portal-cidr CIDR      Allow TCP gateway from this source (repeatable)
  --db-host HOST          Database host to write into a new .env
  --db-port PORT          Database port (default 5432)
  --db-user USER          Database user (default bridge)
  --db-name NAME          Database name (default bridge_db)
  --db-ssl true|false     Database TLS (default true)
  --tls-cert PATH         Full-chain TLS certificate (use with --tls-key)
  --tls-key PATH          TLS private key (use with --tls-cert)
  --with-postgres         Install PostgreSQL locally (database role setup manual)
  --approve-ufw           Enable UFW after adding SSH and configured service rules
  --help                  Show this help

TIRA URLs, client keys/passwords, bootstrap API key, and DB password are left
blank in shared/.env for you to configure. Existing .env and user settings are
preserved. This prepares the host; it does not deploy application code.
USAGE
}
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
info() { printf '\n==> %s\n' "$*"; }
prompt() { local __var=$1 label=$2 default=${3-} answer; read -r -p "$label${default:+ [$default]}: " answer; printf -v "$__var" '%s' "${answer:-$default}"; }
prompt_secret() { local __var=$1 label=$2 answer confirm; while :; do read -r -s -p "$label: " answer; printf '\n'; read -r -s -p 'Confirm password: ' confirm; printf '\n'; [[ "$answer" == "$confirm" ]] || { printf 'Passwords did not match. Try again.\n' >&2; continue; }; ((${#answer} >= 5)) || { printf 'Use at least 5 characters.\n' >&2; continue; }; printf -v "$__var" '%s' "$answer"; return; done; }
valid_port() { [[ "$1" =~ ^[0-9]+$ ]] && ((10#$1 > 0 && 10#$1 <= 65535)); }
valid_cidr() { python3 - "$1" <<'PY'
import ipaddress,sys
try: ipaddress.ip_network(sys.argv[1], strict=False)
except ValueError: sys.exit(1)
PY
}

DEPLOY_USER=''; BASE_DIR=/opt/apps/trbrdg; LOG_DIR=/var/log/pm2; WEB_SERVER=''; APP_PORT=8090; TCP_PORT=4001; API_PREFIX=/bridge-api; DOMAIN=''; ADMIN_CIDR=''; PORTAL_CIDRS=(); DB_HOST=''; DB_PORT=5432; DB_USER=bridge; DB_NAME=bridge_db; DB_SSL=true; TLS_CERT=''; TLS_KEY=''; WITH_POSTGRES=false; APPROVE_UFW=false
while (($#)); do
  case "$1" in
    --user|--base-dir|--log-dir|--web-server|--app-port|--tcp-port|--api-prefix|--domain|--admin-cidr|--db-host|--db-port|--db-user|--db-name|--db-ssl|--tls-cert|--tls-key)
      (($# >= 2)) && [[ -n "$2" && "$2" != --* ]] || die "$1 needs a value"
      case "$1" in
        --user) DEPLOY_USER=$2 ;; --base-dir) BASE_DIR=$2 ;; --log-dir) LOG_DIR=$2 ;;
        --web-server) WEB_SERVER=$2 ;; --app-port) APP_PORT=$2 ;; --tcp-port) TCP_PORT=$2 ;;
        --api-prefix) API_PREFIX=$2 ;; --domain) DOMAIN=$2 ;; --admin-cidr) ADMIN_CIDR=$2 ;;
        --db-host) DB_HOST=$2 ;; --db-port) DB_PORT=$2 ;; --db-user) DB_USER=$2 ;;
        --db-name) DB_NAME=$2 ;; --db-ssl) DB_SSL=$2 ;; --tls-cert) TLS_CERT=$2 ;; --tls-key) TLS_KEY=$2 ;;
      esac
      shift 2 ;;
    --portal-cidr) (($# >= 2)) && [[ -n "$2" ]] || die '--portal-cidr needs a value'; PORTAL_CIDRS+=("$2"); shift 2 ;;
    --with-postgres) WITH_POSTGRES=true; shift ;;
    --approve-ufw) APPROVE_UFW=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done
[[ -z "$WEB_SERVER" || "$WEB_SERVER" == apache || "$WEB_SERVER" == nginx || "$WEB_SERVER" == skip ]] || die 'Web server must be apache, nginx, or skip'
[[ "$DEPLOY_USER" == '' || "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || die 'Invalid deployment username'
[[ "$BASE_DIR" == /* && "$BASE_DIR" != *' '* && "$BASE_DIR" != / ]] || die 'App path must be an absolute path without spaces'
[[ "$LOG_DIR" == /* && "$LOG_DIR" != *' '* ]] || die 'Log path must be absolute and contain no spaces'
[[ "$API_PREFIX" =~ ^/[A-Za-z0-9/_-]+$ && "$API_PREFIX" != */ ]] || die 'API prefix must start with / and have no trailing slash'
valid_port "$APP_PORT" || die 'Invalid application port'; valid_port "$TCP_PORT" || die 'Invalid TCP port'; valid_port "$DB_PORT" || die 'Invalid database port'
[[ "$DB_SSL" == true || "$DB_SSL" == false ]] || die 'DB SSL must be true or false'
[[ -z "$TLS_CERT" && -z "$TLS_KEY" || -n "$TLS_CERT" && -n "$TLS_KEY" ]] || die 'Provide both --tls-cert and --tls-key'
[[ "$APP_PORT" != "$TCP_PORT" ]] || die 'Application and TCP ports must differ'
[[ "$APPROVE_UFW" == false || -n "$ADMIN_CIDR" ]] || die '--approve-ufw requires --admin-cidr so SSH access can be allowed safely'
for cidr in "${PORTAL_CIDRS[@]}"; do valid_cidr "$cidr" || die "Invalid portal CIDR: $cidr"; done
[[ -z "$ADMIN_CIDR" ]] || valid_cidr "$ADMIN_CIDR" || die 'Invalid --admin-cidr'

[[ $EUID -eq 0 ]] || die 'Run with sudo: sudo bash setup-server.sh'
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 && -d /run/systemd/system ]] || die 'Requires Ubuntu x86_64 with systemd'
[[ -f /etc/os-release ]] || die 'Cannot identify operating system'
. /etc/os-release
[[ "$ID" == ubuntu && ("${VERSION_ID:-}" == 20.04 || "${VERSION_ID:-}" == 22.04 || "${VERSION_ID:-}" == 24.04) ]] || die 'Supported releases: Ubuntu 20.04, 22.04, and 24.04'

if [[ -z "$DEPLOY_USER" ]]; then read -r -p 'Deployment username [alliance]: ' DEPLOY_USER; DEPLOY_USER=${DEPLOY_USER:-alliance}; fi
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ && "$DEPLOY_USER" != root ]] || die 'Choose a valid non-root deployment username'
if [[ -z "$DOMAIN" ]]; then DOMAIN=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++)if($i=="src"){print $(i+1);exit}}'); DOMAIN=${DOMAIN:-$(hostname -I 2>/dev/null | awk '{print $1}')}; DOMAIN=${DOMAIN:-localhost}; fi
[[ "$DOMAIN" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || die 'Invalid domain/host'
if [[ -z "$WEB_SERVER" ]]; then
  have_apache=false; have_nginx=false
  if command -v apache2 >/dev/null || dpkg-query -W -f='${Status}' apache2 2>/dev/null | grep -q 'install ok installed'; then have_apache=true; fi
  if command -v nginx >/dev/null || dpkg-query -W -f='${Status}' nginx 2>/dev/null | grep -q 'install ok installed'; then have_nginx=true; fi
  if $have_apache && ! $have_nginx; then prompt choice 'Apache is installed. Reuse it? (yes/no/skip)' yes; [[ "$choice" == yes || "$choice" == y ]] && WEB_SERVER=apache || WEB_SERVER=skip
  elif $have_nginx && ! $have_apache; then prompt choice 'Nginx is installed. Reuse it? (yes/no/skip)' yes; [[ "$choice" == yes || "$choice" == y ]] && WEB_SERVER=nginx || WEB_SERVER=skip
  else prompt WEB_SERVER 'Web server (apache/nginx/skip)' nginx; fi
fi
[[ "$WEB_SERVER" == apache || "$WEB_SERVER" == nginx || "$WEB_SERVER" == skip ]] || die 'Choose apache, nginx, or skip'
if [[ "$WITH_POSTGRES" == false ]]; then prompt pg_choice 'Install PostgreSQL server locally? (y/N)' n; [[ "$pg_choice" == y || "$pg_choice" == Y || "$pg_choice" == yes ]] && WITH_POSTGRES=true; fi
if [[ -n "$TLS_CERT" ]]; then [[ -r "$TLS_CERT" && -r "$TLS_KEY" ]] || die 'TLS certificate and key must be readable'; fi

if id "$DEPLOY_USER" >/dev/null 2>&1; then
  [[ "$(id -u "$DEPLOY_USER")" != 0 ]] || die 'Deployment account must not have UID 0'
  printf 'Account %s already exists; its home, shell, groups, and permissions will be preserved.\n' "$DEPLOY_USER"
  read -r -p 'Change this account password? (y/N): ' change_pw
  if [[ "$change_pw" == y || "$change_pw" == Y ]]; then prompt_secret NEW_PASSWORD 'New account password'; printf '%s:%s\n' "$DEPLOY_USER" "$NEW_PASSWORD" | chpasswd; unset NEW_PASSWORD; fi
else
  prompt_secret NEW_PASSWORD 'Set deployment account password'
fi

if command -v node >/dev/null && [[ "$(node -p 'process.versions.node.split(".")[0]')" != 22 ]]; then die 'Existing Node.js is not v22. Upgrade deliberately before setup.'; fi
exec 9>/run/lock/trbrdg-server-setup.lock; flock -n 9 || die 'Another setup is running'
WORK_DIR=$(mktemp -d /tmp/trbrdg-setup.XXXXXXXX); trap 'rm -rf -- "$WORK_DIR"; unset NEW_PASSWORD' EXIT; trap 'printf "Setup failed at line %s. Fix the error and rerun.\n" "$LINENO" >&2' ERR

info 'Installing operating system packages'
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git python3 tar gzip coreutils util-linux build-essential pkg-config openssl acl postgresql-client
if ! command -v node >/dev/null; then curl --fail --silent --show-error --location --retry 3 https://deb.nodesource.com/setup_22.x -o "$WORK_DIR/nodesource.sh"; bash "$WORK_DIR/nodesource.sh"; apt-get install -y nodejs; fi
command -v npm >/dev/null || die 'npm is missing from PATH'
command -v pm2 >/dev/null || npm install -g pm2
if [[ "$WITH_POSTGRES" == true ]]; then apt-get install -y postgresql; systemctl enable --now postgresql; DB_HOST=${DB_HOST:-127.0.0.1}; [[ "$DB_SSL" != true || "$DB_HOST" != 127.0.0.1 ]] || DB_SSL=false; fi

case "$WEB_SERVER" in
  nginx) apt-get install -y nginx; ;;
  apache) apt-get install -y apache2; ;;
esac
if [[ -n "$TLS_CERT" && "$WEB_SERVER" != skip ]]; then apt-get install -y certbot; [[ "$WEB_SERVER" != nginx ]] || apt-get install -y python3-certbot-nginx; [[ "$WEB_SERVER" != apache ]] || apt-get install -y python3-certbot-apache; fi

info 'Preparing deployment account and directories'
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then useradd --create-home --user-group --shell /bin/bash "$DEPLOY_USER"; printf '%s:%s\n' "$DEPLOY_USER" "$NEW_PASSWORD" | chpasswd; unset NEW_PASSWORD; fi
DEPLOY_GROUP=$(id -gn "$DEPLOY_USER"); DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
[[ "$DEPLOY_HOME" == /* && "$DEPLOY_HOME" != / && -d "$DEPLOY_HOME" ]] || die 'Deployment account needs a valid existing home directory'
for dir in "$BASE_DIR" "$BASE_DIR/releases" "$BASE_DIR/shared" "$BASE_DIR/certificates" "$BASE_DIR/certificates/live" "$BASE_DIR/certificates/test" "$BASE_DIR/shared/tira-requests"; do
  [[ ! -L "$dir" ]] || die "Expected a real directory, not symlink: $dir"
  install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 750 "$dir"
done
install -d -m 755 "$LOG_DIR"; setfacl -m "u:$DEPLOY_USER:rwx" "$LOG_DIR"; setfacl -d -m "u:$DEPLOY_USER:rwx" "$LOG_DIR"

info 'Creating environment template and deployment files'
ENV_FILE=$BASE_DIR/shared/.env
if [[ ! -e "$ENV_FILE" ]]; then
  [[ ! -L "$ENV_FILE" ]] || die 'Environment file path must not be a symlink'
  secret=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')
  cat >"$ENV_FILE" <<EOF
APP_NAME=Bridge Service
APP_ENV=production
APP_HOST=0.0.0.0
APP_PORT=$APP_PORT
APP_GLOBAL_PREFIX=api
APP_VERSION=v1
APP_TIMEZONE=Africa/Dar_es_Salaam
APP_URL=
TIRAMIS_TARGET_ENV=live
DB_TYPE=postgres
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USERNAME=$DB_USER
DB_PASSWORD=
DB_DATABASE=$DB_NAME
DB_NAME=$DB_NAME
DB_SCHEMA=public
DB_ORACLE_CONNECT_STRING=
DB_SYNCHRONIZE=false
DB_LOGGING=false
DB_SSL=$DB_SSL
LOGGER_ENABLED=true
LOGGER_LEVEL=log,error,warn
LOGGER_PRETTY=false
TIRAMIS_SECRET_ENCRYPTION_KEY=$secret
TIRAMIS_BOOTSTRAP_API_KEY=
TIRAMIS_CERTIFICATE_BASE_DIR=$BASE_DIR/certificates
TIRAMIS_CERTIFICATE_EXPIRY_WARNING_DAYS=30
ALLIANCE_TIRA_CLIENT_KEY_TEST=
ALLIANCE_CLIENT_PRIVATE_CERT_PASSWORD_TEST=
TIRA_PUBLIC_CERT_PASSWORD_TEST=
TIRAMIS_TEST_BASE_URL=
TIRAMIS_TEST_CALLBACK_URL=
ALLIANCE_TIRA_CLIENT_KEY_LIVE=
ALLIANCE_CLIENT_PRIVATE_CERT_PASSWORD_LIVE=
TIRA_PUBLIC_CERT_PASSWORD_LIVE=
TIRAMIS_LIVE_BASE_URL=
TIRAMIS_LIVE_CALLBACK_URL=
TIRAMIS_TCP_HOST=0.0.0.0
TIRAMIS_TCP_PORT=$TCP_PORT
TIRAMIS_PORTAL_NOTIFY_ENABLED=true
INSURANCE_PORTAL_WEBHOOK_TIMEOUT_MS=5000
TIRAMIS_PORTAL_WEBHOOK_MAX_ATTEMPTS=8
TIRAMIS_PORTAL_OUTBOX_BATCH_SIZE=20
TIRAMIS_PORTAL_OUTBOX_INTERVAL_MS=10000
TIRAMIS_RETRY_ENABLED=true
TIRAMIS_INTERNAL_CALLBACK_TESTS_ENABLED=false
TIRAMIS_RETRY_BATCH_SIZE=20
TIRAMIS_RETRY_MAX_ATTEMPTS=5
TIRAMIS_RETRY_BASE_DELAY_SECONDS=60
TIRAMIS_RETRY_MAX_DELAY_SECONDS=900
TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES=30
TIRAMIS_HTTP_TIMEOUT_MS=60000
TIRAMIS_LOG_PAYLOADS=false
TIRAMIS_REQUEST_LOG_ENABLED=true
TIRAMIS_REQUEST_LOG_DIR=$BASE_DIR/shared/bridge-requests
TIRAMIS_CALLBACK_ERROR_LOG_DIR=$BASE_DIR/shared
EOF
  chown "$DEPLOY_USER:$DEPLOY_GROUP" "$ENV_FILE"; chmod 600 "$ENV_FILE"
else printf 'Preserving existing %s\n' "$ENV_FILE"; chown "$DEPLOY_USER:$DEPLOY_GROUP" "$ENV_FILE"; chmod 600 "$ENV_FILE"; fi

if [[ ! -e "$BASE_DIR/ecosystem.config.js" ]]; then
  cat >"$BASE_DIR/ecosystem.config.js" <<EOF
module.exports = { apps: [{ name: 'bridge', script: 'dist/main.js', cwd: '$BASE_DIR/current', instances: 1, exec_mode: 'fork', autorestart: true, max_memory_restart: '1G', time: true, out_file: '$LOG_DIR/bridge-out.log', error_file: '$LOG_DIR/bridge-error.log', env: { NODE_ENV: 'production' } }] };
EOF
  chown "$DEPLOY_USER:$DEPLOY_GROUP" "$BASE_DIR/ecosystem.config.js"; chmod 640 "$BASE_DIR/ecosystem.config.js"
fi
if [[ ! -e "$BASE_DIR/deploy.sh" ]]; then
  cat >"$BASE_DIR/deploy.sh" <<'DEPLOY'
#!/usr/bin/env bash
set -Eeuo pipefail
APP_ROOT=$(cd "$(dirname "$0")" && pwd); RELEASE=${1:?Usage: deploy.sh RELEASE_DIRECTORY}; RELEASE=$(realpath "$RELEASE"); [[ -f "$RELEASE/package.json" ]] || { echo 'Release package.json missing' >&2; exit 1; }
ln -sfn "$APP_ROOT/shared/.env" "$RELEASE/.env"
cd "$RELEASE"; npm ci --omit=dev
if [[ -x node_modules/.bin/typeorm ]]; then node_modules/.bin/typeorm migration:run -d dist/database/data-source.js; fi
OLD=$(readlink -f "$APP_ROOT/current" 2>/dev/null || true); ln -sfn "$RELEASE" "$APP_ROOT/current"
if pm2 describe bridge >/dev/null 2>&1; then pm2 reload "$APP_ROOT/ecosystem.config.js" --update-env; else pm2 start "$APP_ROOT/ecosystem.config.js"; fi
pm2 save
if ! curl --fail --silent --show-error --max-time 20 http://127.0.0.1:"${APP_PORT:-8090}"/ >/dev/null; then
  if [[ -n "$OLD" && -d "$OLD" ]]; then ln -sfn "$OLD" "$APP_ROOT/current"; pm2 reload "$APP_ROOT/ecosystem.config.js" --update-env; fi
  echo 'Local health check failed; release rolled back when possible.' >&2; exit 1
fi
DEPLOY
  # Set the default health-check port in the deploy helper.
  sed -i "s|\${APP_PORT:-8090}|$APP_PORT|" "$BASE_DIR/deploy.sh"
  chown "$DEPLOY_USER:$DEPLOY_GROUP" "$BASE_DIR/deploy.sh"; chmod 750 "$BASE_DIR/deploy.sh"
fi

if [[ -n "$TLS_CERT" ]]; then install -o root -g root -m 644 "$TLS_CERT" "/etc/ssl/certs/bridge-$DOMAIN.pem"; install -o root -g root -m 600 "$TLS_KEY" "/etc/ssl/private/bridge-$DOMAIN.key"; TLS_CERT_PATH=/etc/ssl/certs/bridge-$DOMAIN.pem; TLS_KEY_PATH=/etc/ssl/private/bridge-$DOMAIN.key; else TLS_CERT_PATH=''; TLS_KEY_PATH=''; fi

if [[ "$WEB_SERVER" == nginx ]]; then
  SITE=/etc/nginx/sites-available/bridge
  if [[ -e "$SITE" ]]; then read -r -p "$SITE exists. Replace this Bridge site file? (y/N): " replace; [[ "$replace" == y || "$replace" == Y ]] || SITE=''; fi
  if [[ -n "$SITE" ]]; then
    if [[ -n "$TLS_CERT_PATH" ]]; then
      cat >"$SITE" <<EOF
server { listen 80; server_name $DOMAIN; return 301 https://\$host\$request_uri; }
server {
  listen 443 ssl; server_name $DOMAIN;
  ssl_certificate $TLS_CERT_PATH; ssl_certificate_key $TLS_KEY_PATH;
  location $API_PREFIX/ {
    proxy_pass http://127.0.0.1:$APP_PORT/;
    proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto https;
  }
}
EOF
    else
      cat >"$SITE" <<EOF
server {
  listen 80; server_name $DOMAIN;
  location $API_PREFIX/ {
    proxy_pass http://127.0.0.1:$APP_PORT/;
    proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF
    fi
    ln -sfn "$SITE" /etc/nginx/sites-enabled/bridge; nginx -t; systemctl enable --now nginx; systemctl reload nginx
  fi
elif [[ "$WEB_SERVER" == apache ]]; then
  SITE=/etc/apache2/sites-available/bridge.conf
  if [[ -e "$SITE" ]]; then read -r -p "$SITE exists. Replace this Bridge site file? (y/N): " replace; [[ "$replace" == y || "$replace" == Y ]] || SITE=''; fi
  if [[ -n "$SITE" ]]; then
    a2enmod proxy proxy_http headers ssl >/dev/null
    if [[ -n "$TLS_CERT_PATH" ]]; then
      cat >"$SITE" <<EOF
<VirtualHost *:80>
  ServerName $DOMAIN
  Redirect permanent / https://$DOMAIN/
</VirtualHost>
<VirtualHost *:443>
  ServerName $DOMAIN
  SSLEngine on
  SSLCertificateFile $TLS_CERT_PATH
  SSLCertificateKeyFile $TLS_KEY_PATH
  ProxyPreserveHost On
  ProxyPass $API_PREFIX/ http://127.0.0.1:$APP_PORT/
  ProxyPassReverse $API_PREFIX/ http://127.0.0.1:$APP_PORT/
  RequestHeader set X-Forwarded-Proto "https"
</VirtualHost>
EOF
    else
      cat >"$SITE" <<EOF
<VirtualHost *:80>
  ServerName $DOMAIN
  ProxyPreserveHost On
  ProxyPass $API_PREFIX/ http://127.0.0.1:$APP_PORT/
  ProxyPassReverse $API_PREFIX/ http://127.0.0.1:$APP_PORT/
  RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
EOF
    fi
    a2ensite bridge.conf >/dev/null; apache2ctl configtest; systemctl enable --now apache2; systemctl reload apache2
  fi
fi

if [[ "$APPROVE_UFW" == true ]]; then
  ufw allow from "$ADMIN_CIDR" to any port 22 proto tcp
  if [[ "$WEB_SERVER" != skip ]]; then ufw allow 80/tcp; [[ -z "$TLS_CERT_PATH" ]] || ufw allow 443/tcp; fi
  for cidr in "${PORTAL_CIDRS[@]}"; do ufw allow from "$cidr" to any port "$TCP_PORT" proto tcp; done
  ufw --force enable
fi

info 'Enabling PM2 startup'
pm2 startup systemd -u "$DEPLOY_USER" --hp "$DEPLOY_HOME"
runuser -u "$DEPLOY_USER" -- env HOME="$DEPLOY_HOME" PATH="$PATH" pm2 --version

cat <<DONE

Server setup complete.
Deployment account: $DEPLOY_USER
Application root:   $BASE_DIR
Environment:        $ENV_FILE
PM2 logs:           $LOG_DIR
Web server:         $WEB_SERVER
API route:          $DOMAIN$API_PREFIX/ -> 127.0.0.1:$APP_PORT
TCP gateway:        internal port $TCP_PORT
Database:           $DB_HOST:$DB_PORT/$DB_NAME (configure password in .env)

Review and complete the blank database/TIRA values in .env, place TIRA
certificates under certificates/{live,test}, then use your normal CI deployment
to install and start application code. Existing .env and account settings were
preserved. Configure TLS separately with Certbot if no certificate was supplied.
DONE
