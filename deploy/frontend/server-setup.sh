#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# Insurance Max
# Frontend Server Initial Setup
#
# Run only when preparing/re-preparing an Ubuntu server.
#
# Normal GitHub Actions deployments will not require sudo.
#
# Architecture:
#
#   Nginx :9092
#       |
#       v
#   PM2 frontend :9290
#       |
#       v
#   current/dist
#
# ============================================================


# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

DEPLOY_USER="${DEPLOY_USER:-insurance-deploy}"

BASE_DIR="${BASE_DIR:-/opt/apps/insurance-max/prod/frontend}"

APP_PORT="${APP_PORT:-9290}"

NGINX_PORT="${NGINX_PORT:-9092}"

PM2_APP_NAME="${PM2_APP_NAME:-insurance-max-prod-web}"

REQUIRED_NODE_MAJOR="${REQUIRED_NODE_MAJOR:-22}"

ENABLE_NGINX="${ENABLE_NGINX:-true}"

NGINX_SITE_NAME="${NGINX_SITE_NAME:-insurance-max-prod-web}"


echo "================================================"
echo " Insurance Max Frontend Server Setup"
echo "================================================"
echo "Deploy user      : ${DEPLOY_USER}"
echo "Base dir         : ${BASE_DIR}"
echo "PM2 app          : ${PM2_APP_NAME}"
echo "Frontend port    : ${APP_PORT}"
echo "Nginx port       : ${NGINX_PORT}"
echo "Required Node.js : ${REQUIRED_NODE_MAJOR}.x"
echo "Configure Nginx  : ${ENABLE_NGINX}"
echo "================================================"


# ------------------------------------------------------------
# Must run as root
# ------------------------------------------------------------

if [[ "${EUID}" -ne 0 ]]; then

    echo
    echo "ERROR: This initial setup must run as root/sudo."

    echo
    echo "Example:"
    echo
    echo "sudo DEPLOY_USER=insurance-deploy \\"
    echo "BASE_DIR=/opt/apps/insurance-max/prod/frontend \\"
    echo "APP_PORT=9290 \\"
    echo "NGINX_PORT=9092 \\"
    echo "bash server-setup.sh"

    exit 1
fi


# ------------------------------------------------------------
# Verify deployment user
# ------------------------------------------------------------

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then

    echo
    echo "ERROR: Deployment user '${DEPLOY_USER}' does not exist."

    exit 1
fi

echo
echo "[OK] Deployment user exists."


# ------------------------------------------------------------
# Resolve deployment user's home directory
# ------------------------------------------------------------

DEPLOY_HOME="$(getent passwd "${DEPLOY_USER}" | cut -d: -f6)"

if [[ -z "${DEPLOY_HOME}" ]]; then

    echo "ERROR: Could not determine home directory for ${DEPLOY_USER}."

    exit 1
fi

echo "[OK] Deployment home: ${DEPLOY_HOME}"


# ------------------------------------------------------------
# Install required system packages
# ------------------------------------------------------------

echo
echo "Installing required frontend system packages..."

apt-get update

apt-get install -y \
    build-essential \
    ca-certificates \
    curl \
    git \
    g++ \
    gzip \
    make \
    nginx \
    python3 \
    rsync \
    tar \
    unzip


# ------------------------------------------------------------
# Verify Node.js
# ------------------------------------------------------------

echo
echo "Checking Node.js..."

if ! command -v node >/dev/null 2>&1; then

    echo
    echo "ERROR: Node.js is not installed."
    echo
    echo "Insurance Max frontend requires Node.js ${REQUIRED_NODE_MAJOR}.x."
    echo
    echo "Install Node.js before continuing."

    exit 1
fi


NODE_VERSION="$(node -v)"

NODE_MAJOR="$(
    node -p "process.versions.node.split('.')[0]"
)"

echo "Detected Node.js: ${NODE_VERSION}"


if (( NODE_MAJOR < REQUIRED_NODE_MAJOR )); then

    echo
    echo "ERROR: Node.js ${REQUIRED_NODE_MAJOR}.x or newer is required."
    echo "Current version: ${NODE_VERSION}"

    exit 1
fi

echo "[OK] Node.js version is supported."


# ------------------------------------------------------------
# Verify npm
# ------------------------------------------------------------

echo
echo "Checking npm..."

if ! command -v npm >/dev/null 2>&1; then

    echo "ERROR: npm is not installed."

    exit 1
fi

echo "[OK] npm: $(npm -v)"


# ------------------------------------------------------------
# Install PM2 if missing
# ------------------------------------------------------------

echo
echo "Checking PM2..."

if ! command -v pm2 >/dev/null 2>&1; then

    echo "PM2 not found."
    echo "Installing PM2 globally..."

    npm install -g pm2
fi

echo "[OK] PM2: $(pm2 -v)"


# ------------------------------------------------------------
# Create PM2 home
# ------------------------------------------------------------

echo
echo "Preparing PM2 directory..."

install -d \
    -o "${DEPLOY_USER}" \
    -g "${DEPLOY_USER}" \
    -m 0750 \
    "${DEPLOY_HOME}/.pm2"


# ------------------------------------------------------------
# Create frontend directories
# ------------------------------------------------------------

echo
echo "Creating frontend directories..."

install -d \
    -o "${DEPLOY_USER}" \
    -g "${DEPLOY_USER}" \
    -m 0755 \
    "${BASE_DIR}"

install -d \
    -o "${DEPLOY_USER}" \
    -g "${DEPLOY_USER}" \
    -m 0755 \
    "${BASE_DIR}/releases"

install -d \
    -o "${DEPLOY_USER}" \
    -g "${DEPLOY_USER}" \
    -m 0755 \
    "${BASE_DIR}/shared"

install -d \
    -o "${DEPLOY_USER}" \
    -g "${DEPLOY_USER}" \
    -m 0755 \
    "${BASE_DIR}/logs"

install -d \
    -o "${DEPLOY_USER}" \
    -g "${DEPLOY_USER}" \
    -m 0755 \
    "${BASE_DIR}/tmp"

install -d \
    -o "${DEPLOY_USER}" \
    -g "${DEPLOY_USER}" \
    -m 0755 \
    "${BASE_DIR}/backups"


# ------------------------------------------------------------
# Create secure production frontend environment
#
# IMPORTANT:
#
# VITE_* variables are compiled into the browser bundle.
# Do NOT put secrets such as database passwords,
# JWT secrets or TIRAMIS private API keys here.
# ------------------------------------------------------------

ENV_FILE="${BASE_DIR}/shared/.env.production"

if [[ ! -f "${ENV_FILE}" ]]; then

    echo
    echo "Creating ${ENV_FILE}"

    install \
        -o "${DEPLOY_USER}" \
        -g "${DEPLOY_USER}" \
        -m 0600 \
        /dev/null \
        "${ENV_FILE}"

else

    echo
    echo "${ENV_FILE} already exists."

    chown \
        "${DEPLOY_USER}:${DEPLOY_USER}" \
        "${ENV_FILE}"

    chmod 0600 "${ENV_FILE}"
fi


# ------------------------------------------------------------
# Create frontend deployment metadata directory
# ------------------------------------------------------------

DEPLOY_META_DIR="${BASE_DIR}/shared/deployment"

install -d \
    -o "${DEPLOY_USER}" \
    -g "${DEPLOY_USER}" \
    -m 0755 \
    "${DEPLOY_META_DIR}"


# ------------------------------------------------------------
# Create empty deployment metadata files
# ------------------------------------------------------------

touch "${DEPLOY_META_DIR}/current-release"
touch "${DEPLOY_META_DIR}/previous-release"

chown \
    "${DEPLOY_USER}:${DEPLOY_USER}" \
    "${DEPLOY_META_DIR}/current-release" \
    "${DEPLOY_META_DIR}/previous-release"

chmod 0644 \
    "${DEPLOY_META_DIR}/current-release" \
    "${DEPLOY_META_DIR}/previous-release"


# ------------------------------------------------------------
# Prepare frontend log files
# ------------------------------------------------------------

echo
echo "Preparing frontend log files..."

touch "${BASE_DIR}/logs/out.log"
touch "${BASE_DIR}/logs/error.log"

chown \
    "${DEPLOY_USER}:${DEPLOY_USER}" \
    "${BASE_DIR}/logs/out.log" \
    "${BASE_DIR}/logs/error.log"

chmod 0644 \
    "${BASE_DIR}/logs/out.log" \
    "${BASE_DIR}/logs/error.log"


# ------------------------------------------------------------
# Ownership
# ------------------------------------------------------------

echo
echo "Setting frontend ownership..."

chown -R \
    "${DEPLOY_USER}:${DEPLOY_USER}" \
    "${BASE_DIR}"


# ------------------------------------------------------------
# Permissions
# ------------------------------------------------------------

echo
echo "Setting frontend permissions..."

chmod 0755 "${BASE_DIR}"

chmod 0755 "${BASE_DIR}/releases"

chmod 0755 "${BASE_DIR}/shared"

chmod 0755 "${BASE_DIR}/logs"

chmod 0755 "${BASE_DIR}/tmp"

chmod 0755 "${BASE_DIR}/backups"

chmod 0755 "${DEPLOY_META_DIR}"

chmod 0600 "${ENV_FILE}"


# ------------------------------------------------------------
# Verify deployment user can write
# ------------------------------------------------------------

echo
echo "Testing deployment user permissions..."

TEST_FILE="${BASE_DIR}/tmp/.permission-test"

runuser \
    -u "${DEPLOY_USER}" \
    -- touch "${TEST_FILE}"

if [[ ! -f "${TEST_FILE}" ]]; then

    echo "ERROR: Deployment user cannot write to frontend directory."

    exit 1
fi

rm -f "${TEST_FILE}"

echo "[OK] Deployment user can write without sudo."


# ------------------------------------------------------------
# Verify Node/npm/PM2 as deployment user
# ------------------------------------------------------------

echo
echo "Testing runtime as ${DEPLOY_USER}..."

runuser -u "${DEPLOY_USER}" -- node -v
runuser -u "${DEPLOY_USER}" -- npm -v
runuser -u "${DEPLOY_USER}" -- pm2 -v

echo "[OK] Node/npm/PM2 accessible to deployment user."


# ------------------------------------------------------------
# Nginx configuration
# ------------------------------------------------------------

if [[ "${ENABLE_NGINX}" == "true" ]]; then

    echo
    echo "Configuring Nginx frontend proxy..."

    NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE_NAME}"

    NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE_NAME}"


    cat > "${NGINX_AVAILABLE}" <<EOF
# ============================================================
# Insurance Max Production Frontend
#
# Public:
#   http://SERVER:${NGINX_PORT}
#
# Internal frontend:
#   http://127.0.0.1:${APP_PORT}
# ============================================================

server {

    listen ${NGINX_PORT};
    listen [::]:${NGINX_PORT};

    server_name _;

    access_log /var/log/nginx/${NGINX_SITE_NAME}-access.log;

    error_log /var/log/nginx/${NGINX_SITE_NAME}-error.log;


    location / {

        proxy_pass http://127.0.0.1:${APP_PORT};

        proxy_http_version 1.1;

        proxy_set_header Host \$host;

        proxy_set_header X-Real-IP \$remote_addr;

        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;

        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_set_header X-Forwarded-Host \$host;

        proxy_set_header X-Forwarded-Port \$server_port;


        proxy_connect_timeout 10s;

        proxy_send_timeout 60s;

        proxy_read_timeout 60s;

    }

}
EOF


    ln -sfn \
        "${NGINX_AVAILABLE}" \
        "${NGINX_ENABLED}"


    echo
    echo "Testing Nginx configuration..."

    nginx -t


    echo
    echo "Enabling Nginx..."

    systemctl enable nginx


    echo
    echo "Reloading Nginx..."

    systemctl reload nginx


    echo "[OK] Nginx configured."

fi


# ------------------------------------------------------------
# Display frontend structure
# ------------------------------------------------------------

echo
echo "================================================"
echo " Frontend structure"
echo "================================================"

find "${BASE_DIR}" \
    -maxdepth 3 \
    -printf '%M %u:%g %p -> %l\n' \
    | sort


# ------------------------------------------------------------
# Display versions
# ------------------------------------------------------------

echo
echo "================================================"
echo " Runtime Versions"
echo "================================================"

echo "Node : $(node -v)"
echo "npm  : $(npm -v)"
echo "PM2  : $(pm2 -v)"

if command -v nginx >/dev/null 2>&1; then

    echo "Nginx: $(nginx -v 2>&1)"

fi


# ------------------------------------------------------------
# Final information
# ------------------------------------------------------------

echo
echo "================================================"
echo " Insurance Max Frontend Server Setup Complete"
echo "================================================"

echo
echo "Frontend base:"
echo "${BASE_DIR}"

echo
echo "Releases:"
echo "${BASE_DIR}/releases"

echo
echo "Current release:"
echo "${BASE_DIR}/current"

echo
echo "Shared:"
echo "${BASE_DIR}/shared"

echo
echo "Production environment:"
echo "${ENV_FILE}"

echo
echo "Deployment metadata:"
echo "${DEPLOY_META_DIR}"

echo
echo "Logs:"
echo "${BASE_DIR}/logs"

echo
echo "Temporary deployments:"
echo "${BASE_DIR}/tmp"

echo
echo "Backups:"
echo "${BASE_DIR}/backups"

echo
echo "PM2 application:"
echo "${PM2_APP_NAME}"

echo
echo "Internal frontend URL:"
echo "http://127.0.0.1:${APP_PORT}"

if [[ "${ENABLE_NGINX}" == "true" ]]; then

    echo
    echo "Nginx frontend URL:"
    echo "http://SERVER_IP:${NGINX_PORT}"

    echo
    echo "Nginx configuration:"
    echo "/etc/nginx/sites-available/${NGINX_SITE_NAME}"

fi

echo
echo "------------------------------------------------"
echo "IMPORTANT"
echo "------------------------------------------------"

echo
echo "The 'current' symlink is NOT created during"
echo "initial server preparation."
echo
echo "GitHub Actions will create:"
echo
echo "${BASE_DIR}/current -> ${BASE_DIR}/releases/<release>"
echo
echo "after the first successful deployment."

echo
echo "The frontend PM2 process is also NOT started"
echo "until the first frontend release has been built."
echo