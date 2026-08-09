# Cheesegrater AI Lab

Cheesegrater AI Lab is a configurable web interface for self-hosted AI. It is
not tied to a username, operating system, accelerator vendor, inference
backend, storage layout, or model.

System details are supplied at runtime by the bundled lab service. Deployment
generates a machine-local configuration from the host it actually finds, while
storage capacity and model counts are measured live. When discovery is
unavailable, the interface reports information as unavailable instead of
inventing defaults.

## Planned capabilities

- discover available compute resources and backends
- browse and download models from configured providers
- list locally available models
- chat with compatible language models
- generate images with compatible image models
- keep large artifacts and generated output outside Git

## Repository layout

```text
config/   Version-controlled configuration examples
deploy/   Generic service definitions
docs/     Architecture and deployment notes
scripts/  Installation, maintenance, and launch scripts
server/   Same-origin configuration and discovery service
web/      Responsive Cheesegrater AI Lab web interface
```

## Web interface

The interface contains overview, model library, chat, image studio, and
browser-local settings views. Same-origin discovery works automatically; the
Settings endpoint is only needed when connecting the interface to another lab.

## Security

Passwords, provider tokens, private keys, model weights, and generated media
must not be committed. Copy `.env.example` to `.env` for local settings;
`.env` is ignored by Git.
