import { resolve } from 'node:path'
import { HaClient } from '@lovelacer/ha-client'
import { pino } from 'pino'
import { config } from './config.js'
import { createApp } from './app.js'
import { InviteStore } from './storage/invite-store.js'
import { OverrideStore } from './storage/override-store.js'

async function main() {
  // Require an explicit `NODE_ENV=development` to enable pino-pretty, since
  // pino-pretty is a devDependency and would crash a production install
  // (e.g., HA add-on container) where it isn't bundled.
  const isDev = process.env.NODE_ENV === 'development'

  // Build the logger once and share it between HaClient and Fastify so
  // both honor `config.logLevel` and the dev-mode pino-pretty transport.
  const logger = pino({
    level: config.logLevel,
    ...(isDev && {
      transport: { target: 'pino-pretty', options: { colorize: true } },
    }),
  })

  const ha = new HaClient({
    url: config.ha.url,
    token: config.ha.token,
    logger,
  })

  const overridesPath = resolve(config.dataDir, 'lovelacer.sqlite')
  const overrides = new OverrideStore(overridesPath)
  logger.info({ path: overridesPath }, 'override store opened')

  const invitePath = resolve(config.dataDir, 'lovelacer.sqlite')
  const invite = new InviteStore(invitePath)
  logger.info({ path: invitePath }, 'invite store opened')

  const app = await createApp({
    ha,
    overrides,
    invite,
    isDev,
    logLevel: config.logLevel,
    logger,
    dashboardUrlPath: config.dashboardUrlPath,
    ...(config.webDistDir !== undefined && { webDistDir: config.webDistDir }),
  })

  // Connect to HA in background — health endpoint returns status either way.
  ha.connect().catch((err) => {
    app.log.error({ err }, 'failed to connect to Home Assistant on startup')
  })

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down')
    try {
      await ha.disconnect()
      await app.close()
    } finally {
      overrides.close()
      invite.close()
    }
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
