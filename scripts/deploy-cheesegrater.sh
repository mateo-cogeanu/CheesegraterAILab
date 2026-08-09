#!/usr/bin/env bash

set -euo pipefail

repository=${CHEESEGRATER_AI_LAB_REPOSITORY:-https://github.com/mateo-cogeanu/CheesegraterAILab.git}
install_dir=${CHEESEGRATER_AI_LAB_INSTALL_DIR:-/opt/cheesegrater-ai-lab}
service_port=${CHEESEGRATER_AI_LAB_PORT:-8080}
ui_port=${CHEESEGRATER_AI_LAB_UI_PORT:-$((service_port + 1))}

if sudo test -d "$install_dir/.git"; then
  sudo git -C "$install_dir" pull --ff-only
else
  sudo git clone "$repository" "$install_dir"
fi

sudo /usr/bin/env PATH=/usr/local/bin:/usr/bin:/bin \
  npm --prefix "$install_dir/web" ci --ignore-scripts --no-audit --no-fund
sudo /usr/bin/env PATH=/usr/local/bin:/usr/bin:/bin \
  npm --prefix "$install_dir/web" run build

config_tmp=$(mktemp)
/usr/local/bin/node "$install_dir/scripts/generate-config.mjs" >"$config_tmp"
sudo install -d -o root -g root -m 0755 /etc/cheesegrater-ai-lab
sudo install -o root -g root -m 0644 "$config_tmp" /etc/cheesegrater-ai-lab/config.json

service_tmp=$(mktemp)
sed "s|WorkingDirectory=/opt/cheesegrater-ai-lab/web|WorkingDirectory=$install_dir/web|; s|Environment=PORT=8080|Environment=PORT=$service_port|; s|Environment=LAB_UI_PORT=8081|Environment=LAB_UI_PORT=$ui_port|; s|Environment=LAB_WEB_DIR=/opt/cheesegrater-ai-lab/web|Environment=LAB_WEB_DIR=$install_dir/web|; s|ExecStart=/usr/local/bin/node /opt/cheesegrater-ai-lab/server/lab-server.mjs|ExecStart=/usr/local/bin/node $install_dir/server/lab-server.mjs|" \
  "$install_dir/deploy/cheesegrater-ai-lab.service" >"$service_tmp"
sudo install -o root -g root -m 0644 "$service_tmp" /etc/systemd/system/cheesegrater-ai-lab.service

sudo systemctl daemon-reload
sudo systemctl enable --now cheesegrater-ai-lab.service
sudo systemctl restart cheesegrater-ai-lab.service

curl --fail --retry 15 --retry-delay 1 --retry-connrefused \
  "http://127.0.0.1:$service_port/api/health" >/dev/null
curl --fail "http://127.0.0.1:$service_port/api/system" >/dev/null
printf 'Cheesegrater AI Lab is listening on port %s.\n' "$service_port"
