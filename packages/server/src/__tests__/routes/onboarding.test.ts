import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it } from 'vitest'
import { onboardingRoute } from '../../routes/onboarding.js'
import { OnboardingStore } from '../../storage/onboarding-store.js'

let store: OnboardingStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

async function makeApp() {
  store = new OnboardingStore(':memory:')
  const app = Fastify({ logger: false })
  await app.register(sensible)
  await app.register(onboardingRoute, { onboarding: store })
  return app
}

describe('GET /api/onboarding', () => {
  it('returns { completedAt: null } on a fresh store', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/api/onboarding' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ completedAt: null })
    } finally {
      await app.close()
    }
  })

  it('returns the persisted timestamp after a successful POST', async () => {
    const app = await makeApp()
    try {
      const post = await app.inject({ method: 'POST', url: '/api/onboarding/complete' })
      expect(post.statusCode).toBe(200)
      const get = await app.inject({ method: 'GET', url: '/api/onboarding' })
      expect(get.statusCode).toBe(200)
      expect(get.json()).toEqual(post.json())
    } finally {
      await app.close()
    }
  })
})

describe('POST /api/onboarding/complete', () => {
  it('returns 200 with a non-null completedAt timestamp', async () => {
    const app = await makeApp()
    try {
      const before = Math.floor(Date.now() / 1000)
      const res = await app.inject({ method: 'POST', url: '/api/onboarding/complete' })
      const after = Math.floor(Date.now() / 1000) + 1
      expect(res.statusCode).toBe(200)
      const body = res.json() as { completedAt: number | null }
      expect(body.completedAt).not.toBeNull()
      expect(body.completedAt!).toBeGreaterThanOrEqual(before)
      expect(body.completedAt!).toBeLessThanOrEqual(after)
      expect(store!.get()).toEqual(body)
    } finally {
      await app.close()
    }
  })

  it('twice in a row is idempotent', async () => {
    const app = await makeApp()
    try {
      const first = await app.inject({ method: 'POST', url: '/api/onboarding/complete' })
      const second = await app.inject({ method: 'POST', url: '/api/onboarding/complete' })
      expect(first.statusCode).toBe(200)
      expect(second.statusCode).toBe(200)
      const firstBody = first.json() as { completedAt: number }
      const secondBody = second.json() as { completedAt: number }
      expect(secondBody.completedAt).toBeGreaterThanOrEqual(firstBody.completedAt)
    } finally {
      await app.close()
    }
  })

  it('returns 500 storage_error when the store throws', async () => {
    const throwingStore: OnboardingStore = {
      get: () => ({ completedAt: null }),
      complete: () => {
        throw new Error('disk full')
      },
      close: () => {},
    } as unknown as OnboardingStore
    const app = Fastify({ logger: false })
    await app.register(sensible)
    await app.register(onboardingRoute, { onboarding: throwingStore })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/onboarding/complete' })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toMatchObject({ error: 'storage_error' })
    } finally {
      await app.close()
    }
  })
})
