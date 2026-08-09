# Architecture

## Runtime discovery

Cheesegrater AI Lab treats the deployment host as unknown. A connected lab API
reports machine identity, available accelerators, inference backends, storage,
models, and job activity at runtime.

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
- Browser settings remain browser-local until a backend configuration system
  is designed.

## Discovery contract

The interface expects `GET /api/system` from the configured endpoint. The
future response may contain machine, accelerator, backend, storage, and model
summary objects. Every field is optional and must be rendered as unknown when
absent.
