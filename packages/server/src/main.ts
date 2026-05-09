import { resolve } from 'node:path'
import { unlink } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { HaClient } from '@lovelacer/ha-client'
import { pino, type Logger } from 'pino'
import { config } from './config.js'
import { createApp } from './app.js'
import { AppliedSnapshotStore } from './storage/applied-snapshot-store.js'
import { DismissedSuggestionStore } from './storage/dismissed-suggestion-store.js'
import { InviteStore } from './storage/invite-store.js'
import { OverrideStore } from './storage/override-store.js'
import { SettingsStore } from './storage/settings-store.js'
import { OnboardingStore } from './storage/onboarding-store.js'

/**
 * Open a SQLite-backed store with retry on SQLITE_BUSY. All six stores share
 * a single `lovelacer.sqlite` file; on first start after a crashed previous
 * container, stale `.db-wal`/`.db-shm` lock state can make any of the
 * lock-acquiring init operations (WAL pragma, CREATE TABLE, etc.) transiently
 * busy. Retry with exponential backoff so we ride out short-lived contention
 * before failing startup.
 *
 * If `recoveryFiles` is provided and all retries fail with SQLITE_BUSY, the
 * named auxiliary files (typically `.db-wal` and `.db-shm`) are deleted as a
 * last-resort recovery for permanently-stuck WAL state from a crashed
 * previous container, then the factory is called once more. This sacrifices
 * any uncommitted WAL data — only meaningful when the DB is already wedged
 * and unrecoverable, so a fair trade. Pass it only on the first store
 * opened so cleanup runs once per process.
 */
async function openStoreWithRetry<T>(
  factory: () => T,
  name: string,
  logger: Logger,
  recoveryFiles?: string[],
): Promise<T> {
  const delaysMs = [500, 1000, 2000, 4000]
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return factory()
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code !== 'SQLITE_BUSY') throw err
      if (attempt < delaysMs.length) {
        logger.warn(
          { store: name, attempt: attempt + 1, code },
          'sqlite busy during store init; backing off and retrying',
        )
        await sleep(delaysMs[attempt])
        continue
      }
      // All normal retries exhausted.
      if (!recoveryFiles?.length) throw err
      logger.warn(
        { store: name, files: recoveryFiles },
        'sqlite still busy after retries; removing auxiliary files (any uncommitted WAL data will be lost) and retrying once more',
      )
      for (const file of recoveryFiles) {
        try {
          await unlink(file)
        } catch (e) {
          if ((e as { code?: string })?.code !== 'ENOENT') {
            logger.warn({ err: e, file }, 'could not remove sqlite auxiliary file')
          }
        }
      }
      return factory()
    }
  }
  throw new Error('unreachable')
}

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
  // Pass recovery files to the FIRST store opened so any wedged WAL state
  // from a crashed previous container is cleaned up before subsequent stores
  // (which share the same .sqlite file) try to open.
  const overrides = await openStoreWithRetry(
    () => new OverrideStore(overridesPath),
    'overrides',
    logger,
    [`${overridesPath}-wal`, `${overridesPath}-shm`, `${overridesPath}-journal`],
  )
  logger.info({ path: overridesPath }, 'override store opened')

  const invitePath = resolve(config.dataDir, 'lovelacer.sqlite')
  const invite = await openStoreWithRetry(() => new InviteStore(invitePath), 'invite', logger)
  logger.info({ path: invitePath }, 'invite store opened')

  const appliedSnapshotPath = resolve(config.dataDir, 'lovelacer.sqlite')
  const appliedSnapshot = await openStoreWithRetry(
    () => new AppliedSnapshotStore(appliedSnapshotPath),
    'applied-snapshot',
    logger,
  )
  logger.info({ path: appliedSnapshotPath }, 'applied-snapshot store opened')

  const dismissedSuggestionsPath = resolve(config.dataDir, 'lovelacer.sqlite')
  const dismissedSuggestions = await openStoreWithRetry(
    () => new DismissedSuggestionStore(dismissedSuggestionsPath),
    'dismissed-suggestion',
    logger,
  )
  logger.info({ path: dismissedSuggestionsPath }, 'dismissed-suggestion store opened')

  const settingsPath = resolve(config.dataDir, 'lovelacer.sqlite')
  const settings = await openStoreWithRetry(
    () => new SettingsStore(settingsPath),
    'settings',
    logger,
  )
  logger.info({ path: settingsPath }, 'settings store opened')

  const onboardingPath = resolve(config.dataDir, 'lovelacer.sqlite')
  const onboarding = await openStoreWithRetry(
    () => new OnboardingStore(onboardingPath),
    'onboarding',
    logger,
  )
  logger.info({ path: onboardingPath }, 'onboarding store opened')

  const app = await createApp({
    ha,
    overrides,
    invite,
    appliedSnapshot,
    dismissedSuggestions,
    settings,
    onboarding,
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
      appliedSnapshot.close()
      dismissedSuggestions.close()
      settings.close()
      onboarding.close()
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
