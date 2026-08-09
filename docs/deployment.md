# Deployment

The web interface and its same-origin configuration API run as one systemd
service on a configurable port. The tracked service uses a dynamic system
identity; no login username is compiled into the deployment.

## Defaults

- application checkout: `/opt/cheesegrater-ai-lab`
- service: `cheesegrater-ai-lab.service`
- port: `8080`
- machine configuration: `/etc/cheesegrater-ai-lab/config.json`

Each default can be overridden with the environment variables documented in
`.env.example`. The reachable URL depends on the deployment host and network.

## Update

Run `scripts/deploy-cheesegrater.sh` from any checkout. It updates or creates
the installation checkout, installs locked dependencies, builds the app,
detects the machine configuration, restarts the persistent service, and checks
both its health and system discovery endpoints.

Set `LAB_MODEL_ROOT` only when automatic model-volume discovery cannot find the
desired `models` directory. Normally no manual configuration is required.
