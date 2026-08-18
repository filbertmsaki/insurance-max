#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# Insurance Max
# Production Frontend Deployment
#
# Runs remotely on Ubuntu as insurance-deploy.
#
# Features:
#   - No sudo required
#   - Release-based deployment
#   - Server-managed .env.production
#   - Vite/Nx build output detection
#   - Generates server.mjs
#   - Generates ecosystem.config.cjs
#   - Atomic current symlink switch
#   - PM2 start/reload
#   - Direct health check
#   - Nginx health check
#   - Automatic rollback
#   - Old release cleanup
#   - Deployment locking
#
# Usage:
#
# bash deploy.sh \
#   /opt/apps/insurance-max/prod/frontend/tmp/release.tar.gz \
#   RELEASE_ID \
#   GIT_SHA
# ============================================================


# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

DEPLOY_USER="${DEPLOY_USER:-insurance-deploy}"

BASE_DIR="${BASE_DIR:-/opt/apps/insurance-max/prod/frontend}"

APP_RELATIVE_DIR="${APP_RELATIVE_DIR:-apps/insurance-portal-web}"

PM2_APP_NAME="${PM2_APP_NAME:-insurance-max-prod-web}"

APP_HOST="${APP_HOST:-127.0.0.1}"

APP_PORT="${APP_PORT:-9290}"

NGINX_PORT="${NGINX_PORT:-9092}"

KEEP_RELEASES="${KEEP_RELEASES:-5}"

HEALTH_RETRIES="${HEALTH_RETRIES:-30}"

HEALTH_SLEEP_SECONDS="${HEALTH_SLEEP_SECONDS:-2}"


# ------------------------------------------------------------
# Paths
# ------------------------------------------------------------

RELEASES_DIR="${BASE_DIR}/releases"

SHARED_DIR="${BASE_DIR}/shared"

LOG_DIR="${BASE_DIR}/logs"

TMP_DIR="${BASE_DIR}/tmp"

DEPLOYMENT_DIR="${SHARED_DIR}/deployment"

ENV_FILE="${SHARED_DIR}/.env.production"

SERVER_FILE="${SHARED_DIR}/server.mjs"

PM2_CONFIG="${SHARED_DIR}/ecosystem.config.cjs"

CURRENT_LINK="${BASE_DIR}/current"

LOCK_FILE="${SHARED_DIR}/deploy.lock"


# ------------------------------------------------------------
# Health URLs
# ------------------------------------------------------------

INTERNAL_HEALTH_URL="http://${APP_HOST}:${APP_PORT}/health"

NGINX_HEALTH_URL="http://127.0.0.1:${NGINX_PORT}/health"


# ------------------------------------------------------------
# Inputs
# ------------------------------------------------------------

CURRENT_USER="$(id -un)"

ARCHIVE="${1:-}"

RELEASE_ID="${2:-$(date -u +%Y%m%d%H%M%S)}"

GIT_SHA="${3:-unknown}"

RELEASE_DIR="${RELEASES_DIR}/${RELEASE_ID}"


# ------------------------------------------------------------
# State
# ------------------------------------------------------------

DEPLOY_SUCCEEDED=false

PREVIOUS_RELEASE=""


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

log() {

    printf \
        '\n[%s] %s\n' \
        "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        "$*"

}


fail() {

    printf '\nERROR: %s\n' "$*" >&2

    exit 1

}


current_release_path() {

    if [[ -L "${CURRENT_LINK}" ]]; then

        readlink -f \
            "${CURRENT_LINK}" \
            2>/dev/null \
            || true

    fi

}


activate_release() {

    local target="$1"

    local temp_link="${BASE_DIR}/.current.${RELEASE_ID}.$$"


    rm -f -- "${temp_link}"


    ln -s \
        "${target}" \
        "${temp_link}"


    mv -Tf \
        "${temp_link}" \
        "${CURRENT_LINK}"

}


# ------------------------------------------------------------
# Health check
# ------------------------------------------------------------

health_check() {

    local url="$1"

    local expected_release="$2"

    local attempt

    local body


    for attempt in $(seq 1 "${HEALTH_RETRIES}"); do

        body="$(
            curl \
                --silent \
                --show-error \
                --max-time 5 \
                "${url}" \
                2>/dev/null \
                || true
        )"


        if [[ "${body}" == *'"status":"ok"'* ]] \
            && [[ "${body}" == *"\"release\":\"${expected_release}\""* ]]; then

            echo "${body}"

            return 0

        fi


        echo \
            "Health check ${attempt}/${HEALTH_RETRIES} not ready yet."


        sleep "${HEALTH_SLEEP_SECONDS}"

    done


    return 1

}


# ------------------------------------------------------------
# Cleanup trap
# ------------------------------------------------------------

cleanup() {

    local status=$?


    if [[ -n "${ARCHIVE:-}" ]] \
        && [[ -f "${ARCHIVE}" ]]; then

        rm -f -- "${ARCHIVE}" || true

    fi


    if [[ "${DEPLOY_SUCCEEDED}" != "true" ]] \
        && [[ -d "${RELEASE_DIR:-}" ]]; then

        local active=""

        if [[ -L "${CURRENT_LINK}" ]]; then

            active="$(
                readlink -f \
                    "${CURRENT_LINK}" \
                    2>/dev/null \
                    || true
            )"

        fi


        if [[ "${active}" != "${RELEASE_DIR}" ]]; then

            rm -rf -- \
                "${RELEASE_DIR}" \
                || true

        fi

    fi


    exit "${status}"

}


trap cleanup EXIT


trap \
    'printf "\nERROR: Deployment failed at line %s.\n" "${LINENO}" >&2' \
    ERR


# ------------------------------------------------------------
# Rollback
# ------------------------------------------------------------

rollback() {

    log "Rolling back frontend deployment..."


    if [[ -n "${PREVIOUS_RELEASE}" ]] \
        && [[ -d "${PREVIOUS_RELEASE}" ]]; then

        local previous_id

        previous_id="$(
            basename "${PREVIOUS_RELEASE}"
        )"


        activate_release \
            "${PREVIOUS_RELEASE}"


        printf '%s\n' \
            "${previous_id}" \
            > "${DEPLOYMENT_DIR}/current-release"


        pm2 startOrReload \
            "${PM2_CONFIG}" \
            --only "${PM2_APP_NAME}" \
            --update-env \
            || true


        if health_check \
            "${INTERNAL_HEALTH_URL}" \
            "${previous_id}" \
            >/dev/null; then

            echo
            echo "[OK] Previous release restored:"
            echo "${previous_id}"

        else

            echo \
                "WARNING: Previous release was activated but health check failed." \
                >&2

        fi


        pm2 save >/dev/null || true


    else

        echo
        echo "No previous release exists."
        echo "Removing failed frontend process."


        rm -f -- \
            "${CURRENT_LINK}"


        pm2 delete \
            "${PM2_APP_NAME}" \
            >/dev/null 2>&1 \
            || true


        pm2 save \
            >/dev/null \
            || true


        : > "${DEPLOYMENT_DIR}/current-release"

    fi


    rm -rf -- \
        "${RELEASE_DIR}" \
        || true

}


# ------------------------------------------------------------
# Header
# ------------------------------------------------------------

log "Insurance Max frontend deployment"


echo "Deploy user : ${CURRENT_USER}"

echo "Base dir    : ${BASE_DIR}"

echo "Release     : ${RELEASE_ID}"

echo "Git SHA     : ${GIT_SHA}"

echo "Archive     : ${ARCHIVE}"

echo "PM2 app     : ${PM2_APP_NAME}"

echo "Frontend    : ${APP_HOST}:${APP_PORT}"

echo "Nginx       : 127.0.0.1:${NGINX_PORT}"


# ------------------------------------------------------------
# Validate user
# ------------------------------------------------------------

[[ "${CURRENT_USER}" == "${DEPLOY_USER}" ]] \
    || fail \
        "Run this deployment as '${DEPLOY_USER}', not '${CURRENT_USER}'."


# ------------------------------------------------------------
# Validate arguments
# ------------------------------------------------------------

[[ -n "${ARCHIVE}" ]] \
    || fail \
        "Usage: deploy.sh <release.tar.gz> [release-id] [git-sha]"


[[ -f "${ARCHIVE}" ]] \
    || fail \
        "Release archive not found: ${ARCHIVE}"


# ------------------------------------------------------------
# Required commands
# ------------------------------------------------------------

for cmd in \
    node \
    npm \
    pm2 \
    curl \
    tar \
    flock \
    find \
    sort \
    awk \
    grep \
    ln \
    mv \
    readlink
do

    command -v "${cmd}" \
        >/dev/null 2>&1 \
        || fail \
            "Required command not found: ${cmd}"

done


# ------------------------------------------------------------
# Validate directories
# ------------------------------------------------------------

for dir in \
    "${BASE_DIR}" \
    "${RELEASES_DIR}" \
    "${SHARED_DIR}" \
    "${LOG_DIR}" \
    "${TMP_DIR}" \
    "${DEPLOYMENT_DIR}"
do

    [[ -d "${dir}" ]] \
        || fail \
            "Required directory does not exist: ${dir}"


    [[ -w "${dir}" ]] \
        || fail \
            "Deployment user cannot write to: ${dir}"

done


# ------------------------------------------------------------
# Validate environment
# ------------------------------------------------------------

[[ -f "${ENV_FILE}" ]] \
    || fail \
        "Production frontend environment file missing: ${ENV_FILE}"


[[ -r "${ENV_FILE}" ]] \
    || fail \
        "Production frontend environment is not readable: ${ENV_FILE}"


# ------------------------------------------------------------
# Runtime versions
# ------------------------------------------------------------

log "Runtime versions"


echo "Node:"
node -v


echo "npm:"
npm -v


echo "PM2:"
pm2 -v


# ------------------------------------------------------------
# Deployment lock
# ------------------------------------------------------------

exec 9>"${LOCK_FILE}"


if ! flock -n 9; then

    fail \
        "Another frontend deployment is already running."

fi


# ------------------------------------------------------------
# Release validation
# ------------------------------------------------------------

if [[ -e "${RELEASE_DIR}" ]]; then

    fail \
        "Release already exists: ${RELEASE_DIR}"

fi


# ------------------------------------------------------------
# Previous release
# ------------------------------------------------------------

PREVIOUS_RELEASE="$(
    current_release_path
)"


if [[ -n "${PREVIOUS_RELEASE}" ]]; then

    echo
    echo "Previous release:"
    echo "${PREVIOUS_RELEASE}"

else

    echo
    echo "Previous release:"
    echo "NONE"

fi


# ------------------------------------------------------------
# Validate archive
# ------------------------------------------------------------

log "Validating release archive"


# Reject:
#
# /absolute/path
# ../path
# directory/../../path

if tar -tzf "${ARCHIVE}" \
    | awk '
        /^\// {
            bad=1
        }

        /(^|\/)\.\.($|\/)/ {
            bad=1
        }

        END {
            exit bad ? 0 : 1
        }
    '
then

    fail \
        "Archive contains an unsafe path."

fi


# ------------------------------------------------------------
# Extract release
# ------------------------------------------------------------

log "Extracting release"


mkdir -p \
    "${RELEASE_DIR}"


tar \
    -xzf "${ARCHIVE}" \
    -C "${RELEASE_DIR}"


# ------------------------------------------------------------
# Validate project structure
# ------------------------------------------------------------

[[ -f "${RELEASE_DIR}/package.json" ]] \
    || fail \
        "Root package.json is missing from release."


[[ -f "${RELEASE_DIR}/package-lock.json" ]] \
    || fail \
        "Root package-lock.json is missing from release."


FRONTEND_DIR="${RELEASE_DIR}/${APP_RELATIVE_DIR}"


[[ -d "${FRONTEND_DIR}" ]] \
    || fail \
        "Frontend directory missing: ${FRONTEND_DIR}"


[[ -f "${FRONTEND_DIR}/package.json" ]] \
    || fail \
        "Frontend package.json missing: ${FRONTEND_DIR}/package.json"


# ------------------------------------------------------------
# Link production environment
# ------------------------------------------------------------

log "Linking server-managed production environment"


rm -f -- \
    "${FRONTEND_DIR}/.env.production"


ln -s \
    "${ENV_FILE}" \
    "${FRONTEND_DIR}/.env.production"


# ------------------------------------------------------------
# Install dependencies / build frontend
#
# If the release archive already ships a prebuilt dist/ (built
# on the CI runner, which has far more RAM than this server),
# skip installing and building here entirely. Otherwise fall
# back to building locally (e.g. manual/legacy releases).
# ------------------------------------------------------------

cd "${RELEASE_DIR}"


if [[ -d "${FRONTEND_DIR}/dist" ]]; then

    log "Prebuilt frontend dist found in release, skipping local build"

else

    log "No prebuilt dist found, installing build dependencies"


    NODE_ENV=development npm ci \
        --include=dev \
        --no-audit \
        --no-fund


    if [[ -f "${APP_RELATIVE_DIR}/package-lock.json" ]]; then

        echo "Installing app-local dependencies for ${APP_RELATIVE_DIR}"

        NODE_ENV=development npm ci \
            --prefix "${APP_RELATIVE_DIR}" \
            --include=dev \
            --no-audit \
            --no-fund

    fi


    log "Building Insurance Max frontend"


    if node -e \
        "const p=require('./${APP_RELATIVE_DIR}/package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)"
    then

        echo "Using frontend package build script."


        NODE_ENV=development \
        NODE_OPTIONS="--max-old-space-size=${BUILD_NODE_MAX_OLD_SPACE_MB:-1536}" \
        npm \
            --prefix "${APP_RELATIVE_DIR}" \
            run build


    elif node -e \
        "const p=require('./package.json'); process.exit(p.scripts && p.scripts['build:frontend'] ? 0 : 1)"
    then

        echo "Using root build:frontend script."


        npm run build:frontend


    else

        fail \
            "No frontend build script found."

    fi

fi


# ------------------------------------------------------------
# Locate Vite/Nx build output
# ------------------------------------------------------------

log "Locating frontend build output"


DIST_DIR=""


for candidate in \
    "${FRONTEND_DIR}/dist" \
    "${RELEASE_DIR}/dist/apps/insurance-portal-web" \
    "${RELEASE_DIR}/dist/apps/insurance-portal-web/browser"
do

    if [[ -f "${candidate}/index.html" ]]; then

        DIST_DIR="${candidate}"

        break

    fi

done


# ------------------------------------------------------------
# Last-resort dist detection
# ------------------------------------------------------------

if [[ -z "${DIST_DIR}" ]]; then

    INDEX_FILE="$(
        find \
            "${RELEASE_DIR}" \
            -maxdepth 7 \
            -type f \
            -name index.html \
            \( \
                -path '*/insurance-portal-web/*' \
                -o \
                -path '*/apps/insurance-portal-web/*' \
            \) \
            -print \
            -quit \
            || true
    )"


    if [[ -n "${INDEX_FILE}" ]]; then

        DIST_DIR="$(
            dirname "${INDEX_FILE}"
        )"

    fi

fi


[[ -n "${DIST_DIR}" ]] \
    || fail \
        "Could not locate frontend build output."


[[ -f "${DIST_DIR}/index.html" ]] \
    || fail \
        "Built frontend index.html is missing."


# ------------------------------------------------------------
# Convert dist path to release-relative path
# ------------------------------------------------------------

DIST_RELATIVE="${DIST_DIR#${RELEASE_DIR}/}"


[[ "${DIST_RELATIVE}" != "${DIST_DIR}" ]] \
    || fail \
        "Frontend build output is outside release directory."


echo
echo "Detected frontend build:"
echo "${DIST_RELATIVE}"


# ------------------------------------------------------------
# Create stable runtime dist path
#
# Regardless whether the actual build is:
#
# apps/insurance-portal-web/dist
#
# or:
#
# dist/apps/insurance-portal-web
#
# runtime always uses:
#
# current/frontend-dist
# ------------------------------------------------------------

rm -f -- \
    "${RELEASE_DIR}/frontend-dist"


ln -s \
    "${DIST_RELATIVE}" \
    "${RELEASE_DIR}/frontend-dist"


[[ -f "${RELEASE_DIR}/frontend-dist/index.html" ]] \
    || fail \
        "frontend-dist symlink is invalid."


printf '%s\n' \
    "${DIST_RELATIVE}" \
    > "${RELEASE_DIR}/.frontend-dist-path"


printf '%s\n' \
    "${GIT_SHA}" \
    > "${RELEASE_DIR}/.git-sha"


# ------------------------------------------------------------
# Remove build-only node_modules
# ------------------------------------------------------------

log "Removing build-only node_modules"


rm -rf -- \
    "${RELEASE_DIR}/node_modules"


if [[ -d "${FRONTEND_DIR}/node_modules" ]]; then

    rm -rf -- \
        "${FRONTEND_DIR}/node_modules"

fi


# ============================================================
# Generate production static server
# ============================================================

log "Generating ${SERVER_FILE}"


cat > "${SERVER_FILE}" <<'NODE_SERVER'
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const HOST =
  process.env.HOST ||
  '127.0.0.1';

const PORT =
  Number(process.env.PORT || 9290);

const BASE_DIR =
  process.env.FRONTEND_BASE_DIR ||
  '/opt/apps/insurance-max/prod/frontend';

const CURRENT_LINK =
  path.join(
    BASE_DIR,
    'current',
  );


const MIME_TYPES = {

  '.html':
    'text/html; charset=utf-8',

  '.js':
    'application/javascript; charset=utf-8',

  '.mjs':
    'application/javascript; charset=utf-8',

  '.css':
    'text/css; charset=utf-8',

  '.json':
    'application/json; charset=utf-8',

  '.svg':
    'image/svg+xml',

  '.png':
    'image/png',

  '.jpg':
    'image/jpeg',

  '.jpeg':
    'image/jpeg',

  '.gif':
    'image/gif',

  '.webp':
    'image/webp',

  '.ico':
    'image/x-icon',

  '.txt':
    'text/plain; charset=utf-8',

  '.xml':
    'application/xml; charset=utf-8',

  '.pdf':
    'application/pdf',

  '.woff':
    'font/woff',

  '.woff2':
    'font/woff2',

  '.ttf':
    'font/ttf',

  '.map':
    'application/json; charset=utf-8',

};


function getRuntime() {

  const releaseDir =
    fs.realpathSync(
      CURRENT_LINK,
    );


  const distDir =
    fs.realpathSync(
      path.join(
        CURRENT_LINK,
        'frontend-dist',
      ),
    );


  if (
    distDir !== releaseDir &&
    !distDir.startsWith(
      `${releaseDir}${path.sep}`,
    )
  ) {

    throw new Error(
      'frontend-dist resolves outside active release',
    );

  }


  return {

    releaseDir,

    distDir,

    release:
      path.basename(
        releaseDir,
      ),

  };

}


function commonHeaders(res) {

  res.setHeader(
    'X-Content-Type-Options',
    'nosniff',
  );


  res.setHeader(
    'Referrer-Policy',
    'strict-origin-when-cross-origin',
  );

}


function sendJson(
  req,
  res,
  statusCode,
  value,
) {

  const body =
    JSON.stringify(value);


  res.statusCode =
    statusCode;


  res.setHeader(
    'Content-Type',
    'application/json; charset=utf-8',
  );


  res.setHeader(
    'Cache-Control',
    'no-store',
  );


  res.setHeader(
    'Content-Length',
    Buffer.byteLength(body),
  );


  commonHeaders(res);


  if (req.method === 'HEAD') {

    res.end();

  } else {

    res.end(body);

  }

}


function sendFile(
  req,
  res,
  filePath,
  stats,
) {

  const extension =
    path
      .extname(filePath)
      .toLowerCase();


  const contentType =
    MIME_TYPES[extension] ||
    'application/octet-stream';


  res.statusCode =
    200;


  res.setHeader(
    'Content-Type',
    contentType,
  );


  res.setHeader(
    'Content-Length',
    stats.size,
  );


  res.setHeader(
    'Last-Modified',
    stats.mtime.toUTCString(),
  );


  commonHeaders(res);


  if (
    filePath.endsWith(
      'index.html',
    )
  ) {

    res.setHeader(
      'Cache-Control',
      'no-cache, no-store, must-revalidate',
    );

  } else if (
    filePath.includes(
      `${path.sep}assets${path.sep}`,
    )
  ) {

    res.setHeader(
      'Cache-Control',
      'public, max-age=31536000, immutable',
    );

  } else {

    res.setHeader(
      'Cache-Control',
      'public, max-age=3600',
    );

  }


  if (req.method === 'HEAD') {

    res.end();

    return;

  }


  const stream =
    fs.createReadStream(
      filePath,
    );


  stream.on(
    'error',
    (error) => {

      console.error(
        'Static file stream error:',
        error,
      );


      if (!res.headersSent) {

        res.statusCode =
          500;

      }


      res.end();

    },
  );


  stream.pipe(res);

}


function serveIndex(
  req,
  res,
  distDir,
) {

  const indexFile =
    path.join(
      distDir,
      'index.html',
    );


  fs.stat(
    indexFile,
    (error, stats) => {

      if (
        error ||
        !stats.isFile()
      ) {

        sendJson(
          req,
          res,
          503,
          {
            status:
              'unavailable',

            service:
              'insurance-max-prod-web',
          },
        );

        return;

      }


      sendFile(
        req,
        res,
        indexFile,
        stats,
      );

    },
  );

}


const server =
  http.createServer(
    (req, res) => {

      try {

        if (
          req.method !== 'GET' &&
          req.method !== 'HEAD'
        ) {

          res.setHeader(
            'Allow',
            'GET, HEAD',
          );


          sendJson(
            req,
            res,
            405,
            {
              status:
                'error',

              message:
                'Method not allowed',
            },
          );


          return;

        }


        const runtime =
          getRuntime();


        const requestUrl =
          new URL(
            req.url || '/',
            `http://${req.headers.host || 'localhost'}`,
          );


        const pathname =
          decodeURIComponent(
            requestUrl.pathname,
          );


        if (pathname === '/health') {

          sendJson(
            req,
            res,
            200,
            {
              status:
                'ok',

              service:
                'insurance-max-prod-web',

              release:
                runtime.release,
            },
          );

          return;

        }


        const safeRelative =
          path
            .normalize(pathname)
            .replace(/^(\.\.[/\\])+/, '')
            .replace(/^[/\\]+/, '');


        const requestedPath =
          path.join(
            runtime.distDir,
            safeRelative,
          );


        if (
          requestedPath !== runtime.distDir &&
          !requestedPath.startsWith(
            `${runtime.distDir}${path.sep}`,
          )
        ) {

          serveIndex(
            req,
            res,
            runtime.distDir,
          );

          return;

        }


        fs.stat(
          requestedPath,
          (error, stats) => {

            if (
              !error &&
              stats.isFile()
            ) {

              sendFile(
                req,
                res,
                requestedPath,
                stats,
              );

              return;

            }


            serveIndex(
              req,
              res,
              runtime.distDir,
            );

          },
        );

      } catch (error) {

        console.error(
          'Frontend request error:',
          error,
        );


        sendJson(
          req,
          res,
          503,
          {
            status:
              'unavailable',

            service:
              'insurance-max-prod-web',
          },
        );

      }

    },
  );


server.listen(
  PORT,
  HOST,
  () => {

    console.log(
      `Insurance Max frontend listening on http://${HOST}:${PORT}`,
    );


    console.log(
      `Frontend base directory: ${BASE_DIR}`,
    );

  },
);


function shutdown(signal) {

  console.log(
    `${signal} received; shutting down.`,
  );


  server.close(() => {

    process.exit(0);

  });


  setTimeout(() => {

    process.exit(1);

  }, 10000).unref();

}


process.on(
  'SIGINT',
  () => shutdown('SIGINT'),
);


process.on(
  'SIGTERM',
  () => shutdown('SIGTERM'),
);
NODE_SERVER


# ------------------------------------------------------------
# Generate PM2 ecosystem configuration
# ------------------------------------------------------------

log "Generating ${PM2_CONFIG}"


PM2_CONFIG_TMP="${SHARED_DIR}/ecosystem.config.tmp.$$.cjs"


cat > "${PM2_CONFIG_TMP}" <<EOF_PM2
module.exports = {
  apps: [
    {
      name: '${PM2_APP_NAME}',

      cwd: '${SHARED_DIR}',

      script: '${SERVER_FILE}',

      instances: 1,

      exec_mode: 'fork',

      autorestart: true,

      watch: false,

      max_memory_restart: '250M',

      restart_delay: 2000,

      exp_backoff_restart_delay: 100,

      kill_timeout: 10000,

      listen_timeout: 10000,

      time: true,

      merge_logs: true,

      out_file: '${LOG_DIR}/out.log',

      error_file: '${LOG_DIR}/error.log',

      env: {
        NODE_ENV: 'production',

        HOST: '${APP_HOST}',

        PORT: '${APP_PORT}',

        FRONTEND_BASE_DIR: '${BASE_DIR}'
      }
    }
  ]
};
EOF_PM2


node \
    --check \
    "${PM2_CONFIG_TMP}" \
    >/dev/null


mv -f \
    "${PM2_CONFIG_TMP}" \
    "${PM2_CONFIG}"


chmod 0640 \
    "${PM2_CONFIG}"


# ------------------------------------------------------------
# Persist deployment metadata
# ------------------------------------------------------------

if [[ -n "${PREVIOUS_RELEASE}" ]]; then

    printf '%s\n' \
        "$(basename "${PREVIOUS_RELEASE}")" \
        > "${DEPLOYMENT_DIR}/previous-release"

fi


# ------------------------------------------------------------
# Activate release
# ------------------------------------------------------------

log "Activating release ${RELEASE_ID}"


activate_release \
    "${RELEASE_DIR}"


printf '%s\n' \
    "${RELEASE_ID}" \
    > "${DEPLOYMENT_DIR}/current-release"


# ------------------------------------------------------------
# Start / reload PM2
# ------------------------------------------------------------

log "Starting frontend via PM2"


if pm2 describe "${PM2_APP_NAME}" >/dev/null 2>&1; then

    pm2 reload \
        "${PM2_CONFIG}" \
        --only "${PM2_APP_NAME}" \
        --update-env

else

    pm2 start \
        "${PM2_CONFIG}" \
        --only "${PM2_APP_NAME}"

fi


# ------------------------------------------------------------
# Health checks
# ------------------------------------------------------------

log "Running internal health check"


if ! health_check \
    "${INTERNAL_HEALTH_URL}" \
    "${RELEASE_ID}" \
    >/dev/null
then

    echo \
        "Internal health check failed." \
        >&2


    pm2 logs \
        "${PM2_APP_NAME}" \
        --lines 120 \
        --nostream \
        || true


    rollback


    fail \
        "Frontend deployment failed health check."

fi


log "Running Nginx health check"


if ! health_check \
    "${NGINX_HEALTH_URL}" \
    "${RELEASE_ID}" \
    >/dev/null
then

    echo \
        "Nginx health check failed." \
        >&2


    rollback


    fail \
        "Frontend deployment failed Nginx health check."

fi


pm2 save


# ------------------------------------------------------------
# Success
# ------------------------------------------------------------

DEPLOY_SUCCEEDED=true


log "Frontend deployment successful"


echo
echo "Release:"
echo "${RELEASE_ID}"


echo
echo "Current:"
current_release_path


echo
echo "PM2 application:"
echo "${PM2_APP_NAME}"


echo
echo "Internal health:"
echo "${INTERNAL_HEALTH_URL}"


echo
echo "Nginx health:"
echo "${NGINX_HEALTH_URL}"


echo
echo "PM2 status:"


pm2 status \
    "${PM2_APP_NAME}"


echo
echo "Health response:"


curl \
    --fail \
    --silent \
    --show-error \
    "${NGINX_HEALTH_URL}"


echo


# ------------------------------------------------------------
# Remove old releases
# ------------------------------------------------------------

log "Cleaning up old releases"


mapfile -t ALL_RELEASES < <(
    find \
        "${RELEASES_DIR}" \
        -mindepth 1 \
        -maxdepth 1 \
        -type d \
        -printf '%T@ %p\n' \
        | sort -rn \
        | cut -d' ' -f2-
)


RELEASE_INDEX=0


for old_release in "${ALL_RELEASES[@]:-}"; do

    RELEASE_INDEX=$((RELEASE_INDEX + 1))


    if (( RELEASE_INDEX <= KEEP_RELEASES )); then

        continue

    fi


    if [[ "${old_release}" == "$(current_release_path)" ]]; then

        continue

    fi


    if [[ -n "${PREVIOUS_RELEASE}" ]] \
        && [[ "${old_release}" == "${PREVIOUS_RELEASE}" ]]; then

        continue

    fi


    log "Removing old release: ${old_release}"


    rm -rf -- \
        "${old_release}"

done