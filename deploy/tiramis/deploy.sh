#!/usr/bin/env bash
set -Eeuo pipefail

RELEASE_ID="${1:?usage: deploy.sh <release-id>}"
BASE_DIR="${BASE_DIR:-/opt/apps/tiramis}"
RELEASE_DIR="$BASE_DIR/releases/$RELEASE_ID"
SHARED_DIR="$BASE_DIR/shared"
CURRENT_LINK="$BASE_DIR/current"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:9090/health}"
PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }

rollback() {
  if [[ -n "$PREVIOUS_RELEASE" && -d "$PREVIOUS_RELEASE" ]]; then
    log "Rolling back current symlink to $PREVIOUS_RELEASE"
    ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"
    pm2 reload tiramis --update-env || true
    pm2 save || true
  fi
}

trap 'status=$?; log "Deployment failed with status $status"; rollback; exit $status' ERR

for required in "$RELEASE_DIR/package.json" "$RELEASE_DIR/package-lock.json" \
  "$RELEASE_DIR/dist/apps/tiramis/apps/tiramis/src/main.js" \
  "$SHARED_DIR/.env" "$SHARED_DIR/ecosystem.config.js"; do
  [[ -e "$required" ]] || { log "Missing required file: $required"; exit 1; }
done

cd "$RELEASE_DIR"
mkdir -p apps/tiramis
ln -sfn "$SHARED_DIR/.env" apps/tiramis/.env

log 'Installing production dependencies'
npm ci --omit=dev --no-audit --no-fund

log 'Running TIRAMIS database migrations'
NODE_ENV=production node ./node_modules/typeorm/cli.js \
  -d dist/apps/tiramis/apps/tiramis/src/database/data-source.js \
  migration:run

log 'Switching current release'
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

log 'Starting or reloading PM2'
pm2 startOrReload "$SHARED_DIR/ecosystem.config.js" --only tiramis --update-env
pm2 save

log 'Waiting for health endpoint'
for attempt in {1..30}; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 5 "$HEALTH_URL" || true)"
  if [[ "$code" == '200' ]]; then
    log 'Health check passed'
    break
  fi
  if [[ "$attempt" == '30' ]]; then
    log "Health check failed with HTTP $code"
    pm2 logs tiramis --lines 120 --nostream || true
    exit 1
  fi
  sleep 2
done

log "Keeping the newest $KEEP_RELEASES releases"
find "$BASE_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | awk -v keep="$KEEP_RELEASES" 'NR > keep { sub(/^[^ ]+ /, ""); print }' \
  | while IFS= read -r old_release; do
      [[ "$(readlink -f "$CURRENT_LINK")" == "$old_release" ]] || rm -rf "$old_release"
    done

trap - ERR
log "Deployment completed: $RELEASE_ID"
