import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import fastifyStatic from '@fastify/static'
import { pino, type Logger } from 'pino'
import type { HaClient } from '@lovelacer/ha-client'
import { analyzeRoute } from './routes/analyze.js'
import { applyRoute } from './routes/apply.js'
import { exportRoute } from './routes/export.js'
import { inviteRoute } from './routes/invite.js'
import { onboardingRoute } from './routes/onboarding.js'
import { overridesRoute } from './routes/overrides.js'
import { previewRoute } from './routes/preview.js'
import { settingsRoute } from './routes/settings.js'
import { suggestionsRoute } from './routes/suggestions.js'
import type { AppliedSnapshotStore } from './storage/applied-snapshot-store.js'
import type { DismissedSuggestionStore } from './storage/dismissed-suggestion-store.js'
import type { InviteStore } from './storage/invite-store.js'
import type { OnboardingStore } from './storage/onboarding-store.js'
import type { OverrideStore } from './storage/override-store.js'
import type { SettingsStore } from './storage/settings-store.js'

export interface CreateAppOptions {
  ha: HaClient
  overrides: OverrideStore
  invite: InviteStore
  appliedSnapshot: AppliedSnapshotStore
  dismissedSuggestions: DismissedSuggestionStore
  settings: SettingsStore
  onboarding: OnboardingStore
  isDev?: boolean
  logLevel?: string
  /**
   * Pre-built pino logger. If provided, Fastify uses it directly so the
   * caller can share a single logger instance with `HaClient` and other
   * collaborators. Otherwise `createApp` builds one from `logLevel`/`isDev`.
   */
  logger?: Logger
  /** Default url_path for the generated dashboard. Forwarded to the apply route. */
  dashboardUrlPath: string
  /** Add-on/config version surfaced by /api/health for runtime diagnostics. */
  appVersion?: string
  /**
   * Absolute path to the built SPA's static asset directory (the
   * `packages/web/dist/` produced by `pnpm --filter @lovelacer/web build`).
   * When set, Fastify serves the SPA at `/` with SPA-style fallback so
   * deep links into the client-side router resolve to `index.html`. Leave
   * undefined in dev (Vite serves the SPA on :5173 with a proxy to :3000).
   */
  webDistDir?: string
}

export async function createApp(opts: CreateAppOptions) {
  // Always pass Fastify a pre-built pino instance via `loggerInstance` so
  // the `opts.logger` injection path stays type-clean (Fastify's `logger`
  // option's union types fight us when the value is a generic pino logger).
  const loggerInstance =
    opts.logger ??
    pino({
      level: opts.logLevel ?? 'info',
      ...(opts.isDev === true && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    })

  const app = Fastify({ loggerInstance })

  await app.register(cors, { origin: true })
  await app.register(sensible)

  // Health check — must be O(1). Polled by HA add-on supervisor and ingress
  // healthchecks.
  app.get('/api/health', async () => ({
    ok: true,
    version: opts.appVersion ?? 'dev',
    ha: { connected: opts.ha.isConnected() },
  }))

  // Gate hook: returns 403 invite_required for any /api/* request unless
  // the invite has been accepted. /api/health and /api/invite are always
  // public (Supervisor health-checks the former; the user submits the
  // code to the latter on first run).
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return
    // Strip query string + fragment, then exact-match. Using startsWith
    // would silently bypass /api/healthcheck or /api/invitations if those
    // routes ever existed — exact match makes the bypass list explicit.
    const path = req.url.split('?', 1)[0]?.split('#', 1)[0] ?? req.url
    if (path === '/api/health' || path === '/api/invite') return
    if (!opts.invite.isAccepted()) {
      return reply.code(403).send({
        error: 'invite_required',
        message: 'Invite code required to continue.',
      })
    }
  })

  await app.register(inviteRoute, { invite: opts.invite })
  await app.register(analyzeRoute, {
    ha: opts.ha,
    overrides: opts.overrides,
    settings: opts.settings,
  })
  await app.register(previewRoute, {
    ha: opts.ha,
    overrides: opts.overrides,
    appliedSnapshot: opts.appliedSnapshot,
    dismissedSuggestions: opts.dismissedSuggestions,
    settings: opts.settings,
  })
  await app.register(applyRoute, {
    ha: opts.ha,
    overrides: opts.overrides,
    appliedSnapshot: opts.appliedSnapshot,
    dismissedSuggestions: opts.dismissedSuggestions,
    settings: opts.settings,
    dashboardUrlPath: opts.dashboardUrlPath,
  })
  await app.register(exportRoute, {
    ha: opts.ha,
    overrides: opts.overrides,
    appliedSnapshot: opts.appliedSnapshot,
    dismissedSuggestions: opts.dismissedSuggestions,
    settings: opts.settings,
    dashboardUrlPath: opts.dashboardUrlPath,
  })
  await app.register(overridesRoute, { overrides: opts.overrides })
  await app.register(settingsRoute, { settings: opts.settings })
  await app.register(onboardingRoute, { onboarding: opts.onboarding })
  await app.register(suggestionsRoute, { dismissed: opts.dismissedSuggestions })

  // SPA static serving — only enabled in add-on / production. In dev Vite
  // owns serving the SPA. With `wildcard: true` (default), @fastify/static
  // registers a wildcard route that resolves any file under `webDistDir`
  // (so `/assets/index-xxxx.js` returns the actual JS, `/` serves
  // `index.html` via the `index` option, etc.). True 404s — paths that
  // don't match a file AND aren't covered by an /api/* route — fall
  // through to `setNotFoundHandler`, which serves `index.html` so the
  // Vue Router can resolve client-side deep links.
  if (opts.webDistDir !== undefined) {
    await app.register(fastifyStatic, {
      root: opts.webDistDir,
      prefix: '/',
    })
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'not_found', message: 'route not found' })
      }
      return reply.sendFile('index.html')
    })
  }

  return app
}
