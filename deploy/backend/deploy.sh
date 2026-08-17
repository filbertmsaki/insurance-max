#!/usr/bin/env bash

set -Eeuo pipefail

IFS=$'\n\t'
umask 027

# ============================================================
# Insurance Max
# Backend Deployment Script
#
# Used by GitHub Actions after the backend artifact has already
# been built on a GitHub-hosted runner.
#
# Normal deployment:
#
#   deploy.sh deploy
#
# Rollback:
#
#   deploy.sh rollback
#
# Specific rollback:
#
#   deploy.sh rollback <release-id>
#
# No sudo is required during normal deployments.
# ============================================================


# ============================================================
# COMMAND
# ============================================================

COMMAND="${1:-deploy}"


# ============================================================
# APPLICATION CONFIGURATION
# ============================================================

BASE_DIR="${BASE_DIR:-/opt/apps/insurance-max/prod/backend}"

APP_NAME="${APP_NAME:-insurance-max-prod-api}"

APP_HOST="${APP_HOST:-127.0.0.1}"

APP_PORT="${APP_PORT:-9090}"

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${APP_PORT}/api/v1/health/ready}"


# ============================================================
# RELEASE CONFIGURATION
# ============================================================

KEEP_RELEASES="${KEEP_RELEASES:-5}"

HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-30}"

HEALTH_INTERVAL_SECONDS="${HEALTH_INTERVAL_SECONDS:-3}"

MAX_MEMORY_RESTART="${MAX_MEMORY_RESTART:-750M}"


# ============================================================
# SERVER BINARIES
#
# We already verified these are available through /usr/bin.
# ============================================================

NODE_BIN="${NODE_BIN:-/usr/bin/node}"

NPM_BIN="${NPM_BIN:-/usr/bin/npm}"

PM2_BIN="${PM2_BIN:-/usr/bin/pm2}"


# ============================================================
# PROJECT-SPECIFIC PATHS
#
# Verified from Insurance Max project structure.
# ============================================================

APP_ENTRY="${APP_ENTRY:-dist/apps/insurance-portal-service/apps/insurance-portal-service/src/main.js}"


# TypeORM compiled working directory.
#
# Your compiled data-source uses:
#
# apps/insurance-portal-service/src/database/migrations/*.js
#
# Therefore migrations must execute from:
#
# dist/apps/insurance-portal-service
# ============================================================

MIGRATION_CWD_REL="${MIGRATION_CWD_REL:-dist/apps/insurance-portal-service}"

MIGRATION_DATA_SOURCE="${MIGRATION_DATA_SOURCE:-apps/insurance-portal-service/src/database/data-source.js}"


# ============================================================
# SERVER DIRECTORIES
# ============================================================

RELEASES_DIR="${BASE_DIR}/releases"

SHARED_DIR="${BASE_DIR}/shared"

LOG_DIR="${BASE_DIR}/logs"

TMP_DIR="${BASE_DIR}/tmp"

CURRENT_LINK="${BASE_DIR}/current"

ENV_FILE="${SHARED_DIR}/.env"

UPLOADS_DIR="${SHARED_DIR}/uploads"

PREVIOUS_RELEASE_FILE="${SHARED_DIR}/previous-release"

ECOSYSTEM_FILE="${SHARED_DIR}/ecosystem.backend.config.cjs"

LOCK_FILE="${TMP_DIR}/deploy.lock"


# ============================================================
# VALUES PROVIDED BY GITHUB ACTIONS
# ============================================================

RELEASE_SHA="${RELEASE_SHA:-}"

RELEASE_ID="${RELEASE_ID:-}"

ARCHIVE_FILE="${ARCHIVE_FILE:-}"

CLEAN_ARCHIVE="${CLEAN_ARCHIVE:-true}"


# ============================================================
# LOGGING
# ============================================================

log() {

    printf '[%s] %s\n' \
        "$(date '+%Y-%m-%d %H:%M:%S')" \
        "$*"
}


warn() {

    printf '[%s] WARNING: %s\n' \
        "$(date '+%Y-%m-%d %H:%M:%S')" \
        "$*" >&2
}


die() {

    printf '[%s] ERROR: %s\n' \
        "$(date '+%Y-%m-%d %H:%M:%S')" \
        "$*" >&2

    exit 1
}


# ============================================================
# REQUIRE COMMAND
# ============================================================

require_command() {

    local command_name="$1"

    command -v "${command_name}" >/dev/null 2>&1 || \
        die "Required command not found: ${command_name}"
}


# ============================================================
# INTEGER VALIDATION
# ============================================================

validate_integer() {

    local value="$1"

    local name="$2"

    [[ "${value}" =~ ^[0-9]+$ ]] || \
        die "${name} must be a non-negative integer."
}


# ============================================================
# RELEASE ID VALIDATION
# ============================================================

validate_safe_release_id() {

    local value="$1"

    [[ "${value}" =~ ^[A-Za-z0-9._-]+$ ]] || \
        die "RELEASE_ID contains unsupported characters."
}


# ============================================================
# GET CURRENT RELEASE
# ============================================================

current_release_path() {

    if [[ -L "${CURRENT_LINK}" ]]; then

        readlink -f "${CURRENT_LINK}" || true

    fi
}


# ============================================================
# GET RELEASE SHA
# ============================================================

release_sha_from_dir() {

    local release_dir="$1"

    if [[ -f "${release_dir}/REVISION" ]]; then

        head -n 1 "${release_dir}/REVISION" | tr -d '\r\n'

    else

        basename "${release_dir}"

    fi
}


# ============================================================
# GENERATE PM2 ECOSYSTEM CONFIGURATION
#
# This is why ecosystem.config.js does NOT need to live
# permanently inside the repository.
#
# deploy.sh generates it dynamically.
# ============================================================

write_pm2_config() {

    local release_sha="$1"

    # The temporary file must keep the .cjs suffix so that
    # `node --check` treats it as CommonJS. A trailing
    # ".tmp.$$" makes Node see an unknown extension and the
    # module.exports syntax check fails.

    local tmp_file="${ECOSYSTEM_FILE}.tmp.$$.cjs"


    cat > "${tmp_file}" <<EOF_PM2
module.exports = {
  apps: [
    {
      name: '${APP_NAME}',

      cwd: '${CURRENT_LINK}',

      script: '${APP_ENTRY}',

      interpreter: '${NODE_BIN}',

      instances: 1,

      exec_mode: 'fork',

      autorestart: true,

      watch: false,

      max_memory_restart: '${MAX_MEMORY_RESTART}',

      restart_delay: 2000,

      exp_backoff_restart_delay: 100,

      kill_timeout: 15000,

      listen_timeout: 15000,

      time: true,

      merge_logs: true,

      out_file: '${LOG_DIR}/out.log',

      error_file: '${LOG_DIR}/error.log',

      env: {
        NODE_ENV: 'production',

        APP_ENV: 'production',

        APP_HOST: '${APP_HOST}',

        APP_PORT: '${APP_PORT}',

        APP_RELEASE_SHA: '${release_sha}'
      }
    }
  ]
};
EOF_PM2


    # Validate JavaScript before replacing existing config.

    if ! "${NODE_BIN}" --check "${tmp_file}" >/dev/null; then

        warn "Generated PM2 ecosystem configuration is invalid."

        # Dump the generated file so the offending interpolated
        # value is visible in the deployment log. This file
        # contains no secrets.

        warn "Generated configuration was:"

        cat -n "${tmp_file}" >&2

        rm -f "${tmp_file}"

        die "PM2 ecosystem syntax validation failed."
    fi


    mv -f \
        "${tmp_file}" \
        "${ECOSYSTEM_FILE}"


    chmod 0640 \
        "${ECOSYSTEM_FILE}"


    log "PM2 ecosystem configuration prepared successfully."
}


# ============================================================
# START / RELOAD PM2
# ============================================================

restart_pm2() {

    local release_sha="$1"


    log "Preparing PM2 application: ${APP_NAME}"


    write_pm2_config \
        "${release_sha}"


    # --------------------------------------------------------
    # Application already exists
    # --------------------------------------------------------

    if "${PM2_BIN}" describe "${APP_NAME}" >/dev/null 2>&1; then


        log "Reloading existing PM2 application..."


        "${PM2_BIN}" \
            reload \
            "${ECOSYSTEM_FILE}" \
            --only "${APP_NAME}" \
            --update-env


    # --------------------------------------------------------
    # First deployment
    # --------------------------------------------------------

    else


        log "Starting PM2 application for the first time..."


        "${PM2_BIN}" \
            start \
            "${ECOSYSTEM_FILE}" \
            --only "${APP_NAME}"


    fi
}


# ============================================================
# HEALTH CHECK
# ============================================================

health_check() {

    local attempt


    log "Checking backend readiness: ${HEALTH_URL}"


    for ((attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt++)); do


        if curl \
            --fail \
            --silent \
            --show-error \
            --max-time 5 \
            "${HEALTH_URL}" \
            >/dev/null
        then

            log "Health check passed on attempt ${attempt}/${HEALTH_ATTEMPTS}."

            return 0

        fi


        log "Health check attempt ${attempt}/${HEALTH_ATTEMPTS} failed."


        sleep \
            "${HEALTH_INTERVAL_SECONDS}"

    done


    return 1
}


# ============================================================
# ROLLBACK TO A RELEASE
# ============================================================

rollback_to_release() {

    local target_release="$1"


    [[ -n "${target_release}" ]] || \
        die "Rollback target is empty."


    [[ -d "${target_release}" ]] || \
        die "Rollback target does not exist: ${target_release}"


    [[ -f "${target_release}/${APP_ENTRY}" ]] || \
        die "Rollback target has no backend entry file."


    [[ -f "${target_release}/REVISION" ]] || \
        die "Rollback target has no REVISION file: ${target_release}"


    local target_sha


    target_sha="$(release_sha_from_dir "${target_release}")"


    log "Switching current release to: ${target_release}"


    ln -sfn \
        "${target_release}" \
        "${CURRENT_LINK}.next"


    mv -Tf \
        "${CURRENT_LINK}.next" \
        "${CURRENT_LINK}"


    local active_release


    active_release="$(current_release_path || true)"


    [[ "${active_release}" == "${target_release}" ]] || \
        die "Rollback current symlink verification failed: expected ${target_release}, got ${active_release}"


    restart_pm2 \
        "${target_sha}"


    if ! health_check; then

        die "Rollback release failed the health check: ${target_release}"

    fi


    "${PM2_BIN}" save


    log "Rollback completed successfully."
}


# ============================================================
# REMOVE OLD RELEASES
# ============================================================

cleanup_old_releases() {

    local current

    local previous


    current="$(current_release_path)"


    previous=""


    if [[ -f "${PREVIOUS_RELEASE_FILE}" ]]; then

        previous="$(cat "${PREVIOUS_RELEASE_FILE}" 2>/dev/null || true)"

    fi


    mapfile -t releases < <(

        find \
            "${RELEASES_DIR}" \
            -mindepth 1 \
            -maxdepth 1 \
            -type d \
            -printf '%T@ %p\n' \
            | sort -rn \
            | cut -d' ' -f2-

    )


    local index=0

    local release


    for release in "${releases[@]:-}"; do


        index=$((index + 1))


        if (( index <= KEEP_RELEASES )); then

            continue

        fi


        if [[ "${release}" == "${current}" ]]; then

            continue

        fi


        if [[ "${release}" == "${previous}" ]]; then

            continue

        fi


        log "Removing old release: ${release}"


        rm -rf -- \
            "${release}"

    done
}


# ============================================================
# VALIDATE DEPLOYMENT ARCHIVE
#
# Prevent accidental path traversal.
# ============================================================

validate_archive() {

    local entry


    while IFS= read -r entry; do


        case "${entry}" in

            /*|../*|*/../*|*/..)

                die "Unsafe path found inside deployment archive: ${entry}"

                ;;

        esac

    done < <(

        tar -tzf \
            "${ARCHIVE_FILE}"

    )
}


# ============================================================
# RUN DATABASE MIGRATIONS
#
# IMPORTANT:
#
# We do not source the .env through Bash.
#
# dotenv loads the real server .env directly.
#
# This avoids problems when .env values contain characters that
# Bash interprets differently.
# ============================================================

run_migrations() {

    local release_dir="$1"


    local migration_cwd="${release_dir}/${MIGRATION_CWD_REL}"


    local typeorm_cli="${release_dir}/node_modules/typeorm/cli.js"


    [[ -d "${migration_cwd}" ]] || \
        die "Compiled migration working directory is missing: ${migration_cwd}"


    [[ -f "${migration_cwd}/${MIGRATION_DATA_SOURCE}" ]] || \
        die "Compiled TypeORM data source is missing: ${migration_cwd}/${MIGRATION_DATA_SOURCE}"


    [[ -f "${typeorm_cli}" ]] || \
        die "TypeORM CLI is missing from production dependencies: ${typeorm_cli}"


    log "Running TypeORM migrations..."


    (
        cd "${migration_cwd}"


        NODE_ENV=production \
        APP_ENV=production \
        DOTENV_CONFIG_PATH="${ENV_FILE}" \
        "${NODE_BIN}" \
            -r dotenv/config \
            "${typeorm_cli}" \
            -d "${MIGRATION_DATA_SOURCE}" \
            migration:run
    )


    log "Database migrations completed."
}


# ============================================================
# PREPARE RELEASE
# ============================================================

prepare_release() {

    local release_dir="$1"


    # --------------------------------------------------------
    # Required artifact files
    # --------------------------------------------------------

    [[ -f "${release_dir}/package.json" ]] || \
        die "package.json is missing from deployment artifact."


    [[ -f "${release_dir}/package-lock.json" ]] || \
        die "package-lock.json is missing from deployment artifact."


    [[ -f "${release_dir}/${APP_ENTRY}" ]] || \
        die "Compiled backend entry file is missing: ${APP_ENTRY}"


    # --------------------------------------------------------
    # Production dependencies
    # --------------------------------------------------------

    log "Installing production dependencies..."


    (
        cd "${release_dir}"


        "${NPM_BIN}" ci \
            --omit=dev \
            --no-audit \
            --no-fund
    )


    # --------------------------------------------------------
    # Production environment
    #
    # Your SharedConfigModule searches:
    #
    # apps/insurance-portal-service/.env.production
    # apps/insurance-portal-service/.env
    #
    # Therefore we link the secure shared env here.
    # --------------------------------------------------------

    mkdir -p \
        "${release_dir}/apps/insurance-portal-service"


    ln -sfn \
        "${ENV_FILE}" \
        "${release_dir}/apps/insurance-portal-service/.env"


    # --------------------------------------------------------
    # Also provide root .env as a supported fallback.
    # --------------------------------------------------------

    ln -sfn \
        "${ENV_FILE}" \
        "${release_dir}/.env"


    # --------------------------------------------------------
    # Persistent uploads
    #
    # Releases are immutable.
    #
    # Uploaded documents must survive deployment and rollback.
    # --------------------------------------------------------

    ln -sfn \
        "${UPLOADS_DIR}" \
        "${release_dir}/uploads"


    # --------------------------------------------------------
    # Store Git commit SHA in release.
    # --------------------------------------------------------

    printf '%s\n' \
        "${RELEASE_SHA}" \
        > "${release_dir}/REVISION"


    chmod 0644 \
        "${release_dir}/REVISION"
}


# ============================================================
# DEPLOY
# ============================================================

perform_deploy() {

    # --------------------------------------------------------
    # Validate GitHub supplied values
    # --------------------------------------------------------

    [[ -n "${RELEASE_SHA}" ]] || \
        die "RELEASE_SHA is required."


    [[ -n "${RELEASE_ID}" ]] || \
        die "RELEASE_ID is required."


    [[ -n "${ARCHIVE_FILE}" ]] || \
        die "ARCHIVE_FILE is required."


    [[ -f "${ARCHIVE_FILE}" ]] || \
        die "Deployment archive not found: ${ARCHIVE_FILE}"


    validate_safe_release_id \
        "${RELEASE_ID}"


    local release_dir="${RELEASES_DIR}/${RELEASE_ID}"


    local previous_release


    previous_release="$(current_release_path)"


    # --------------------------------------------------------
    # Release IDs are immutable.
    # --------------------------------------------------------

    [[ ! -e "${release_dir}" ]] || \
        die "Release already exists: ${release_dir}"


    log "Preparing release ${RELEASE_ID} (${RELEASE_SHA})."


    validate_archive


    mkdir -p \
        "${release_dir}"


    local switched="false"

    local successful="false"


    # ========================================================
    # FAILURE HANDLER
    #
    # Only application code is automatically rolled back.
    #
    # Database migrations are NOT automatically reverted.
    # ========================================================

    deployment_failure_handler() {

        local exit_code=$?


        trap - ERR


        warn "Deployment failed with exit code ${exit_code}."


        # ----------------------------------------------------
        # If new version became active, restore previous app.
        # ----------------------------------------------------

        if [[ "${switched}" == "true" ]]; then


            if [[ -n "${previous_release}" \
                && -d "${previous_release}" \
                && -f "${previous_release}/${APP_ENTRY}" ]]; then


                warn "Restoring previous application release: ${previous_release}"


                ln -sfn \
                    "${previous_release}" \
                    "${CURRENT_LINK}.next"


                mv -Tf \
                    "${CURRENT_LINK}.next" \
                    "${CURRENT_LINK}"


                local previous_sha


                previous_sha="$(release_sha_from_dir "${previous_release}")"


                restart_pm2 \
                    "${previous_sha}" \
                    || true


                if health_check; then


                    "${PM2_BIN}" save || true


                    warn "Previous application release restored successfully."


                else


                    warn "Previous application release was restored but failed readiness checks."


                fi


            else


                warn "No previous release exists, or it is missing a valid backend entry file: ${previous_release}"


                warn "Removing current symlink and stopping ${APP_NAME}."


                rm -f \
                    "${CURRENT_LINK}"


                "${PM2_BIN}" \
                    delete \
                    "${APP_NAME}" \
                    >/dev/null 2>&1 \
                    || true


                "${PM2_BIN}" \
                    save \
                    >/dev/null 2>&1 \
                    || true

            fi

        fi


        # ----------------------------------------------------
        # Remove failed application release if not active.
        # ----------------------------------------------------

        if [[ "${successful}" != "true" ]]; then


            if [[ -d "${release_dir}" ]]; then


                if [[ "${release_dir}" != "$(current_release_path)" ]]; then


                    rm -rf -- \
                        "${release_dir}" \
                        || true

                fi

            fi

        fi


        exit "${exit_code}"
    }


    trap deployment_failure_handler ERR


    # --------------------------------------------------------
    # Extract GitHub artifact
    # --------------------------------------------------------

    log "Extracting release..."


    tar -xzf \
        "${ARCHIVE_FILE}" \
        -C "${release_dir}"


    # --------------------------------------------------------
    # Install deps / link persistent data
    # --------------------------------------------------------

    prepare_release \
        "${release_dir}"


    # --------------------------------------------------------
    # Database migration happens BEFORE application activation.
    # --------------------------------------------------------

    run_migrations \
        "${release_dir}"


    # --------------------------------------------------------
    # Save previous release before switching.
    # --------------------------------------------------------

    if [[ -n "${previous_release}" ]]; then


        printf '%s\n' \
            "${previous_release}" \
            > "${PREVIOUS_RELEASE_FILE}"


        chmod 0640 \
            "${PREVIOUS_RELEASE_FILE}"

    fi


    # --------------------------------------------------------
    # Atomic application switch
    # --------------------------------------------------------

    log "Activating release: ${release_dir}"


    ln -sfn \
        "${release_dir}" \
        "${CURRENT_LINK}.next"


    mv -Tf \
        "${CURRENT_LINK}.next" \
        "${CURRENT_LINK}"


    switched="true"


    # --------------------------------------------------------
    # PM2 reload
    # --------------------------------------------------------

    restart_pm2 \
        "${RELEASE_SHA}"


    # --------------------------------------------------------
    # Production readiness check
    # --------------------------------------------------------

    if ! health_check; then

        warn "New release failed readiness check."

        "${PM2_BIN}" \
            logs \
            "${APP_NAME}" \
            --lines 120 \
            --nostream \
            || true

        return 1

    fi


    # --------------------------------------------------------
    # Save PM2 configuration
    # --------------------------------------------------------

    "${PM2_BIN}" save


    successful="true"


    trap - ERR


    # --------------------------------------------------------
    # Delete old releases
    # --------------------------------------------------------

    cleanup_old_releases


    log "Backend deployment completed successfully."


    log "Current release: $(current_release_path)"
}


# ============================================================
# MANUAL ROLLBACK
# ============================================================

perform_manual_rollback() {

    local requested="${2:-}"

    local target=""


    # --------------------------------------------------------
    # Specific release requested
    # --------------------------------------------------------

    if [[ -n "${requested}" ]]; then


        if [[ -d "${requested}" ]]; then


            target="$(readlink -f "${requested}")"


        elif [[ -d "${RELEASES_DIR}/${requested}" ]]; then


            target="$(readlink -f "${RELEASES_DIR}/${requested}")"


        else


            die "Requested rollback release not found: ${requested}"

        fi


    # --------------------------------------------------------
    # Otherwise use previous-release marker.
    # --------------------------------------------------------

    elif [[ -f "${PREVIOUS_RELEASE_FILE}" ]]; then


        target="$(cat "${PREVIOUS_RELEASE_FILE}")"


    else


        die "No previous-release marker exists and no rollback target was supplied."

    fi


    local old_current


    old_current="$(current_release_path)"


    rollback_to_release \
        "${target}"


    # --------------------------------------------------------
    # Make rollback reversible.
    # --------------------------------------------------------

    if [[ -n "${old_current}" && "${old_current}" != "${target}" ]]; then


        printf '%s\n' \
            "${old_current}" \
            > "${PREVIOUS_RELEASE_FILE}"

    fi
}


# ============================================================
# MAIN
# ============================================================

main() {

    # --------------------------------------------------------
    # Validate numeric configuration.
    # --------------------------------------------------------

    validate_integer \
        "${KEEP_RELEASES}" \
        "KEEP_RELEASES"


    validate_integer \
        "${HEALTH_ATTEMPTS}" \
        "HEALTH_ATTEMPTS"


    validate_integer \
        "${HEALTH_INTERVAL_SECONDS}" \
        "HEALTH_INTERVAL_SECONDS"


    (( KEEP_RELEASES >= 2 )) || \
        die "KEEP_RELEASES must be at least 2."


    (( HEALTH_ATTEMPTS >= 1 )) || \
        die "HEALTH_ATTEMPTS must be at least 1."


    # --------------------------------------------------------
    # Validate server directories.
    # --------------------------------------------------------

    [[ -d "${BASE_DIR}" ]] || \
        die "BASE_DIR does not exist: ${BASE_DIR}"


    [[ -d "${RELEASES_DIR}" ]] || \
        die "Releases directory does not exist: ${RELEASES_DIR}"


    [[ -d "${SHARED_DIR}" ]] || \
        die "Shared directory does not exist: ${SHARED_DIR}"


    [[ -d "${LOG_DIR}" ]] || \
        die "Log directory does not exist: ${LOG_DIR}"


    [[ -d "${TMP_DIR}" ]] || \
        die "Temporary directory does not exist: ${TMP_DIR}"


    [[ -f "${ENV_FILE}" ]] || \
        die "Production environment file does not exist: ${ENV_FILE}"


    [[ -d "${UPLOADS_DIR}" ]] || \
        die "Persistent uploads directory does not exist: ${UPLOADS_DIR}"


    # --------------------------------------------------------
    # Validate Node/npm/PM2
    # --------------------------------------------------------

    [[ -x "${NODE_BIN}" ]] || \
        die "Node binary is not executable: ${NODE_BIN}"


    [[ -x "${NPM_BIN}" ]] || \
        die "npm binary is not executable: ${NPM_BIN}"


    [[ -x "${PM2_BIN}" ]] || \
        die "PM2 binary is not executable: ${PM2_BIN}"


    # --------------------------------------------------------
    # Linux tools required.
    # --------------------------------------------------------

    require_command curl

    require_command tar

    require_command find

    require_command sort

    require_command flock


    # --------------------------------------------------------
    # Deployment lock
    #
    # Prevent backend deployment A and B from executing
    # simultaneously.
    # --------------------------------------------------------

    exec 9>"${LOCK_FILE}"


    if ! flock -n 9; then

        die "Another backend deployment or rollback is already running."

    fi


    # --------------------------------------------------------
    # Execute command
    # --------------------------------------------------------

    case "${COMMAND}" in


        deploy)

            perform_deploy

            ;;


        rollback)

            perform_manual_rollback "$@"

            ;;


        *)

            die "Unknown command '${COMMAND}'. Use 'deploy' or 'rollback'."

            ;;

    esac


    # --------------------------------------------------------
    # Remove uploaded artifact from tmp after successful run.
    # --------------------------------------------------------

    if [[ "${CLEAN_ARCHIVE}" == "true" ]]; then


        if [[ -n "${ARCHIVE_FILE}" && -f "${ARCHIVE_FILE}" ]]; then


            rm -f -- \
                "${ARCHIVE_FILE}"

        fi

    fi
}


main "$@"