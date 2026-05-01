import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
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
  await app.register(applyRoute, { ha: opts.ha })

  return app
}
