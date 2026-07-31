#!/usr/bin/env bash
set -Eeuo pipefail

RUNNER_USER="${RUNNER_USER:-alliance}"
BASE_DIR="/opt/apps/tiramis"

sudo apt update
sudo apt install -y curl git build-essential python3 rsync

command -v node >/dev/null || {
  echo 'Install Node.js 22 LTS before continuing.'
  exit 1
}

sudo npm install -g pm2
sudo mkdir -p "$BASE_DIR/releases" "$BASE_DIR/shared" "$BASE_DIR/certificates" /var/log/pm2
sudo chown -R "$RUNNER_USER:$RUNNER_USER" "$BASE_DIR" /var/log/pm2
sudo chmod 750 "$BASE_DIR" "$BASE_DIR/shared" "$BASE_DIR/certificates"

echo 'Copy deploy/tiramis/deploy.sh to /opt/apps/tiramis/shared/deploy.sh'
echo 'Copy deploy/tiramis/ecosystem.config.js to /opt/apps/tiramis/shared/ecosystem.config.js'
echo 'Create /opt/apps/tiramis/shared/.env with chmod 600'
echo 'Configure the GitHub runner with label: tiramis-prod'
