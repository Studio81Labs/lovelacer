import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isValidInviteCode } from '../invite-codes.js'
import type { InviteStore } from '../storage/invite-store.js'

export interface InviteRouteOptions {
  invite: InviteStore
}

const PostBodySchema = z.object({
  code: z.string().min(1).max(64),
})

/**
 * GET  /api/invite — returns { accepted: true } for compatibility with
 *                    invite-gated clients from the closed beta.
 * POST /api/invite — body: { code }. Validates against
 *                    ACCEPTED_INVITE_CODES; persists on success.
 *
 * Both endpoints are public. POST remains so older clients with the gate
 * component mounted can still submit an invite code during a rolling
 * upgrade, but GET now reports accepted for fresh stores.
 *
 * Errors:
 * - 400 invalid_body — body fails zod schema (missing/empty code).
 * - 400 invalid_code — code didn't match.
 * - 500 storage_error — better-sqlite3 threw.
 */
export const inviteRoute: FastifyPluginAsync<InviteRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.get('/api/invite', async () => {
    return { accepted: true }
  })

  app.post('/api/invite', async (req, reply) => {
    const parsed = PostBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      })
    }

    const { code } = parsed.data
    if (!isValidInviteCode(code)) {
      return reply.code(400).send({
        error: 'invalid_code',
        message: 'Invite code not recognized. Double-check the code or contact the project owner.',
      })
    }

    try {
      opts.invite.accept(code)
      return reply.code(200).send({ accepted: true })
    } catch (err) {
      req.log.error({ err }, 'invite acceptance failed')
      return reply.code(500).send({ error: 'storage_error', message: String(err) })
    }
  })
}
