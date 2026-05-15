# Run with standalone Docker

Use standalone Docker when you run Home Assistant Core, Home Assistant Container, or a development Home Assistant instance outside Supervisor.

## Prerequisites

- Docker or Docker Compose.
- A reachable Home Assistant URL.
- A Home Assistant long-lived access token.

Create a token from **Home Assistant > Profile > Long-lived access tokens**. Treat it like a password.

## Run the container

```bash
docker run --rm \
  --name lovelacer \
  -p 3000:3000 \
  -e HA_URL=http://homeassistant.local:8123 \
  -e HA_TOKEN=replace-with-your-long-lived-token \
  -e NODE_ENV=production \
  ghcr.io/studio81labs/lovelacer-amd64:latest
```

Then open:

```text
http://localhost:3000
```

Use the image that matches your host architecture when you are not on `amd64`.

## Docker Compose

```yaml
services:
  lovelacer:
    image: ghcr.io/studio81labs/lovelacer-amd64:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      HA_URL: http://homeassistant.local:8123
      HA_TOKEN: ${HA_TOKEN}
      NODE_ENV: production
```

Start it with:

```bash
HA_TOKEN=replace-with-your-long-lived-token docker compose up -d
```

## Local development runtime

For repository development, use the workspace scripts:

```bash
pnpm install
pnpm dev:ha
pnpm fixtures:load
pnpm dev
```

This starts a local Home Assistant fixture stack plus the Fastify server and Vue UI in watch mode.

## Security notes

- Do not commit `HA_TOKEN` or place it in public Compose files.
- Restrict network access to the Lovelacer server if you expose it outside localhost.
- The standalone path talks directly to Home Assistant with the provided token. The add-on path uses `SUPERVISOR_TOKEN` instead.
