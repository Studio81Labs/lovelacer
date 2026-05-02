import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it } from 'vitest'
import { suggestionsRoute } from '../../routes/suggestions.js'
import { DismissedSuggestionStore } from '../../storage/dismissed-suggestion-store.js'

let store: DismissedSuggestionStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

async function makeApp() {
  store = new DismissedSuggestionStore(':memory:')
  const app = Fastify({ logger: false })
  await app.register(sensible)
  await app.register(suggestionsRoute, { dismissed: store })
  return app
}

describe('POST /api/suggestions/dismiss', () => {
  it('returns 200 { ok: true } and persists for a valid body', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/suggestions/dismiss',
        payload: { entityId: 'sensor.foo', suggestionType: 'set_area_id' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ ok: true })
      expect(store!.getAllAsKeySet().has('sensor.foo|set_area_id')).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when entityId is missing', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/suggestions/dismiss',
        payload: { suggestionType: 'set_area_id' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when suggestionType is unknown', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/suggestions/dismiss',
        payload: { entityId: 'sensor.foo', suggestionType: 'magic' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('accepts each of the three valid suggestion types', async () => {
    const app = await makeApp()
    try {
      for (const t of ['set_area_id', 'move_room', 'hide_diagnostic']) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/suggestions/dismiss',
          payload: { entityId: `sensor.${t}`, suggestionType: t },
        })
        expect(res.statusCode).toBe(200)
      }
      expect(store!.getAllAsKeySet().size).toBe(3)
    } finally {
      await app.close()
    }
  })
})
