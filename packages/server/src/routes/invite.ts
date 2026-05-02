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
 * GET  /api/invite — returns { accepted: boolean }.
 * POST /api/invite — body: { code }. Validates against
 *                    ACCEPTED_INVITE_CODES; persists on success.
 *
 * Both endpoints are public (bypass the gate hook). The hook in app.ts
 * lets through any request with path matching /api/invite (startsWith),
 * so this plugin is reachable on first run before acceptance.
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
    return { accepted: opts.invite.isAccepted() }
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
