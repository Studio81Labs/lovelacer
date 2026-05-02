import { describe, it, expect, vi } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import type { AppliedSnapshot } from '@lovelacer/shared'
import { englishCluttered } from '../../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../../tests/fixtures/_builder/index.js'
import { createApp } from '../../app.js'
import { AppliedSnapshotStore } from '../../storage/applied-snapshot-store.js'
import { InviteStore } from '../../storage/invite-store.js'
import { OverrideStore } from '../../storage/override-store.js'

function makeStore(): OverrideStore {
  return new OverrideStore(':memory:')
}

function makeAcceptedInvite(): InviteStore {
  const s = new InviteStore(':memory:')
  s.accept('BETA-2026-ALPHA')
  return s
}

function makeAppliedSnapshot(initial?: Omit<AppliedSnapshot, 'appliedAt'>): AppliedSnapshotStore {
  const s = new AppliedSnapshotStore(':memory:')
  if (initial !== undefined) s.save(initial)
  return s
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

describe('POST /api/preview', () => {
  it('returns 200 with rooms + config when HA connected', async () => {
    const ha = makeHa(true)
    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        rooms: unknown[]
        config: { title: string; views: { path: string }[] }
        summary: { entityCount: number }
      }
      expect(body.summary.entityCount).toBeGreaterThan(0)
      expect(body.config.title).toBe('Lovelacer — Home')
      expect(body.config.views[0]!.path).toBe('home')
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
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ error: 'ha_unavailable' })
    } finally {
      await app.close()
    }
  })

  it('returns 500 preview_failed when registry fetch throws', async () => {
    const ha = {
      isConnected: () => true,
      getEntityRegistry: vi.fn(async () => {
        throw new Error('boom')
      }),
      getDeviceRegistry: vi.fn(async () => []),
      getAreaRegistry: vi.fn(async () => []),
      getFloorRegistry: vi.fn(async () => []),
    } as unknown as HaClient
    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toMatchObject({ error: 'preview_failed' })
    } finally {
      await app.close()
    }
  })

  it('returns diff: null when no snapshot exists yet', async () => {
    const ha = makeHa(true)
    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      expect((res.json() as { diff: unknown }).diff).toBeNull()
    } finally {
      await app.close()
    }
  })

  it('returns diff with totals all zero when snapshot matches current analysis', async () => {
    const ha = makeHa(true)
    const learner = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    const assignments: { entityId: string; roomId: string | null }[] = []
    try {
      const res = await learner.inject({ method: 'POST', url: '/api/preview' })
      const body = res.json() as {
        rooms: { id: string; assignments: { entityId: string }[] }[]
        misc: { entityId: string }[]
      }
      for (const r of body.rooms) {
        for (const a of r.assignments) assignments.push({ entityId: a.entityId, roomId: r.id })
      }
      for (const m of body.misc) assignments.push({ entityId: m.entityId, roomId: null })
    } finally {
      await learner.close()
    }

    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot({
        assignments: assignments as { entityId: string; roomId: 'kitchen' | null }[],
        config: { title: 'x', views: [] },
      }),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      const body = res.json() as { diff: { entities: unknown[]; totals: Record<string, number> } }
      expect(body.diff).not.toBeNull()
      expect(body.diff.totals).toEqual({ added: 0, moved: 0, removed: 0 })
      expect(body.diff.entities).toEqual([])
    } finally {
      await app.close()
    }
  })

  it('flags removed entities when snapshot has an entity that is no longer in HA', async () => {
    const ha = makeHa(true)
    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot({
        assignments: [{ entityId: 'light.long_gone_entity', roomId: 'living_room' }],
        config: { title: 'x', views: [] },
      }),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      const body = res.json() as {
        diff: {
          entities: { entityId: string; kind: string; previousRoomId?: string | null }[]
          totals: Record<string, number>
        }
      }
      expect(body.diff.totals.removed).toBe(1)
      const removed = body.diff.entities.find((e) => e.kind === 'removed')
      expect(removed).toMatchObject({
        entityId: 'light.long_gone_entity',
        kind: 'removed',
        previousRoomId: 'living_room',
      })
    } finally {
      await app.close()
    }
  })
})
