# Cheesegrater AI Lab web interface

The responsive lab interface is built with React, vinext, and Vite. It provides
four focused workspaces:

- overview and machine status
- Hugging Face model library
- private local-model chat
- diffusion image studio

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

The production service is managed by the repository-level deployment script
and systemd unit.
