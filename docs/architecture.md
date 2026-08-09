# Architecture

## Runtime discovery

Cheesegrater AI Lab treats the deployment host as unknown. The deployment
generates `/etc/cheesegrater-ai-lab/config.json` from the machine it finds. A
same-origin lab service reads that configuration and reports machine identity,
available accelerators, inference backends, storage, and models at runtime.

The browser must never infer hardware or storage from the page location. When
discovery is unavailable, the interface presents an explicit unconfigured
state.

## Design constraints

- No username, hostname, IP address, accelerator, backend, model, capacity, or
  filesystem path is compiled into the product interface.
- Large artifacts stay outside Git in administrator-configured storage.
- Secrets are supplied through environment variables or an ignored `.env`.
- Destructive model operations require explicit confirmation.
- Long downloads must be resumable and expose progress.
- The machine-local configuration is outside Git and can be regenerated after
  hardware, runtime, or storage changes.
- The browser endpoint override remains browser-local.

## Discovery contract

The interface expects `GET /api/system` from the same origin unless a browser
override is set. The response contains optional machine, accelerator, backend,
storage, model, and service summary objects. Every missing field is rendered as
unknown.

`scripts/generate-config.mjs` discovers the host name, accelerator/backend,
model volume, and installed inference services. Free capacity and model counts
are intentionally absent from the file and calculated for every API request.
