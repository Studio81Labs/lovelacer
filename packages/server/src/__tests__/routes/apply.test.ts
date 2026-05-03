import { describe, it, expect, vi } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import { HaApplyError } from '@lovelacer/ha-client'
import type { LovelaceConfig } from '@lovelacer/generator'
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

interface FakeHa {
  client: HaClient
  applyDashboard: ReturnType<typeof vi.fn>
  getEntityRegistry: ReturnType<typeof vi.fn>
}

function makeHa(connected = true): FakeHa {
  const ha = fixtureToHaRegistries(englishCluttered)
  const applyDashboard = vi.fn()
  const getEntityRegistry = vi.fn(async () => ha.entities)
  const getDeviceRegistry = vi.fn(async () => ha.devices)
  const getAreaRegistry = vi.fn(async () => ha.areas)
  const client = {
    isConnected: () => connected,
    getEntityRegistry,
    getDeviceRegistry,
    getAreaRegistry,
    getFloorRegistry: vi.fn(async () => []),
    applyDashboard,
  } as unknown as HaClient
  return { client, applyDashboard, getEntityRegistry }
}

const validConfig: LovelaceConfig = {
  title: 'Custom',
  views: [
    {
      type: 'sections',
      title: 'Home',
      path: 'home',
      icon: 'mdi:home-variant',
      sections: [],
    },
  ],
}

describe('POST /api/apply — happy paths', () => {
  it('with no body: re-runs preview and applies', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({
      urlPath: 'lovelacer-home',
      created: false,
    })
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/apply' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        ok: true,
        urlPath: 'lovelacer-home',
        created: false,
      })
      expect(fake.getEntityRegistry).toHaveBeenCalled()
      expect(fake.applyDashboard).toHaveBeenCalledOnce()
    } finally {
      await app.close()
    }
  })

  it('with body.config: applies that config without re-running preview', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({
      urlPath: 'lovelacer-home',
      created: true,
    })
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: validConfig },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ ok: true, created: true })
      expect(fake.getEntityRegistry).not.toHaveBeenCalled()
      expect(fake.applyDashboard).toHaveBeenCalledWith(validConfig, {
        urlPath: 'lovelacer-home',
      })
    } finally {
      await app.close()
    }
  })

  it('with body.options: forwards options to applyDashboard', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({
      urlPath: 'foo',
      created: true,
    })
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: validConfig, options: { urlPath: 'foo' } },
      })
      expect(res.statusCode).toBe(200)
      expect(fake.applyDashboard).toHaveBeenCalledWith(validConfig, { urlPath: 'foo' })
    } finally {
      await app.close()
    }
  })
})

describe('POST /api/apply — error paths', () => {
  it('returns 503 ha_unavailable when HA disconnected', async () => {
    const fake = makeHa(false)
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/apply' })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ error: 'ha_unavailable' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_config when body.config.title is not a string', async () => {
    const fake = makeHa(true)
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: { title: 123, views: [] } },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_config' })
      expect(fake.applyDashboard).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_config when body.config.views is not an array', async () => {
    const fake = makeHa(true)
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: { title: 'x', views: {} } },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_config' })
    } finally {
      await app.close()
    }
  })

  it('returns 502 ha_apply_failed with step when HaApplyError thrown', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockRejectedValueOnce(
      new HaApplyError('save', 'config invalid', new Error('cause')),
    )
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: makeAppliedSnapshot(),
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: validConfig },
      })
      expect(res.statusCode).toBe(502)
      expect(res.json()).toMatchObject({
        error: 'ha_apply_failed',
        step: 'save',
      })
    } finally {
      await app.close()
    }
  })
})

describe('POST /api/apply — snapshot persistence', () => {
  it('persists snapshot after successful HA push', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'lovelacer-home', created: false })
    const snap = makeAppliedSnapshot()
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: snap,
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const body = {
        config: validConfig,
        snapshot: {
          assignments: [{ entityId: 'light.kitchen_ceiling', roomId: 'kitchen' }],
          config: validConfig,
        },
      }
      const res = await app.inject({ method: 'POST', url: '/api/apply', payload: body })
      expect(res.statusCode).toBe(200)
      const json = res.json() as Record<string, unknown>
      expect(json.snapshot_skipped).toBeUndefined()
      expect(json.snapshot_persisted).toBeUndefined()
      const stored = snap.get()
      expect(stored).not.toBeNull()
      expect(stored?.assignments).toEqual([
        { entityId: 'light.kitchen_ceiling', roomId: 'kitchen' },
      ])
    } finally {
      await app.close()
    }
  })

  it('returns snapshot_skipped: invalid when snapshot shape is malformed (push still succeeds)', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'lovelacer-home', created: false })
    const snap = makeAppliedSnapshot()
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: snap,
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const body = {
        config: validConfig,
        snapshot: { assignments: 'not-an-array', config: validConfig },
      }
      const res = await app.inject({ method: 'POST', url: '/api/apply', payload: body })
      expect(res.statusCode).toBe(200)
      expect((res.json() as Record<string, unknown>).snapshot_skipped).toBe('invalid')
      expect(snap.get()).toBeNull()
    } finally {
      await app.close()
    }
  })

  it('does not persist snapshot when no snapshot field is sent', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'lovelacer-home', created: false })
    const snap = makeAppliedSnapshot()
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: snap,
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: validConfig },
      })
      expect(res.statusCode).toBe(200)
      const json = res.json() as Record<string, unknown>
      expect(json.snapshot_skipped).toBeUndefined()
      expect(json.snapshot_persisted).toBeUndefined()
      expect(snap.get()).toBeNull()
    } finally {
      await app.close()
    }
  })

  it('does NOT persist snapshot when HA push fails', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockRejectedValueOnce(new HaApplyError('save', 'boom'))
    const snap = makeAppliedSnapshot()
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: snap,
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const body = {
        config: validConfig,
        snapshot: {
          assignments: [{ entityId: 'light.kitchen_ceiling', roomId: 'kitchen' }],
          config: validConfig,
        },
      }
      const res = await app.inject({ method: 'POST', url: '/api/apply', payload: body })
      expect(res.statusCode).toBe(502)
      expect(snap.get()).toBeNull()
    } finally {
      await app.close()
    }
  })

  it('returns snapshot_persisted: false when the store save throws (push still succeeds)', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'lovelacer-home', created: false })
    const snap = makeAppliedSnapshot()
    // Replace `save` with a thrower to simulate disk-full / SQLite failure.
    // Casting via `unknown` because save is a method on a class instance.
    ;(snap as unknown as { save: () => void }).save = () => {
      throw new Error('disk full')
    }
    const app = await createApp({
      ha: fake.client,
      overrides: makeStore(),
      invite: makeAcceptedInvite(),
      appliedSnapshot: snap,
      dismissedSuggestions: makeDismissed(),
      settings: new SettingsStore(':memory:'),
      logLevel: 'silent',
      dashboardUrlPath: 'lovelacer-home',
    })
    try {
      const body = {
        config: validConfig,
        snapshot: {
          assignments: [{ entityId: 'light.kitchen_ceiling', roomId: 'kitchen' }],
          config: validConfig,
        },
      }
      const res = await app.inject({ method: 'POST', url: '/api/apply', payload: body })
      expect(res.statusCode).toBe(200)
      expect((res.json() as Record<string, unknown>).snapshot_persisted).toBe(false)
      // Note: snap.get() may return null since we replaced save before it ever ran.
      // The contract is that the route surfaces the failure, not that the store recovers.
    } finally {
      await app.close()
    }
  })
})
