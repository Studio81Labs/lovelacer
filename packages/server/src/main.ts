import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import { HaClient } from '@lovelacer/ha-client'
import { config } from './config.js'

async function main() {
  // Require an explicit `NODE_ENV=development` to enable pino-pretty, since
  // pino-pretty is a devDependency and would crash a production install
  // (e.g., HA add-on container) where it isn't bundled. The dev script sets
  // NODE_ENV=development; production deployments leave it unset or 'production'.
  const isDev = process.env.NODE_ENV === 'development'

  const app = Fastify({
    logger: {
      level: config.logLevel,
      ...(isDev && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    },
  })

  await app.register(cors, { origin: true })
  await app.register(sensible)

  const ha = new HaClient({
    url: config.ha.url,
    token: config.ha.token,
    logger: app.log as never,
  })

  // Connect to HA in background — health endpoint returns status either way
  ha.connect().catch((err) => {
    app.log.error({ err }, 'failed to connect to Home Assistant on startup')
  })

  // Health check — must be O(1). Polled by HA add-on supervisor, ingress
  // healthchecks, etc. Entity counts and other diagnostics belong on a
  // separate /api/status endpoint (P1a-9).
  app.get('/api/health', async () => ({
    ok: true,
    version: '0.0.0',
    ha: { connected: ha.isConnected() },
  }))

  // Placeholder routes — implemented in P1a-9
  app.post('/api/analyze', async (_req, reply) => reply.notImplemented())
  app.get('/api/preview', async (_req, reply) => reply.notImplemented())
  app.post('/api/apply', async (_req, reply) => reply.notImplemented())

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down')
    await ha.disconnect()
    await app.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  await app.listen({ port: config.port, host: '0.0.0.0' })
}

main().catch((err) => {
  console.error('fatal startup error:', err)
  process.exit(1)
})
