# Architecture

## Current foundation

The Cheesegrater Mac Pro is the compute host. ROCm exposes the MI50 as a
`gfx906` device, while model files live on the RAID0 volume rather than the
system disk.

The lab application will orchestrate the existing command-line inference
engines instead of duplicating them:

- `llama` for language models
- `diffusion` for image models

## Design constraints

- Large artifacts stay under `/mnt/raid0/models` and outside Git.
- Secrets are supplied through environment variables or an ignored `.env`.
- Destructive model operations require explicit confirmation.
- The interface must report whether work is running on ROCm or falling back to
  the CPU.
- Long downloads should be resumable and expose progress.

## Next decision

Define the first lab experience: web interface, terminal application, desktop
interface, API, or a combination of these.
