import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DismissedSuggestionStore } from '../dismissed-suggestion-store.js'

describe('DismissedSuggestionStore (in-memory)', () => {
  let store: DismissedSuggestionStore

  beforeEach(() => {
    store = new DismissedSuggestionStore(':memory:')
  })

  afterEach(() => {
    store.close()
  })

  it('returns an empty Set on a fresh store', () => {
    expect(store.getAllAsKeySet().size).toBe(0)
  })

  it('persists a dismissal and exposes it as the entityId|type key', () => {
    store.dismiss('sensor.foo', 'set_area_id')
    const set = store.getAllAsKeySet()
    expect(set.has('sensor.foo|set_area_id')).toBe(true)
    expect(set.size).toBe(1)
  })

  it('is idempotent — dismissing the same (entityId, type) twice yields one row', () => {
    store.dismiss('sensor.foo', 'set_area_id')
    store.dismiss('sensor.foo', 'set_area_id')
    expect(store.getAllAsKeySet().size).toBe(1)
  })

  it('treats different types of the same entity as distinct rows', () => {
    store.dismiss('sensor.foo', 'set_area_id')
    store.dismiss('sensor.foo', 'hide_diagnostic')
    const set = store.getAllAsKeySet()
    expect(set.size).toBe(2)
    expect(set.has('sensor.foo|set_area_id')).toBe(true)
    expect(set.has('sensor.foo|hide_diagnostic')).toBe(true)
  })
})

describe('DismissedSuggestionStore (file-backed)', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dss-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates the parent directory if missing', () => {
    const filename = join(dir, 'nested', 'lovelacer.sqlite')
    const store = new DismissedSuggestionStore(filename)
    try {
      store.dismiss('a.b', 'move_room')
      expect(store.getAllAsKeySet().has('a.b|move_room')).toBe(true)
    } finally {
      store.close()
    }
  })

  it('persists across instances', () => {
    const filename = join(dir, 'lovelacer.sqlite')
    const first = new DismissedSuggestionStore(filename)
    first.dismiss('a.b', 'move_room')
    first.close()
    const second = new DismissedSuggestionStore(filename)
    try {
      expect(second.getAllAsKeySet().has('a.b|move_room')).toBe(true)
    } finally {
      second.close()
    }
  })
})
