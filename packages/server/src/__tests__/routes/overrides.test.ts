import { describe, it, expect, afterEach } from 'vitest'
import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { OverrideStore } from '../../storage/override-store.js'
import { overridesRoute } from '../../routes/overrides.js'

let store: OverrideStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

async function makeApp() {
  store = new OverrideStore(':memory:')
  const app = Fastify({ logger: false })
  await app.register(sensible)
  await app.register(overridesRoute, { overrides: store })
  return app
}

describe('GET /api/overrides', () => {
  it('returns 200 with empty array on a fresh store', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/api/overrides' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ overrides: [] })
    } finally {
      await app.close()
    }
  })

  it('returns the rows the store contains', async () => {
    const app = await makeApp()
    try {
      store!.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])
      const res = await app.inject({ method: 'GET', url: '/api/overrides' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        overrides: [{ entityId: 'a.b', roomId: 'kitchen' }],
      })
    } finally {
      await app.close()
    }
  })
})

describe('PUT /api/overrides', () => {
  it('replaces the whole collection, returns 200 with the new array', async () => {
    const app = await makeApp()
    try {
      const body = {
        overrides: [
          { entityId: 'light.kitchen_ceiling', roomId: 'living_room' },
          { entityId: 'sensor.useless', hidden: true },
        ],
      }
      const res = await app.inject({ method: 'PUT', url: '/api/overrides', payload: body })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(body)

      // GET reflects the new state
      const get = await app.inject({ method: 'GET', url: '/api/overrides' })
      expect(get.json()).toEqual(body)
    } finally {
      await app.close()
    }
  })

  it('PUT with empty array clears the collection', async () => {
    const app = await makeApp()
    try {
      store!.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [] },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ overrides: [] })
      expect(store!.getAll()).toEqual([])
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when entityId regex fails', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [{ entityId: 'NotAValidId', roomId: 'kitchen' }] },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 when roomId is not a CanonicalRoomId', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [{ entityId: 'light.a', roomId: 'NOT_A_ROOM' }] },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 when roomId is "misc" (the unclassified bucket is not user-assignable)', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [{ entityId: 'light.a', roomId: 'misc' }] },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 when override has neither roomId nor hidden=true', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [{ entityId: 'light.a' }] },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 when override has hidden:false only (no-op)', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [{ entityId: 'light.a', hidden: false }] },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 on duplicate entityId in body', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: {
          overrides: [
            { entityId: 'light.a', roomId: 'kitchen' },
            { entityId: 'light.a', roomId: 'bedroom' },
          ],
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 on missing body', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'PUT', url: '/api/overrides' })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 500 storage_error and preserves prior state when storage throws', async () => {
    // Build an app with a store that fails replaceAll. We use a real
    // OverrideStore to seed initial state, then swap in a stub for the
    // route plugin to exercise the 500 path.
    const realStore = new OverrideStore(':memory:')
    realStore.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])

    const failingStore = {
      getAll: () => realStore.getAll(),
      replaceAll: () => {
        throw new Error('disk full')
      },
      close: () => realStore.close(),
    } as unknown as OverrideStore

    const app = Fastify({ logger: false })
    await app.register(sensible)
    await app.register(overridesRoute, { overrides: failingStore })

    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/overrides',
        payload: { overrides: [{ entityId: 'c.d', roomId: 'bedroom' }] },
      })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toMatchObject({ error: 'storage_error' })

      // Prior state intact in the underlying real store.
      expect(realStore.getAll()).toEqual([{ entityId: 'a.b', roomId: 'kitchen' }])
    } finally {
      await app.close()
      realStore.close()
    }
  })
})
