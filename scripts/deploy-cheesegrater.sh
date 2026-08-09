#!/usr/bin/env bash

set -euo pipefail

project_dir=${CHEESEGRATER_AI_LAB_DIR:-/home/cogiart/CheesegraterAILab}

cd "$project_dir"
git pull --ff-only

cd web
npm ci --ignore-scripts --no-audit --no-fund
npm run build

sudo install -o root -g root -m 0644 \
  "$project_dir/deploy/cheesegrater-ai-lab.service" \
  /etc/systemd/system/cheesegrater-ai-lab.service
sudo systemctl daemon-reload
sudo systemctl enable --now cheesegrater-ai-lab.service
sudo systemctl restart cheesegrater-ai-lab.service

curl --fail --retry 10 --retry-delay 1 http://127.0.0.1:8080/ >/dev/null
printf '%s\n' 'Cheesegrater AI Lab is available at http://192.168.111.100:8080/'
