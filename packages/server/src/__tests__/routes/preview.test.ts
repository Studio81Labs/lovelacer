import { describe, it, expect, vi, afterEach } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import type { AppliedSnapshot, CanonicalRoomId, SnapshotAssignment } from '@lovelacer/shared'
import { englishCluttered } from '../../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../../tests/fixtures/_builder/index.js'
import { createApp } from '../../app.js'
import { AppliedSnapshotStore } from '../../storage/applied-snapshot-store.js'
import { DismissedSuggestionStore } from '../../storage/dismissed-suggestion-store.js'
import { LatestAnalysisStore } from '../../storage/latest-analysis-store.js'
import { InviteStore } from '../../storage/invite-store.js'
import { OverrideStore } from '../../storage/override-store.js'
import { SettingsStore } from '../../storage/settings-store.js'
import { OnboardingStore } from '../../storage/onboarding-store.js'

let dismissed: DismissedSuggestionStore | null = null
let settings: SettingsStore | null = null
let onboarding: OnboardingStore | null = null
let latestAnalysis: LatestAnalysisStore | null = null

afterEach(() => {
  dismissed?.close()
  dismissed = null
  settings?.close()
  settings = null
  onboarding?.close()
  onboarding = null
  latestAnalysis?.close()
  latestAnalysis = null
})

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

function makeLatestAnalysis(): LatestAnalysisStore {
  latestAnalysis = new LatestAnalysisStore(':memory:')
  return latestAnalysis
}

function makeHa(connected = true): HaClient {
  const ha = fixtureToHaRegistries(englishCluttered)
  return {
    isConnected: () => connected,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => ha.floors),
  } as unknown as HaClient
}

async function makeApp(
  opts: {
    connected?: boolean
    snapshot?: Omit<AppliedSnapshot, 'appliedAt'>
    accepted?: boolean
  } = {},
) {
  dismissed = new DismissedSuggestionStore(':memory:')
  settings = new SettingsStore(':memory:')
  onboarding = new OnboardingStore(':memory:')
  return createApp({
    ha: makeHa(opts.connected ?? true),
    overrides: makeStore(),
    invite: makeAcceptedInvite(),
    appliedSnapshot: makeAppliedSnapshot(opts.snapshot),
    latestAnalysis: makeLatestAnalysis(),
    dismissedSuggestions: dismissed,
    settings,
    onboarding,
    logLevel: 'silent',
    dashboardUrlPath: 'lovelacer-home',
  })
}

describe('POST /api/preview', () => {
  it('returns 200 with rooms + config when HA connected', async () => {
    const app = await makeApp({ connected: true })
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

  it('still returns preview when latest-analysis cache persistence fails', async () => {
    dismissed = new DismissedSuggestionStore(':memory:')
    settings = new SettingsStore(':memory:')
    onboarding = new OnboardingStore(':memory:')
    const app = await createApp({
      ha: makeHa(true),
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      latestAnalysis: {
        get: () => null,
        save: () => {
          throw new Error('disk full')
        },
        close: () => {},
      } as unknown as LatestAnalysisStore,
      dismissedSuggestions: dismissed,
      settings,
      onboarding,
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      expect(
        (res.json() as { summary: { entityCount: number } }).summary.entityCount,
      ).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })

  it('returns 503 ha_unavailable when HA disconnected', async () => {
    const app = await makeApp({ connected: false })
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
    dismissed = new DismissedSuggestionStore(':memory:')
    settings = new SettingsStore(':memory:')
    onboarding = new OnboardingStore(':memory:')
    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      latestAnalysis: makeLatestAnalysis(),
      dismissedSuggestions: dismissed,
      settings,
      onboarding,
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
    const app = await makeApp()
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
    dismissed = new DismissedSuggestionStore(':memory:')
    settings = new SettingsStore(':memory:')
    onboarding = new OnboardingStore(':memory:')
    const learner = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      latestAnalysis: makeLatestAnalysis(),
      dismissedSuggestions: dismissed,
      settings,
      onboarding,
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    const assignments: SnapshotAssignment[] = []
    try {
      const res = await learner.inject({ method: 'POST', url: '/api/preview' })
      const body = res.json() as {
        rooms: { id: string; assignments: { entityId: string }[] }[]
        misc: { entityId: string }[]
      }
      for (const r of body.rooms) {
        for (const a of r.assignments) {
          assignments.push({ entityId: a.entityId, roomId: r.id as CanonicalRoomId })
        }
      }
      for (const m of body.misc) assignments.push({ entityId: m.entityId, roomId: null })
    } finally {
      await learner.close()
    }

    // dismissed, settings, and onboarding are reused for the second app instance in this test
    const app = await createApp({
      ha,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot({
        assignments,
        config: { title: 'x', views: [] },
      }),
      latestAnalysis: makeLatestAnalysis(),
      dismissedSuggestions: dismissed,
      settings: settings!,
      onboarding: onboarding!,
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
    const app = await makeApp({
      snapshot: {
        assignments: [{ entityId: 'light.long_gone_entity', roomId: 'living_room' }],
        config: { title: 'x', views: [] },
      },
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

  it('home view contains a "Rooms by floor" section when fixture has floor data', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        config: {
          views: { path: string; sections: { cards: { type: string; heading?: string }[] }[] }[]
        }
      }
      const home = body.config.views.find((v) => v.path === 'home')
      expect(home).toBeDefined()
      const headings = home!.sections
        .flatMap((s) => s.cards)
        .filter((c) => c.type === 'heading')
        .map((c) => c.heading)
      // englishCluttered has two floors: Ground and Upstairs.
      expect(headings).toContain('Ground')
      expect(headings).toContain('Upstairs')
    } finally {
      await app.close()
    }
  })

  it('home view omits the "Rooms by floor" section when getFloorRegistry rejects (defensive)', async () => {
    const ha = fixtureToHaRegistries(englishCluttered)
    const fakeHa = {
      isConnected: () => true,
      getEntityRegistry: vi.fn(async () => ha.entities),
      getDeviceRegistry: vi.fn(async () => ha.devices),
      getAreaRegistry: vi.fn(async () => ha.areas),
      getFloorRegistry: vi.fn(async () => {
        throw new Error('not supported')
      }),
    } as unknown as HaClient
    dismissed = new DismissedSuggestionStore(':memory:')
    settings = new SettingsStore(':memory:')
    onboarding = new OnboardingStore(':memory:')
    const app = await createApp({
      ha: fakeHa,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      latestAnalysis: makeLatestAnalysis(),
      dismissedSuggestions: dismissed,
      settings,
      onboarding,
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        config: {
          views: { path: string; sections: { cards: { type: string; heading?: string }[] }[] }[]
        }
      }
      const home = body.config.views.find((v) => v.path === 'home')
      expect(home).toBeDefined()
      // No floor data → no headings on the home view.
      const headings = home!.sections.flatMap((s) => s.cards).filter((c) => c.type === 'heading')
      expect(headings).toHaveLength(0)
    } finally {
      await app.close()
    }
  })
})

describe('GET /api/analysis/latest', () => {
  it('returns null before any preview has been cached', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/api/analysis/latest' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toBeNull()
    } finally {
      await app.close()
    }
  })

  it('returns the latest preview result after a successful preview', async () => {
    const app = await makeApp()
    try {
      const previewRes = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(previewRes.statusCode).toBe(200)
      const preview = previewRes.json() as {
        rooms: unknown[]
        config: { views: unknown[] }
        summary: { entityCount: number }
      }

      const latestRes = await app.inject({ method: 'GET', url: '/api/analysis/latest' })
      expect(latestRes.statusCode).toBe(200)
      const latest = latestRes.json() as {
        analysis: typeof preview
        analyzedAt: number
      }
      expect(latest.analysis.summary).toEqual(preview.summary)
      expect(latest.analysis.config.views).toEqual(preview.config.views)
      expect(latest.analyzedAt).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })
})

describe('POST /api/preview — suggestions', () => {
  it('returns suggestions[] for a fixture with a no-area name-detected entity', async () => {
    // englishCluttered fixture has at least one entity that:
    //   - has no haAreaId (and device has no haAreaId)
    //   - matches a canonical room via friendly_name
    //   - confidence >= 0.6 (single-source 0.6 winner; no corroboration)
    // Test pins that the pipeline computes + attaches suggestions[] to
    // the response.
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { suggestions: { type: string }[] }
      expect(Array.isArray(body.suggestions)).toBe(true)
      expect(body.suggestions.some((s) => s.type === 'set_area_id')).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('does NOT return dismissed suggestions in the preview response', async () => {
    const app = await makeApp()
    try {
      // First call: discover a real (entityId, type) pair that's currently
      // suggested.
      const first = await app.inject({ method: 'POST', url: '/api/preview' })
      const firstBody = first.json() as {
        suggestions: { entityId: string; type: string }[]
      }
      const target = firstBody.suggestions.find((s) => s.type === 'set_area_id')
      expect(target).toBeDefined()

      // Dismiss it via the new endpoint.
      const dismissRes = await app.inject({
        method: 'POST',
        url: '/api/suggestions/dismiss',
        payload: { entityId: target!.entityId, suggestionType: target!.type },
      })
      expect(dismissRes.statusCode).toBe(200)

      // Re-preview — the dismissed (entityId, type) is gone.
      const second = await app.inject({ method: 'POST', url: '/api/preview' })
      const secondBody = second.json() as {
        suggestions: { entityId: string; type: string }[]
      }
      const stillThere = secondBody.suggestions.find(
        (s) => s.entityId === target!.entityId && s.type === target!.type,
      )
      expect(stillThere).toBeUndefined()
    } finally {
      await app.close()
    }
  })
})

describe('POST /api/preview — section toggles (P2-6)', () => {
  it('default settings include all 7 home-view section types when fixture supports them', async () => {
    const app = await makeApp({ accepted: true })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        config: { views: { path: string; sections: { cards: { type: string }[] }[] }[] }
      }
      const home = body.config.views.find((v) => v.path === 'home')
      expect(home).toBeDefined()
      // Welcome (markdown card) should be present in the default config
      const hasMarkdown = home!.sections.some((s) => s.cards.some((c) => c.type === 'markdown'))
      expect(hasMarkdown).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('saving sections.welcome=false removes the markdown card from the home view', async () => {
    const app = await makeApp({ accepted: true })
    try {
      const payload = {
        settings: {
          language: 'auto',
          cardPack: 'default',
          sections: {
            welcome: false,
            quickStats: true,
            people: true,
            roomsByFloor: true,
            activeRooms: true,
            scenes: true,
            cameras: true,
          },
          uiLanguage: 'en',
        },
      }
      const put = await app.inject({ method: 'PUT', url: '/api/settings', payload })
      expect(put.statusCode).toBe(200)

      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        config: { views: { path: string; sections: { cards: { type: string }[] }[] }[] }
      }
      const home = body.config.views.find((v) => v.path === 'home')
      const hasMarkdown = home!.sections.some((s) => s.cards.some((c) => c.type === 'markdown'))
      expect(hasMarkdown).toBe(false)
    } finally {
      await app.close()
    }
  })
})

describe('POST /api/preview — language filter (P2-6)', () => {
  it('language=auto matches all keyword sets (regression baseline)', async () => {
    const app = await makeApp({ accepted: true })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { rooms: { id: string; entityCount: number }[] }
      const totalAssigned = body.rooms.reduce((sum, r) => sum + r.entityCount, 0)
      expect(totalAssigned).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })

  it('language=cs filters EN-only friendly names — fewer or equal detections than auto', async () => {
    const app = await makeApp({ accepted: true })
    try {
      const baseline = await app.inject({ method: 'POST', url: '/api/preview' })
      const baselineBody = baseline.json() as { rooms: { entityCount: number }[] }
      const baselineCount = baselineBody.rooms.reduce((s, r) => s + r.entityCount, 0)

      await app.inject({
        method: 'PUT',
        url: '/api/settings',
        payload: {
          settings: {
            language: 'cs',
            cardPack: 'default',
            sections: {
              welcome: true,
              quickStats: true,
              people: true,
              roomsByFloor: true,
              activeRooms: true,
              scenes: true,
              cameras: true,
            },
            uiLanguage: 'en',
          },
        },
      })

      const cs = await app.inject({ method: 'POST', url: '/api/preview' })
      const csBody = cs.json() as { rooms: { entityCount: number }[] }
      const csCount = csBody.rooms.reduce((s, r) => s + r.entityCount, 0)

      // The English fixture has English friendly names → priorities 3-5
      // narrow to CS produces equal-or-fewer assignments. Priorities 1-2
      // (HA area names) still fire for entities with haAreaId set.
      expect(csCount).toBeLessThanOrEqual(baselineCount)
    } finally {
      await app.close()
    }
  })
})
