import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { OnboardingStore } from '../storage/onboarding-store.js'

export interface OnboardingRouteOptions {
  onboarding: OnboardingStore
}

/**
 * GET  /api/onboarding             — returns `{ completedAt: number | null }`.
 *                                    null when the user hasn't completed the
 *                                    wizard yet (fresh install).
 * POST /api/onboarding/complete    — marks onboarding completed and returns
 *                                    `{ completedAt: number }`. No body.
 *                                    Idempotent (INSERT OR REPLACE).
 *
 * Errors:
 *   - 500 storage_error — better-sqlite3 threw on complete().
 */
export const onboardingRoute: FastifyPluginAsync<OnboardingRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.get('/api/onboarding', async () => {
    return opts.onboarding.get()
  })

  app.post('/api/onboarding/complete', async (req, reply) => {
    try {
      return opts.onboarding.complete()
    } catch (err) {
      req.log.error({ err }, 'onboarding complete failed')
      return reply.code(500).send({ error: 'storage_error', message: String(err) })
    }
  })
}
