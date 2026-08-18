#!/usr/bin/env bash

set -Eeuo pipefail


# ============================================================
# Insurance Max
# Manual Frontend Rollback
#
# Usage:
#
# rollback.sh
#
# Rolls back to previous-release.
#
# Or:
#
# rollback.sh 20260818090000-abcd1234
#
# Rolls back to a specified release.
# ============================================================


DEPLOY_USER="${DEPLOY_USER:-insurance-deploy}"

BASE_DIR="${BASE_DIR:-/opt/apps/insurance-max/prod/frontend}"

PM2_APP_NAME="${PM2_APP_NAME:-insurance-max-prod-web}"

APP_PORT="${APP_PORT:-9290}"

NGINX_PORT="${NGINX_PORT:-9092}"


RELEASES_DIR="${BASE_DIR}/releases"

SHARED_DIR="${BASE_DIR}/shared"

DEPLOYMENT_DIR="${SHARED_DIR}/deployment"

CURRENT_LINK="${BASE_DIR}/current"

PM2_CONFIG="${SHARED_DIR}/ecosystem.config.cjs"

LOCK_FILE="${SHARED_DIR}/deploy.lock"


TARGET_ID="${1:-}"

CURRENT_USER="$(id -un)"


fail() {

    echo "ERROR: $*" >&2

    exit 1

}


activate_release() {

    local target="$1"

    local temp_link="${BASE_DIR}/.rollback-current.$$"


    rm -f -- \
        "${temp_link}"


    ln -s \
        "${target}" \
        "${temp_link}"


    mv -Tf \
        "${temp_link}" \
        "${CURRENT_LINK}"

}


[[ "${CURRENT_USER}" == "${DEPLOY_USER}" ]] \
    || fail \
        "Run rollback as ${DEPLOY_USER}."


[[ -f "${PM2_CONFIG}" ]] \
    || fail \
        "Missing PM2 config: ${PM2_CONFIG}"


# ------------------------------------------------------------
# Deployment lock
# ------------------------------------------------------------

exec 9>"${LOCK_FILE}"


flock -n 9 \
    || fail \
        "Another frontend deployment or rollback is running."


# ------------------------------------------------------------
# Current release
# ------------------------------------------------------------

CURRENT_RELEASE=""


if [[ -L "${CURRENT_LINK}" ]]; then

    CURRENT_RELEASE="$(
        readlink -f \
            "${CURRENT_LINK}" \
            || true
    )"

fi


# ------------------------------------------------------------
# Determine rollback target
# ------------------------------------------------------------

if [[ -z "${TARGET_ID}" ]]; then

    [[ -f "${DEPLOYMENT_DIR}/previous-release" ]] \
        || fail \
            "Previous-release metadata missing."


    TARGET_ID="$(
        tr -d '\r\n' \
            < "${DEPLOYMENT_DIR}/previous-release"
    )"

fi


[[ -n "${TARGET_ID}" ]] \
    || fail \
        "No rollback target available."


TARGET_RELEASE="${RELEASES_DIR}/${TARGET_ID}"


# ------------------------------------------------------------
# Validate target
# ------------------------------------------------------------

[[ -d "${TARGET_RELEASE}" ]] \
    || fail \
        "Rollback release does not exist: ${TARGET_RELEASE}"


[[ -f "${TARGET_RELEASE}/frontend-dist/index.html" ]] \
    || fail \
        "Rollback release has invalid frontend-dist."


# ------------------------------------------------------------
# Already active?
# ------------------------------------------------------------

if [[ "${CURRENT_RELEASE}" == "${TARGET_RELEASE}" ]]; then

    echo
    echo "Release ${TARGET_ID} is already active."

    exit 0

fi


CURRENT_ID=""


if [[ -n "${CURRENT_RELEASE}" ]]; then

    CURRENT_ID="$(
        basename "${CURRENT_RELEASE}"
    )"

fi


echo
echo "Current release:"
echo "${CURRENT_ID:-NONE}"


echo
echo "Rollback target:"
echo "${TARGET_ID}"


# ------------------------------------------------------------
# Activate rollback
# ------------------------------------------------------------

activate_release \
    "${TARGET_RELEASE}"


printf '%s\n' \
    "${TARGET_ID}" \
    > "${DEPLOYMENT_DIR}/current-release"


printf '%s\n' \
    "${CURRENT_ID}" \
    > "${DEPLOYMENT_DIR}/previous-release"


# ------------------------------------------------------------
# Restart frontend
# ------------------------------------------------------------

pm2 startOrReload \
    "${PM2_CONFIG}" \
    --only "${PM2_APP_NAME}" \
    --update-env


# ------------------------------------------------------------
# Direct health check
# ------------------------------------------------------------

HEALTH_URL="http://127.0.0.1:${APP_PORT}/health"


OK=false


for attempt in $(seq 1 20); do

    body="$(
        curl \
            --silent \
            --show-error \
            --max-time 5 \
            "${HEALTH_URL}" \
            2>/dev/null \
            || true
    )"


    if [[ "${body}" == *'"status":"ok"'* ]] \
        && [[ "${body}" == *"\"release\":\"${TARGET_ID}\""* ]]
    then

        OK=true

        echo "${body}"

        break

    fi


    echo \
        "Rollback health check ${attempt}/20..."


    sleep 2

done


# ------------------------------------------------------------
# Restore original if rollback target fails
# ------------------------------------------------------------

if [[ "${OK}" != "true" ]]; then

    echo
    echo "Rollback target failed health check." \
        >&2


    if [[ -n "${CURRENT_RELEASE}" ]] \
        && [[ -d "${CURRENT_RELEASE}" ]]
    then

        echo \
            "Restoring original release ${CURRENT_ID}." \
            >&2


        activate_release \
            "${CURRENT_RELEASE}"


        printf '%s\n' \
            "${CURRENT_ID}" \
            > "${DEPLOYMENT_DIR}/current-release"


        printf '%s\n' \
            "${TARGET_ID}" \
            > "${DEPLOYMENT_DIR}/previous-release"


        pm2 startOrReload \
            "${PM2_CONFIG}" \
            --only "${PM2_APP_NAME}" \
            --update-env \
            || true

    fi


    exit 1

fi


# ------------------------------------------------------------
# Nginx verification
# ------------------------------------------------------------

NGINX_HEALTH_URL="http://127.0.0.1:${NGINX_PORT}/health"


nginx_body="$(
    curl \
        --fail \
        --silent \
        --show-error \
        "${NGINX_HEALTH_URL}"
)"


[[ "${nginx_body}" == *"\"release\":\"${TARGET_ID}\""* ]] \
    || fail \
        "Nginx health check did not report ${TARGET_ID}."


echo
echo "${nginx_body}"


# ------------------------------------------------------------
# Persist PM2
# ------------------------------------------------------------

pm2 save


echo
echo "============================================"
echo " Frontend Rollback Successful"
echo "============================================"
echo
echo "Active release:"
echo "${TARGET_ID}"
echo


pm2 status \
    "${PM2_APP_NAME}"