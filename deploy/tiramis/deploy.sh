#!/usr/bin/env bash
set -Eeuo pipefail

RELEASE_ID="${1:?usage: deploy.sh <release-id>}"

BASE_DIR="${BASE_DIR:-/opt/apps/tiramis}"
RELEASE_DIR="$BASE_DIR/releases/$RELEASE_ID"
SHARED_DIR="$BASE_DIR/shared"
CURRENT_LINK="$BASE_DIR/current"

KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:9090/health}"
PM2_APP_NAME="${PM2_APP_NAME:-tiramis}"

DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-$BASE_DIR/shared/deploy.lock}"

PREVIOUS_RELEASE="$(
  readlink -f "$CURRENT_LINK" 2>/dev/null || true
)"

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$*"
}

show_logs() {
  pm2 logs "$PM2_APP_NAME" \
    --lines 120 \
    --nostream || true
}

rollback() {
  if [[ -n "$PREVIOUS_RELEASE" && -d "$PREVIOUS_RELEASE" ]]; then
    log "Rolling back current symlink to $PREVIOUS_RELEASE"

    ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"

    pm2 startOrReload \
      "$SHARED_DIR/ecosystem.config.js" \
      --only "$PM2_APP_NAME" \
      --update-env || true

    pm2 save || true
  else
    log 'No previous release is available for rollback.'
  fi
}

on_error() {
  local status=$?
  local line_number="${1:-unknown}"

  log "Deployment failed at line $line_number with status $status"

  show_logs
  rollback

  exit "$status"
}

trap 'on_error $LINENO' ERR

command -v node >/dev/null || {
  log 'Node.js is not installed.'
  exit 1
}

command -v npm >/dev/null || {
  log 'npm is not installed.'
  exit 1
}

command -v pm2 >/dev/null || {
  log 'PM2 is not installed.'
  exit 1
}

command -v curl >/dev/null || {
  log 'curl is not installed.'
  exit 1
}

command -v flock >/dev/null || {
  log 'flock is not installed.'
  exit 1
}

mkdir -p "$SHARED_DIR"

exec 9>"$DEPLOY_LOCK_FILE"

if ! flock -n 9; then
  log 'Another TIRAMIS deployment is already running.'
  exit 1
fi

required_files=(
  "$RELEASE_DIR/package.json"
  "$RELEASE_DIR/package-lock.json"
  "$RELEASE_DIR/REVISION"
  "$RELEASE_DIR/dist/apps/tiramis/apps/tiramis/src/main.js"
  "$RELEASE_DIR/dist/apps/tiramis/apps/tiramis/src/database/data-source.js"
  "$SHARED_DIR/.env"
  "$SHARED_DIR/ecosystem.config.js"
)

for required in "${required_files[@]}"; do
  [[ -e "$required" ]] || {
    log "Missing required file: $required"
    exit 1
  }
done

[[ "$(cat "$RELEASE_DIR/REVISION")" == "$RELEASE_ID" ]] || {
  log 'Release ID does not match the artifact revision.'
  exit 1
}

cd "$RELEASE_DIR"

mkdir -p apps/tiramis

ln -sfn \
  "$SHARED_DIR/.env" \
  apps/tiramis/.env

ln -sfn \
  "$SHARED_DIR/.env" \
  .env

log "Deploying TIRAMIS release $RELEASE_ID"
log "Node version: $(node --version)"
log "npm version: $(npm --version)"

log 'Installing production dependencies'

npm ci \
  --omit=dev \
  --no-audit \
  --no-fund

log 'Running TIRAMIS database migrations'

NODE_ENV=production \
node ./node_modules/typeorm/cli.js \
  -d dist/apps/tiramis/apps/tiramis/src/database/data-source.js \
  migration:run

log 'Switching current release'

ln -sfn \
  "$RELEASE_DIR" \
  "$CURRENT_LINK"

log 'Starting or reloading PM2'

pm2 startOrReload \
  "$SHARED_DIR/ecosystem.config.js" \
  --only "$PM2_APP_NAME" \
  --update-env

pm2 save

log "Waiting for health endpoint: $HEALTH_URL"

HEALTH_CODE='000'

for attempt in {1..30}; do
  HEALTH_CODE="$(curl -sS \
    -o /dev/null \
    -w '%{http_code}' \
    --connect-timeout 3 \
    --max-time 10 \
    "$HEALTH_URL" || true)"

  if [[ "$HEALTH_CODE" == '200' ]]; then
    log 'Health check passed.'
    break
  fi

  log "Health check attempt $attempt/30 returned HTTP $HEALTH_CODE"

  if [[ "$attempt" == '30' ]]; then
    log "Health check failed with HTTP $HEALTH_CODE"
    exit 1
  fi

  sleep 2
done

log "Keeping the newest $KEEP_RELEASES releases"

CURRENT_RELEASE="$(readlink -f "$CURRENT_LINK")"

find "$BASE_DIR/releases" \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -printf '%T@ %p\n' \
  | sort -nr \
  | awk -v keep="$KEEP_RELEASES" \
      'NR > keep { sub(/^[^ ]+ /, ""); print }' \
  | while IFS= read -r old_release; do
      [[ -n "$old_release" ]] || continue

      if [[ "$old_release" == "$CURRENT_RELEASE" || \
            "$old_release" == "$PREVIOUS_RELEASE" ]]; then
        log "Preserving release: $old_release"
        continue
      fi

      log "Removing old release: $old_release"

      rm -rf -- "$old_release"
    done

trap - ERR

log "Deployment completed successfully: $RELEASE_ID"