# Accelerator fan control

This service reads all accelerator temperatures exposed through Linux DRM hwmon,
uses the hottest sensor, and sends `FAN <percent>` commands to a responding USB
microcontroller. It uses only the Python standard library.

The deployment script probes stable Pico paths first, requires a `PONG` response,
and writes the selected serial path and default curve to the machine-local file
`/etc/cheesegrater-fan-control/config.json`.

The default curve keeps the fan at or above 40%, reaches 65% at 60 C, 85% at
70 C, and 100% at 80 C. Missing temperature data, shutdown, and a newly opened
serial connection all command the configured 100% fail-safe speed.

Deploy from the administrative checkout:

```sh
./scripts/deploy-fan-control.sh
```

Inspect it with:

```sh
systemctl status cheesegrater-fan-control.service
journalctl -u cheesegrater-fan-control.service -f
```
