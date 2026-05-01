import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import fastifyStatic from '@fastify/static'
import { pino, type Logger } from 'pino'
import type { HaClient } from '@lovelacer/ha-client'
import { analyzeRoute } from './routes/analyze.js'
import { applyRoute } from './routes/apply.js'
import { previewRoute } from './routes/preview.js'

export interface CreateAppOptions {
  ha: HaClient
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
    version: '0.0.0',
    ha: { connected: opts.ha.isConnected() },
  }))

  await app.register(analyzeRoute, { ha: opts.ha })
  await app.register(previewRoute, { ha: opts.ha })
  await app.register(applyRoute, { ha: opts.ha, dashboardUrlPath: opts.dashboardUrlPath })

  // SPA static serving — only enabled in add-on / production. In dev Vite
  // owns serving the SPA. The `wildcard: false` + `setNotFoundHandler`
  // combo gives us the standard SPA fallback: API 404s pass through, but
  // any non-API path falls back to index.html so the client-side router
  // can resolve deep links.
  if (opts.webDistDir !== undefined) {
    await app.register(fastifyStatic, {
      root: opts.webDistDir,
      prefix: '/',
      wildcard: false,
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
