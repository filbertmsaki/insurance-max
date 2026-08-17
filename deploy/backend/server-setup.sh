#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# Insurance Max - Backend Server Initial Setup
#
# This script is ONLY for the initial server preparation.
#
# Normal GitHub Actions deployments will NOT require sudo.
# ============================================================

DEPLOY_USER="${DEPLOY_USER:-insurance-deploy}"

BASE_DIR="${BASE_DIR:-/opt/apps/insurance-max/prod/backend}"

echo "================================================"
echo " Insurance Max Backend Server Setup"
echo "================================================"
echo "Deploy user : ${DEPLOY_USER}"
echo "Base dir    : ${BASE_DIR}"
echo "================================================"


# ------------------------------------------------------------
# 1. Must run as root/sudo
# ------------------------------------------------------------

if [[ "${EUID}" -ne 0 ]]; then
    echo "ERROR: Run this script using sudo/root."
    echo
    echo "Example:"
    echo
    echo "sudo bash deploy/backend/server-setup.sh"
    exit 1
fi


# ------------------------------------------------------------
# 2. Verify deployment user
# ------------------------------------------------------------

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
    echo "ERROR: Deployment user '${DEPLOY_USER}' does not exist."
    exit 1
fi

echo "[OK] Deployment user exists."


# ------------------------------------------------------------
# 3. Install required server packages
#
# Node.js and PM2 are NOT installed here because we already
# manage those separately.
# ------------------------------------------------------------

echo
echo "Installing required system packages..."

apt-get update

apt-get install -y \
    build-essential \
    ca-certificates \
    curl \
    g++ \
    make \
    postgresql-client \
    python3 \
    tar \
    gzip


# ------------------------------------------------------------
# 4. Create application directory structure
# ------------------------------------------------------------

echo
echo "Creating backend directories..."

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
    "${BASE_DIR}/shared/uploads"

install -d \
    -o "${DEPLOY_USER}" \
    -g "${DEPLOY_USER}" \
    -m 0755 \
    "${BASE_DIR}/shared/uploads/documents"

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


# ------------------------------------------------------------
# 5. Create secure production environment file
# ------------------------------------------------------------

ENV_FILE="${BASE_DIR}/shared/.env"

if [[ ! -f "${ENV_FILE}" ]]; then

    echo
    echo "Creating production environment file..."

    install \
        -o "${DEPLOY_USER}" \
        -g "${DEPLOY_USER}" \
        -m 0600 \
        /dev/null \
        "${ENV_FILE}"

else

    echo
    echo "Production .env already exists."

    chown "${DEPLOY_USER}:${DEPLOY_USER}" "${ENV_FILE}"

    chmod 0600 "${ENV_FILE}"

fi


# ------------------------------------------------------------
# 6. Correct directory ownership
# ------------------------------------------------------------

echo
echo "Setting application ownership..."

chown -R \
    "${DEPLOY_USER}:${DEPLOY_USER}" \
    "${BASE_DIR}"


# ------------------------------------------------------------
# 7. Secure important directories
# ------------------------------------------------------------

chmod 0755 "${BASE_DIR}"

chmod 0755 "${BASE_DIR}/releases"

chmod 0755 "${BASE_DIR}/shared"

chmod 0755 "${BASE_DIR}/logs"

chmod 0755 "${BASE_DIR}/tmp"

chmod 0600 "${ENV_FILE}"


# ------------------------------------------------------------
# 8. Display final structure
# ------------------------------------------------------------

echo
echo "================================================"
echo " Backend directory structure"
echo "================================================"

find "${BASE_DIR}" \
    -maxdepth 3 \
    -printf '%M %u:%g %p\n'


echo
echo "================================================"
echo " Backend server setup complete"
echo "================================================"

echo
echo "Application directory:"
echo "${BASE_DIR}"

echo
echo "Release directory:"
echo "${BASE_DIR}/releases"

echo
echo "Shared files:"
echo "${BASE_DIR}/shared"

echo
echo "Environment file:"
echo "${BASE_DIR}/shared/.env"

echo
echo "Logs:"
echo "${BASE_DIR}/logs"

echo
echo "Next:"
echo "1. Verify Node.js 22"
echo "2. Verify npm"
echo "3. Verify PM2"
echo "4. Configure shared/.env"
echo "5. Configure GitHub Actions SSH deployment"
echo