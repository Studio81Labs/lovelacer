import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export const MAX_BACKUPS = 5

const REGISTRY_KEYS = [
  'core.floor_registry',
  'core.area_registry',
  'core.device_registry',
  'core.entity_registry',
] as const

const BACKUP_PREFIX = '.lovelacer-backup-'

/**
 * Move any existing registry files to a fresh `.lovelacer-backup-<ts>/`
 * directory under .storage/. Prunes older backups beyond MAX_BACKUPS.
 *
 * Returns the path to the new backup directory, or null if there was
 * nothing to back up.
 */
export function backupRegistries(haConfigDir: string): string | null {
  const storageDir = join(haConfigDir, '.storage')
  const present = REGISTRY_KEYS.filter((k) => existsSync(join(storageDir, k)))
  if (present.length === 0) return null

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(storageDir, `${BACKUP_PREFIX}${stamp}`)
  mkdirSync(backupDir, { recursive: true })

  for (const k of present) renameSync(join(storageDir, k), join(backupDir, k))

  pruneOldBackups(storageDir)
  return backupDir
}

function pruneOldBackups(storageDir: string): void {
  const entries = readdirSync(storageDir)
    .filter((n) => n.startsWith(BACKUP_PREFIX))
    .sort()
  const excess = entries.length - MAX_BACKUPS
  for (let i = 0; i < excess; i++) {
    rmSync(join(storageDir, entries[i]!), { recursive: true, force: true })
  }
}
