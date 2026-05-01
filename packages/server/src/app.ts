import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import type { HaClient } from '@lovelacer/ha-client'
import { analyzeRoute } from './routes/analyze.js'

export interface CreateAppOptions {
  ha: HaClient
  isDev?: boolean
  logLevel?: string
}

export async function createApp(opts: CreateAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: opts.logLevel ?? 'info',
      ...(opts.isDev === true && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    },
  })

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

  return app
}
