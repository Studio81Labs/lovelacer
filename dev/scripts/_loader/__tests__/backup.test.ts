import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupRegistries, MAX_BACKUPS } from '../backup.js'

const REGISTRY_KEYS = [
  'core.floor_registry',
  'core.area_registry',
  'core.device_registry',
  'core.entity_registry',
] as const

function setupStorageDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'lovelacer-backup-'))
  mkdirSync(join(root, '.storage'), { recursive: true })
  for (const k of REGISTRY_KEYS) writeFileSync(join(root, '.storage', k), `{"key":"${k}"}`)
  return root
}

describe('backupRegistries', () => {
  let configRoot: string
  beforeEach(() => {
    configRoot = setupStorageDir()
  })

  it('moves existing registries into a timestamped backup directory', () => {
    const dir = backupRegistries(configRoot)
    expect(dir).not.toBeNull()
    expect(existsSync(dir!)).toBe(true)
    for (const k of REGISTRY_KEYS) {
      expect(existsSync(join(dir!, k))).toBe(true)
      expect(existsSync(join(configRoot, '.storage', k))).toBe(false)
    }
  })

  it('returns null when no registries are present', () => {
    const fresh = mkdtempSync(join(tmpdir(), 'lovelacer-backup-empty-'))
    mkdirSync(join(fresh, '.storage'), { recursive: true })
    expect(backupRegistries(fresh)).toBeNull()
  })

  it('prunes old backups beyond MAX_BACKUPS', () => {
    for (let i = 0; i < MAX_BACKUPS + 3; i++) {
      const stamp = `2020-01-01T00-00-${String(i).padStart(2, '0')}-000Z`
      const dir = join(configRoot, '.storage', `.lovelacer-backup-${stamp}`)
      mkdirSync(dir, { recursive: true })
    }
    // also seed a current registry so a new backup gets created
    for (const k of REGISTRY_KEYS) writeFileSync(join(configRoot, '.storage', k), `{}`)
    backupRegistries(configRoot)
    const remaining = readdirSync(join(configRoot, '.storage')).filter((n) =>
      n.startsWith('.lovelacer-backup-'),
    )
    expect(remaining).toHaveLength(MAX_BACKUPS)
  })
})
