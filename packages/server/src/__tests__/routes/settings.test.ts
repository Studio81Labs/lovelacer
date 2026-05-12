import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from '@lovelacer/shared'
import { settingsRoute } from '../../routes/settings.js'
import { SettingsStore } from '../../storage/settings-store.js'

let store: SettingsStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

async function makeApp() {
  store = new SettingsStore(':memory:')
  const app = Fastify({ logger: false })
  await app.register(sensible)
  await app.register(settingsRoute, { settings: store })
  return app
}

const VALID_BODY: { settings: Settings } = {
  settings: {
    language: 'cs',
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
    roomOrder: ['bedroom', 'kitchen'],
  },
}

describe('GET /api/settings', () => {
  it('returns DEFAULT_SETTINGS on a fresh store', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/api/settings' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ settings: DEFAULT_SETTINGS })
    } finally {
      await app.close()
    }
  })

  it('returns the persisted settings after a successful PUT', async () => {
    const app = await makeApp()
    try {
      await app.inject({ method: 'PUT', url: '/api/settings', payload: VALID_BODY })
      const res = await app.inject({ method: 'GET', url: '/api/settings' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(VALID_BODY)
    } finally {
      await app.close()
    }
  })
})

describe('PUT /api/settings', () => {
  it('returns 200 with the persisted settings for a valid body', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: VALID_BODY })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(VALID_BODY)
      expect(store!.get()).toEqual(VALID_BODY.settings)
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when language is unknown', async () => {
    const app = await makeApp()
    try {
      const bad = {
        settings: { ...VALID_BODY.settings, language: 'klingon' },
      }
      const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: bad })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when sections.welcome is missing', async () => {
    const app = await makeApp()
    try {
      const bad = {
        settings: {
          language: 'auto',
          cardPack: 'default',
          sections: {
            // welcome omitted
            quickStats: true,
            people: true,
            roomsByFloor: true,
            activeRooms: true,
            scenes: true,
            cameras: true,
          },
        },
      }
      const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: bad })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when cardPack is unknown', async () => {
    const app = await makeApp()
    try {
      const bad = {
        settings: { ...VALID_BODY.settings, cardPack: 'fancy' },
      }
      const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: bad })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('round-trip: PUT then GET returns the same shape', async () => {
    const app = await makeApp()
    try {
      await app.inject({ method: 'PUT', url: '/api/settings', payload: VALID_BODY })
      const res = await app.inject({ method: 'GET', url: '/api/settings' })
      expect(res.json()).toEqual(VALID_BODY)
    } finally {
      await app.close()
    }
  })

  it('round-trips uiLanguage through PUT/GET', async () => {
    const app = await makeApp()
    try {
      await app.inject({
        method: 'PUT',
        url: '/api/settings',
        payload: {
          settings: {
            language: 'auto',
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
            uiLanguage: 'de',
          },
        },
      })
      const res = await app.inject({ method: 'GET', url: '/api/settings' })
      expect(res.json().settings.uiLanguage).toBe('de')
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when uiLanguage is unknown', async () => {
    const app = await makeApp()
    try {
      const bad = {
        settings: { ...VALID_BODY.settings, uiLanguage: 'klingon' },
      }
      const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: bad })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('round-trips roomOrder through PUT/GET', async () => {
    const app = await makeApp()
    try {
      await app.inject({
        method: 'PUT',
        url: '/api/settings',
        payload: {
          settings: {
            language: 'auto',
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
            roomOrder: ['bedroom', 'kitchen'],
          },
        },
      })
      const res = await app.inject({ method: 'GET', url: '/api/settings' })
      expect(res.json().settings.roomOrder).toEqual(['bedroom', 'kitchen'])
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body when roomOrder contains a non-string value', async () => {
    const app = await makeApp()
    try {
      const bad = {
        settings: { ...VALID_BODY.settings, roomOrder: ['kitchen', 123] },
      }
      const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: bad })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('accepts a body without uiLanguage (the field is optional)', async () => {
    const app = await makeApp()
    try {
      // Bodies emitted by clients that have not yet had the user pick a
      // UI language must round-trip without 400. The field is optional
      // by design — see Settings.uiLanguage in @lovelacer/shared.
      const body = {
        settings: {
          language: 'auto',
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
        },
      }
      const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: body })
      expect(res.statusCode).toBe(200)
      expect(res.json().settings.uiLanguage).toBeUndefined()
    } finally {
      await app.close()
    }
  })
})
