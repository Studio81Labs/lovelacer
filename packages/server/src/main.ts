import { resolve } from 'node:path'
import { rename } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { HaClient } from '@lovelacer/ha-client'
import { pino, type Logger } from 'pino'
import { config } from './config.js'
import { createApp } from './app.js'
import { AppliedSnapshotStore } from './storage/applied-snapshot-store.js'
import { DismissedSuggestionStore } from './storage/dismissed-suggestion-store.js'
import { InviteStore } from './storage/invite-store.js'
import { LatestAnalysisStore } from './storage/latest-analysis-store.js'
import { OverrideStore } from './storage/override-store.js'
import { SettingsStore } from './storage/settings-store.js'
import { OnboardingStore } from './storage/onboarding-store.js'
import { openSqliteDatabase, type SqliteDatabase } from './storage/sqlite.js'

function logProcessError(logger: Logger, message: string, err: unknown): void {
  logger.fatal({ err: err instanceof Error ? err : String(err) }, message)
}

/**
 * Open SQLite-backed storage with retry on SQLITE_BUSY. All six stores share
 * a single `lovelacer.sqlite` connection; on first start after a crashed
 * previous container, stale `.db-wal`/`.db-shm` lock state can make any of
 * the lock-acquiring init operations (WAL pragma, CREATE TABLE, etc.)
 * transiently busy. Retry with exponential backoff so we ride out short-lived
 * contention before failing startup.
 *
 * If `recoveryFiles` is provided and all retries fail with SQLITE_BUSY, the
 * named auxiliary files (typically `.db-wal` and `.db-shm`) are renamed to
 * `.busy-<timestamp>` siblings — not deleted — and the factory is called
 * once more.
 *
 * Trade-off: this assumes the HA add-on deployment model where /data/ is
 * exclusive to this single Node process. WAL files can hold committed-but-
 * unmerged transactions, so renaming them causes the DB to come up as if
 * those transactions never happened. For our model that's a fair call after
 * a wedged-startup failure; in any setup with concurrent writers to the
 * same file this would cause data loss / inconsistency. Files are renamed
 * rather than deleted so the committed-but-unmerged state is preserved on
 * disk for manual recovery if a user ever does end up in that situation.
 *
 * Recovery is passed only on the first store opened so it runs once per
 * process.
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
      const stamp = Date.now()
      logger.warn(
        { store: name, files: recoveryFiles, stamp },
        'sqlite still busy after retries; renaming auxiliary files to .busy-<stamp> ' +
          '(any committed-but-unmerged WAL state will not be visible to the new DB ' +
          'connection but is preserved on disk) and retrying once more',
      )
      for (const file of recoveryFiles) {
        try {
          await rename(file, `${file}.busy-${stamp}`)
        } catch (e) {
          if ((e as { code?: string })?.code !== 'ENOENT') {
            logger.warn({ err: e, file }, 'could not rename sqlite auxiliary file')
          }
        }
      }
      return factory()
    }
  }
  throw new Error('unreachable')
}

interface StorageHandles {
  sqlite: SqliteDatabase
  overrides: OverrideStore
  invite: InviteStore
  appliedSnapshot: AppliedSnapshotStore
  latestAnalysis: LatestAnalysisStore
  dismissedSuggestions: DismissedSuggestionStore
  settings: SettingsStore
  onboarding: OnboardingStore
}

function openStorage(filename: string): StorageHandles {
  const sqlite = openSqliteDatabase(filename)
  try {
    return {
      sqlite,
      overrides: new OverrideStore(sqlite),
      invite: new InviteStore(sqlite),
      appliedSnapshot: new AppliedSnapshotStore(sqlite),
      latestAnalysis: new LatestAnalysisStore(sqlite),
      dismissedSuggestions: new DismissedSuggestionStore(sqlite),
      settings: new SettingsStore(sqlite),
      onboarding: new OnboardingStore(sqlite),
    }
  } catch (err) {
    sqlite.close()
    throw err
  }
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

  process.on('uncaughtException', (err) => {
    logProcessError(logger, 'uncaught exception; exiting', err)
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    logProcessError(logger, 'unhandled promise rejection; exiting', reason)
    process.exit(1)
  })
  process.on('warning', (warning) => {
    logger.warn({ err: warning }, 'node process warning')
  })

  logger.info(
    {
      addonVersion: config.addonVersion,
      nodeVersion: process.version,
      dataDir: config.dataDir,
      webDistDir: config.webDistDir ?? null,
      haUrl: config.ha.url,
      haWebsocketUrl: config.ha.websocketUrl ?? null,
      debugBackendEnabled: config.debugBackend !== null,
      debugBackendPort: config.debugBackend?.port ?? null,
    },
    'lovelacer server starting',
  )

  const ha = new HaClient({
    url: config.ha.url,
    token: config.ha.token,
    logger,
    ...(config.ha.websocketUrl !== undefined && { websocketUrl: config.ha.websocketUrl }),
  })

  const sqlitePath = resolve(config.dataDir, 'lovelacer.sqlite')
  // Pass recovery files to the storage open so any wedged WAL state from a
  // crashed previous container is cleaned up before schema initialization.
  // Only the WAL sidecars are recoverable: the `.db-journal` rollback journal
  // (used in non-WAL mode) holds undo data for an in-progress transaction, and
  // removing it would leave the main DB with half-applied pages — strictly
  // worse than hitting SQLITE_BUSY at startup.
  const storage = await openStoreWithRetry(() => openStorage(sqlitePath), 'storage', logger, [
    `${sqlitePath}-wal`,
    `${sqlitePath}-shm`,
  ])
  const {
    sqlite,
    overrides,
    invite,
    appliedSnapshot,
    latestAnalysis,
    dismissedSuggestions,
    settings,
    onboarding,
  } = storage
  logger.info({ path: sqlitePath }, 'sqlite storage opened')

  const app = await createApp({
    ha,
    overrides,
    invite,
    appliedSnapshot,
    latestAnalysis,
    dismissedSuggestions,
    settings,
    onboarding,
    isDev,
    logLevel: config.logLevel,
    logger,
    appVersion: config.addonVersion,
    dashboardUrlPath: config.dashboardUrlPath,
    ...(config.webDistDir !== undefined && { webDistDir: config.webDistDir }),
  })
  const debugApp =
    config.debugBackend === null
      ? null
      : await createApp({
          ha,
          overrides,
          invite,
          appliedSnapshot,
          latestAnalysis,
          dismissedSuggestions,
          settings,
          onboarding,
          isDev,
          logLevel: config.logLevel,
          logger,
          appVersion: config.addonVersion,
          dashboardUrlPath: config.dashboardUrlPath,
          directAccessToken: config.debugBackend.token,
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
      if (debugApp !== null) await debugApp.close()
    } finally {
      overrides.close()
      invite.close()
      appliedSnapshot.close()
      latestAnalysis.close()
      dismissedSuggestions.close()
      settings.close()
      onboarding.close()
      sqlite.close()
    }
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  await app.listen({ port: config.port, host: '0.0.0.0' })
  if (debugApp !== null && config.debugBackend !== null) {
    await debugApp.listen({ port: config.debugBackend.port, host: '0.0.0.0' })
  }
}

main().catch((err) => {
  console.error('fatal startup error:', err)
  process.exit(1)
})
