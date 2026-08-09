# Deployment

The web interface runs as a systemd service and listens on a configurable port.
The tracked service uses a dynamic system identity; no login username is
compiled into the deployment.

## Defaults

- application checkout: `/opt/cheesegrater-ai-lab`
- service: `cheesegrater-ai-lab.service`
- port: `8080`

Each default can be overridden with the environment variables documented in
`.env.example`. The reachable URL depends on the deployment host and network.

## Update

Run `scripts/deploy-cheesegrater.sh` from any checkout. It updates or creates
the installation checkout, installs locked dependencies, builds the app,
restarts the persistent service, and checks its loopback endpoint.
