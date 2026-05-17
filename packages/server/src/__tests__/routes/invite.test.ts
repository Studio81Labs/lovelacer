import { describe, it, expect, afterEach } from 'vitest'
import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { InviteStore } from '../../storage/invite-store.js'
import { inviteRoute } from '../../routes/invite.js'

let store: InviteStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

async function makeApp() {
  store = new InviteStore(':memory:')
  const app = Fastify({ logger: false })
  await app.register(sensible)
  await app.register(inviteRoute, { invite: store })
  return app
}

describe('GET /api/invite', () => {
  it('returns 200 { accepted: true } on a fresh store now that Lovelacer is public', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/api/invite' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: true })
    } finally {
      await app.close()
    }
  })

  it('returns 200 { accepted: true } after a valid POST', async () => {
    const app = await makeApp()
    try {
      await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: 'BETA-2026-ALPHA' },
      })
      const res = await app.inject({ method: 'GET', url: '/api/invite' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: true })
    } finally {
      await app.close()
    }
  })
})

describe('POST /api/invite', () => {
  it('returns 200 with valid code, persists', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: 'BETA-2026-ALPHA' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: true })
      expect(store!.isAccepted()).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_code with wrong code, does NOT persist', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: 'WRONG-CODE' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_code' })
      expect(store!.isAccepted()).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body with empty body', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'POST', url: '/api/invite' })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('accepts case-insensitive code', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: 'beta-2026-alpha' },
      })
      expect(res.statusCode).toBe(200)
      expect(store!.isAccepted()).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('accepts code with leading/trailing whitespace', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: '  BETA-2026-ALPHA  ' },
      })
      expect(res.statusCode).toBe(200)
      expect(store!.isAccepted()).toBe(true)
    } finally {
      await app.close()
    }
  })
})
