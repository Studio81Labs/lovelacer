import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import type { AppliedSnapshot } from '@lovelacer/shared'
import { AppliedSnapshotStore } from '../applied-snapshot-store.js'

const sample: Omit<AppliedSnapshot, 'appliedAt'> = {
  assignments: [
    { entityId: 'light.kitchen_ceiling', roomId: 'kitchen' },
    { entityId: 'sensor.outdoor_temp', roomId: null },
  ],
  config: { title: 'Lovelacer — Home', views: [] },
}

describe('AppliedSnapshotStore', () => {
  const tempDirs: string[] = []
  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
    tempDirs.length = 0
  })

  it('returns null before any save', () => {
    const store = new AppliedSnapshotStore(':memory:')
    try {
      expect(store.get()).toBeNull()
    } finally {
      store.close()
    }
  })

  it('save then get round-trips assignments and config', () => {
    const store = new AppliedSnapshotStore(':memory:')
    try {
      store.save(sample)
      const got = store.get()
      expect(got).not.toBeNull()
      expect(got?.assignments).toEqual(sample.assignments)
      expect(got?.config).toEqual(sample.config)
      expect(got?.appliedAt).toBeGreaterThan(0)
      expect(got?.appliedAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1)
    } finally {
      store.close()
    }
  })

  it('save twice — second overwrites first (last write wins)', () => {
    const store = new AppliedSnapshotStore(':memory:')
    try {
      store.save(sample)
      const updated: Omit<AppliedSnapshot, 'appliedAt'> = {
        assignments: [{ entityId: 'light.bedroom_lamp', roomId: 'bedroom' }],
        config: { title: 'After', views: [] },
      }
      store.save(updated)
      const got = store.get()
      expect(got?.assignments).toEqual(updated.assignments)
      expect(got?.config).toEqual(updated.config)
    } finally {
      store.close()
    }
  })

  it('schema CHECK rejects insert with id != 1', () => {
    const store = new AppliedSnapshotStore(':memory:')
    try {
      const db = (store as unknown as { db: Database.Database }).db
      expect(() => {
        db.prepare('INSERT INTO applied_snapshot (id, assignments, config) VALUES (2, ?, ?)').run(
          '[]',
          '{}',
        )
      }).toThrow()
    } finally {
      store.close()
    }
  })

  it('preserves config shape across complex JSON payloads', () => {
    const store = new AppliedSnapshotStore(':memory:')
    try {
      const config = {
        title: 'Lovelacer — Home',
        views: [
          {
            type: 'sections',
            title: 'Kitchen',
            path: 'kitchen',
            icon: 'mdi:silverware-fork-knife',
            sections: [{ type: 'grid', cards: [{ type: 'tile', entity: 'light.kitchen' }] }],
          },
        ],
      }
      store.save({ assignments: sample.assignments, config })
      expect(store.get()?.config).toEqual(config)
    } finally {
      store.close()
    }
  })

  it('creates parent directory for file paths', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'lovelacer-snap-'))
    tempDirs.push(baseDir)
    const dbPath = join(baseDir, 'nested', 'subdir', 'lovelacer.sqlite')
    const store = new AppliedSnapshotStore(dbPath)
    try {
      expect(existsSync(dbPath)).toBe(true)
      store.save(sample)
      expect(store.get()?.assignments).toEqual(sample.assignments)
    } finally {
      store.close()
    }
  })
})
