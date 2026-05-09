import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { InviteStore } from '../invite-store.js'
import { OverrideStore } from '../override-store.js'

describe('SQLite shared connection support', () => {
  it('lets multiple stores share a caller-owned connection without closing it', () => {
    const db = new Database(':memory:')
    const overrides = new OverrideStore(db)
    const invite = new InviteStore(db)

    try {
      overrides.replaceAll([{ entityId: 'light.kitchen', roomId: 'kitchen' }])
      invite.accept('BETA-2026-ALPHA')

      expect(overrides.getAll()).toEqual([{ entityId: 'light.kitchen', roomId: 'kitchen' }])
      expect(invite.isAccepted()).toBe(true)

      overrides.close()
      invite.close()

      expect(
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('overrides', 'invite_acceptance') ORDER BY name",
          )
          .all(),
      ).toEqual([{ name: 'invite_acceptance' }, { name: 'overrides' }])
    } finally {
      if (db.open) db.close()
    }
  })
})
