import { describe, it, expect, vi } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import { englishCluttered } from '../../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../../tests/fixtures/_builder/index.js'
import { createApp } from '../../app.js'

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
    const app = await createApp({ ha, logLevel: 'silent' })
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
    const app = await createApp({ ha, logLevel: 'silent' })
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
    const app = await createApp({ ha, logLevel: 'silent' })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toMatchObject({ error: 'preview_failed' })
    } finally {
      await app.close()
    }
  })
})
