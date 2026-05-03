import { describe, it, expect, vi } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import { englishCluttered } from '../../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../../tests/fixtures/_builder/index.js'
import { createApp } from '../../app.js'
import { AppliedSnapshotStore } from '../../storage/applied-snapshot-store.js'
import { DismissedSuggestionStore } from '../../storage/dismissed-suggestion-store.js'
import { InviteStore } from '../../storage/invite-store.js'
import { OverrideStore } from '../../storage/override-store.js'
import { SettingsStore } from '../../storage/settings-store.js'

function makeStore(): OverrideStore {
  return new OverrideStore(':memory:')
}

function makeAcceptedInvite(): InviteStore {
  const s = new InviteStore(':memory:')
  s.accept('BETA-2026-ALPHA')
  return s
}

function makeAppliedSnapshot(): AppliedSnapshotStore {
  return new AppliedSnapshotStore(':memory:')
}

function makeDismissed(): DismissedSuggestionStore {
  return new DismissedSuggestionStore(':memory:')
}

function makeHa(connected = true): HaClient {
  const ha = fixtureToHaRegistries(englishCluttered)
  return {
    isConnected: () => connected,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => []),
  } as unknown as HaClient
}

describe('POST /api/analyze', () => {
  it('returns 200 with rooms, misc, summary when HA connected', async () => {
    const ha = makeHa(true)
    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/analyze' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        rooms: unknown[]
        misc: unknown[]
        summary: { entityCount: number; roomCount: number; miscCount: number }
      }
      expect(body.summary.entityCount).toBeGreaterThan(0)
      expect(body.rooms.length).toBe(body.summary.roomCount)
      expect(body.misc.length).toBe(body.summary.miscCount)
    } finally {
      await app.close()
    }
  })

  it('returns 503 ha_unavailable when HA disconnected', async () => {
    const ha = makeHa(false)
    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/analyze' })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ error: 'ha_unavailable' })
    } finally {
      await app.close()
    }
  })

  it('returns 500 analyze_failed when registry fetch throws', async () => {
    const ha = {
      isConnected: () => true,
      getEntityRegistry: vi.fn(async () => {
        throw new Error('boom')
      }),
      getDeviceRegistry: vi.fn(async () => []),
      getAreaRegistry: vi.fn(async () => []),
    } as unknown as HaClient
    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/analyze' })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toMatchObject({ error: 'analyze_failed' })
    } finally {
      await app.close()
    }
  })
})
