#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
controller="$repository_root/fan-control/fan_controller.py"
unit="$repository_root/deploy/cheesegrater-fan-control.service"
deploy_user=$(id -un)

if [[ ! -f "$controller" || ! -f "$unit" ]]; then
  echo "Fan controller deployment files are missing" >&2
  exit 1
fi

serial_port=${FAN_SERIAL_PORT:-}
if [[ -z "$serial_port" ]]; then
  shopt -s nullglob
  candidates=(
    /dev/serial/by-id/*Pico*-if02
    /dev/serial/by-id/*Pico*-if00
    /dev/ttyACM*
  )
  shopt -u nullglob
  for candidate in "${candidates[@]}"; do
    if sudo python3 "$controller" --probe "$candidate"; then
      serial_port=$candidate
      break
    fi
  done
fi

if [[ -z "$serial_port" ]]; then
  echo "No responding Pico fan controller was found" >&2
  exit 1
fi

sudo install -d -m 0755 /usr/local/libexec /etc/cheesegrater-fan-control
sudo install -m 0755 "$controller" /usr/local/libexec/cheesegrater-fan-control

config_file=$(mktemp)
unit_file=$(mktemp)
trap 'rm -f "$config_file" "$unit_file"' EXIT
sed "s/@DEPLOY_USER@/$deploy_user/g" "$unit" > "$unit_file"
sudo systemd-analyze verify "$unit_file"
sudo install -m 0644 "$unit_file" /etc/systemd/system/cheesegrater-fan-control.service
SERIAL_PORT="$serial_port" python3 -c '
import json, os
print(json.dumps({
    "version": 1,
    "serialPort": os.environ["SERIAL_PORT"],
    "baudRate": 115200,
    "pollSeconds": 5,
    "reconnectSeconds": 5,
    "connectionTimeoutSeconds": 2,
    "resendSeconds": 30,
    "minimumChangePercent": 2,
    "failSafeSpeedPercent": 100,
    "temperatureSensorGlob": "/sys/class/drm/card*/device/hwmon/hwmon*/temp*_input",
    "curve": [
        {"temperatureC": 30, "speedPercent": 40},
        {"temperatureC": 50, "speedPercent": 50},
        {"temperatureC": 60, "speedPercent": 65},
        {"temperatureC": 70, "speedPercent": 85},
        {"temperatureC": 80, "speedPercent": 100}
    ]
}, indent=2))
' > "$config_file"
sudo install -m 0644 "$config_file" /etc/cheesegrater-fan-control/config.json
sudo systemctl daemon-reload
sudo systemctl enable --now cheesegrater-fan-control.service
sudo systemctl --no-pager --full status cheesegrater-fan-control.service
