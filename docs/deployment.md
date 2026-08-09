# Cheesegrater deployment

The web interface runs as a systemd service on the Cheesegrater and listens on
port `8080` across the local network.

## Runtime

- Node.js 24 LTS
- application checkout: `/home/cogiart/CheesegraterAILab`
- service: `cheesegrater-ai-lab.service`
- local URL: `http://192.168.111.100:8080/`

## Update

Run the deployment script on the Cheesegrater after changes are merged into
the checked-out branch:

```bash
cd /home/cogiart/CheesegraterAILab
./scripts/deploy-cheesegrater.sh
```

The script performs a fast-forward pull, installs locked dependencies, creates
a production build, restarts the service, and checks the local endpoint.
