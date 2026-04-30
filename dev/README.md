# Local Development Environment

## Home Assistant dev container

A self-contained HA Core instance for running Lovelacer against during development. State persists in `dev/ha-config/` (gitignored).

### First-time setup

```bash
pnpm dev:ha
```

Wait ~60 seconds for HA to initialize, then:

1. Open [http://localhost:8123](http://localhost:8123)
2. Create an admin account (any credentials, this is your local dev instance only)
3. Set location anywhere (Europe/Prague is the default timezone)
4. Skip area auto-detection — Lovelacer fixtures will provision them
5. Generate a long-lived access token: profile → security → "Long-lived access tokens"
6. Save the token to `.env` at the repo root:
   ```
   HA_URL=http://localhost:8123
   HA_TOKEN=<paste-token-here>
   ```

### Loading fixture data

After first-time setup, load a fixture entity registry to get realistic test data:

```bash
pnpm fixtures:load english-cluttered
```

(This script is added in P0-2.)

Available fixtures:

- `english-cluttered` — 200 entities, mixed quality, English (default for dev)
- `czech-tidy` — 80 entities, well-set-up Czech home
- `german-massive` — 600 entities, multi-floor German home
- `unset-areas` — 100 entities, no areas at all (heuristic stress test)
- `multilingual-mixed` — English HA UI, Czech entity names

### Resetting the dev HA

```bash
pnpm dev:ha:down
rm -rf dev/ha-config
pnpm dev:ha
```

Then redo the first-time setup.

### Useful tasks

```bash
pnpm dev:ha:logs           # follow HA container logs
docker exec -it lovelacer-dev-ha bash   # shell into container
```

## Working alongside the dev HA

Once HA is up and you have a token:

```bash
pnpm dev                   # starts backend (3000) and frontend (5173)
```

The frontend proxies `/api` calls to the backend. The backend connects to HA at `HA_URL` using `HA_TOKEN`.

## Ollama for AI development (Phase 4+)

Uncomment the `ollama` service in `ha-stack.yml`, then:

```bash
docker exec -it lovelacer-dev-ollama ollama pull llama3.1:8b
```

Set `LLM_PROVIDER=ollama` and `LLM_BASE_URL=http://localhost:11434` in `.env`.
