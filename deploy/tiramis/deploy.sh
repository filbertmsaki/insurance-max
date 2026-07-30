#!/usr/bin/env bash
# Copy this once to /opt/apps/tiramis/shared/deploy.sh on the server (chmod +x).
# Invoked by the GitHub Actions workflow after it rsyncs a release into
# /opt/apps/tiramis/releases/<release-id>/.
set -euo pipefail

RELEASE_ID="${1:?usage: deploy.sh <release-id>}"
BASE_DIR="/opt/apps/tiramis"
RELEASE_DIR="$BASE_DIR/releases/$RELEASE_ID"
SHARED_DIR="$BASE_DIR/shared"
KEEP_RELEASES=5

cd "$RELEASE_DIR"

# Persistent config lives in shared/, symlinked into every release so the
# app's process.cwd()-relative "apps/tiramis/.env" lookup keeps resolving.
mkdir -p apps/tiramis
ln -sfn "$SHARED_DIR/.env" apps/tiramis/.env

# Materialize node_modules here from package.json/package-lock.json only —
# no other app's source or dev tooling ever reaches this box.
npm ci --omit=dev

node ./node_modules/typeorm/cli.js \
  -d dist/apps/tiramis/apps/tiramis/src/database/data-source.js \
  migration:run

ln -sfn "$RELEASE_DIR" "$BASE_DIR/current"

pm2 reload tiramis --update-env || pm2 start "$SHARED_DIR/ecosystem.config.js"
pm2 save

cd "$BASE_DIR/releases"
ls -1dt */ | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
