#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# Insurance Max
# Backend Server Initial Setup
#
# Run only once when preparing an Ubuntu server.
#
# Normal GitHub Actions deployments will not require sudo.
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
# Must run as root
# ------------------------------------------------------------

if [[ "${EUID}" -ne 0 ]]; then

    echo "ERROR: This initial setup must run as root/sudo."

    echo
    echo "Example:"
    echo
    echo "sudo DEPLOY_USER=insurance-deploy \\"
    echo "BASE_DIR=/opt/apps/insurance-max/prod/backend \\"
    echo "bash server-setup.sh"

    exit 1
fi


# ------------------------------------------------------------
# Verify deployment user
# ------------------------------------------------------------

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then

    echo "ERROR: Deployment user '${DEPLOY_USER}' does not exist."

    exit 1
fi

echo "[OK] Deployment user exists."


# ------------------------------------------------------------
# Install required system packages
# ------------------------------------------------------------

echo
echo "Installing required packages..."

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
# Create directories
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
# Secure shared environment file
# ------------------------------------------------------------

ENV_FILE="${BASE_DIR}/shared/.env"

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

    chown "${DEPLOY_USER}:${DEPLOY_USER}" "${ENV_FILE}"

    chmod 0600 "${ENV_FILE}"

fi


# ------------------------------------------------------------
# Ownership
# ------------------------------------------------------------

echo
echo "Setting ownership..."

chown -R \
    "${DEPLOY_USER}:${DEPLOY_USER}" \
    "${BASE_DIR}"


# ------------------------------------------------------------
# Permissions
# ------------------------------------------------------------

chmod 0755 "${BASE_DIR}"

chmod 0755 "${BASE_DIR}/releases"

chmod 0755 "${BASE_DIR}/shared"

chmod 0755 "${BASE_DIR}/logs"

chmod 0755 "${BASE_DIR}/tmp"

chmod 0600 "${ENV_FILE}"


# ------------------------------------------------------------
# Display structure
# ------------------------------------------------------------

echo
echo "================================================"
echo " Backend structure"
echo "================================================"

find "${BASE_DIR}" \
    -maxdepth 3 \
    -printf '%M %u:%g %p\n'


echo
echo "================================================"
echo " Insurance Max Backend Server Setup Complete"
echo "================================================"

echo
echo "Backend:"
echo "${BASE_DIR}"

echo
echo "Releases:"
echo "${BASE_DIR}/releases"

echo
echo "Shared:"
echo "${BASE_DIR}/shared"

echo
echo "Environment:"
echo "${BASE_DIR}/shared/.env"

echo
echo "Logs:"
echo "${BASE_DIR}/logs"

echo
echo "Temporary deployments:"
echo "${BASE_DIR}/tmp"
echo