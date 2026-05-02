import { describe, it, expect, vi, afterEach } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import { englishCluttered } from '../../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../../tests/fixtures/_builder/index.js'
import { createApp } from '../../app.js'
import { AppliedSnapshotStore } from '../../storage/applied-snapshot-store.js'
import { InviteStore } from '../../storage/invite-store.js'
import { OverrideStore } from '../../storage/override-store.js'

function makeAppliedSnapshot(): AppliedSnapshotStore {
  return new AppliedSnapshotStore(':memory:')
}

let invite: InviteStore | null = null

afterEach(() => {
  invite?.close()
  invite = null
})

function makeHa(): HaClient {
  const ha = fixtureToHaRegistries(englishCluttered)
  return {
    isConnected: () => true,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => []),
  } as unknown as HaClient
}

async function makeApp(opts: { accepted: boolean }) {
  invite = new InviteStore(':memory:')
  if (opts.accepted) invite.accept('BETA-2026-ALPHA')
  return createApp({
    ha: makeHa(),
    overrides: new OverrideStore(':memory:'),
    invite,
    appliedSnapshot: makeAppliedSnapshot(),
    logLevel: 'silent',
    dashboardUrlPath: 'lovelacer-home',
  })
}

describe('invite gate hook', () => {
  it('blocks POST /api/analyze with 403 invite_required when not accepted', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/analyze' })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ error: 'invite_required' })
    } finally {
      await app.close()
    }
  })

  it('blocks POST /api/preview with 403 when not accepted', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ error: 'invite_required' })
    } finally {
      await app.close()
    }
  })

  it('blocks POST /api/apply with 403 when not accepted', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: { title: 'x', views: [] } },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ error: 'invite_required' })
    } finally {
      await app.close()
    }
  })

  it('blocks GET /api/overrides with 403 when not accepted', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/overrides' })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ error: 'invite_required' })
    } finally {
      await app.close()
    }
  })

  it('blocks GET /api/export.yaml with 403 when not accepted', async () => {
    // The export endpoint produces a downloadable YAML — must be gated like
    // every other /api/* route. Locks the contract that the gate's exact-
    // match bypass list does not include /api/export.yaml.
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/export.yaml' })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ error: 'invite_required' })
    } finally {
      await app.close()
    }
  })

  it('allows GET /api/health regardless of acceptance', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/health' })
      expect(res.statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('allows GET /api/invite regardless of acceptance', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/invite' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: false })
    } finally {
      await app.close()
    }
  })

  it('allows POST /api/invite with valid code regardless of prior acceptance', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: 'BETA-2026-ALPHA' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: true })
    } finally {
      await app.close()
    }
  })

  it('after acceptance, POST /api/analyze is no longer 403', async () => {
    const app = await makeApp({ accepted: true })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/analyze' })
      // The handler runs (returns 200 with analyze result, or 503 if HA
      // is fake-disconnected). The POINT is the gate didn't intercept.
      expect(res.statusCode).not.toBe(403)
    } finally {
      await app.close()
    }
  })

  it('blocks /api/healthcheck (NOT a bypass) when not accepted', async () => {
    const app = await makeApp({ accepted: false })
    try {
      // Even though /api/healthcheck doesn't exist as a route, the gate
      // should NOT bypass it just because the path starts with /api/health.
      // Fastify will return 404 if the gate lets it through; 403 if the
      // gate properly blocks it. The point: the gate should NOT prefix-
      // match the public bypass list.
      const res = await app.inject({ method: 'GET', url: '/api/healthcheck' })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ error: 'invite_required' })
    } finally {
      await app.close()
    }
  })

  it('allows /api/invite with query string (?cache=0)', async () => {
    // The gate must let through the legit endpoint even with a query string.
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/invite?cache=0' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: false })
    } finally {
      await app.close()
    }
  })
})
