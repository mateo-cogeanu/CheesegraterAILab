# Cheesegrater AI Lab

Cheesegrater AI Lab is the home for a self-hosted AI workspace powered by the
AMD Radeon Instinct MI50 in the Cheesegrater Mac Pro.

The machine already provides the foundation for the lab:

- AMD ROCm 6.3.3 with `gfx906` GPU support
- `llama.cpp` for local language-model inference
- `stable-diffusion.cpp` for local image generation
- a RAID0 model volume mounted at `/mnt/raid0`
- shared model storage at `/mnt/raid0/models`

## Project status

The first responsive web interface is built and deployable on the Cheesegrater.
It provides understandable workspaces for system status, models, private chat,
and image generation. Model execution and download actions will be connected
to the backend in the next phase.

## Planned capabilities

- browse and download models from Hugging Face
- list locally installed models
- chat with compatible language models
- generate images with diffusion models
- keep large model weights and generated output outside Git
- use the MI50 through the existing ROCm installation

## Repository layout

```text
config/   Version-controlled configuration examples
docs/     Architecture notes and decisions
scripts/  Installation, maintenance, and launch scripts
web/      Responsive Cheesegrater AI Lab web interface
```

## Web interface

The deployed lab is available on the local network at:

```text
http://192.168.111.100:8080/
```

## Security

Passwords, Hugging Face tokens, private keys, model weights, and generated
media must not be committed. Copy `.env.example` to `.env` for local settings;
`.env` is ignored by Git.
