# Lovelacer Add-on

Home Assistant Add-on packaging for Lovelacer.

**Status:** Placeholder — implementation lands in P1a-11.

When complete, this directory will contain:

- `Dockerfile` — multi-arch build based on `ghcr.io/home-assistant/<arch>-base:latest`
- `config.yaml` — Add-on metadata, options schema, ingress config
- `run.sh` — Add-on entrypoint, reads `/data/options.json` and starts the server
- `apparmor.txt` — security profile
- `icon.png`, `logo.png` — branding assets

CI builds and publishes images per release tag to GHCR.

For local development, see `dev/README.md` instead.
