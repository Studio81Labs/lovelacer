import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { CANONICAL_ROOMS } from '@lovelacer/shared'
import type { Override, CanonicalRoomId } from '@lovelacer/shared'
import type { OverrideStore } from '../storage/override-store.js'

export interface OverridesRouteOptions {
  overrides: OverrideStore
}

const ENTITY_ID_RE = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/

const ASSIGNABLE_ROOMS = CANONICAL_ROOMS.filter((r) => r !== 'misc') as Exclude<
  (typeof CANONICAL_ROOMS)[number],
  'misc'
>[]

const OverrideSchema = z
  .object({
    entityId: z.string().regex(ENTITY_ID_RE, 'must be a valid HA entity_id'),
    roomId: z.enum([...ASSIGNABLE_ROOMS] as [string, ...string[]]).optional(),
    hidden: z.boolean().optional(),
  })
  .refine((o) => o.roomId !== undefined || o.hidden === true, {
    message: 'override must set roomId or hidden=true (or both)',
  })

const PutBodySchema = z.object({
  overrides: z
    .array(OverrideSchema)
    .refine((arr) => new Set(arr.map((o) => o.entityId)).size === arr.length, {
      message: 'duplicate entityId',
    }),
})

/**
 * GET  /api/overrides — return all overrides as `{ overrides: [...] }`.
 * PUT  /api/overrides — replace all overrides; body is `{ overrides: [...] }`.
 *
 * Validation via zod. Storage atomicity via OverrideStore.replaceAll's
 * single transaction.
 *
 * Errors:
 * - 400 invalid_body — body fails schema or refine validation
 * - 500 storage_error — better-sqlite3 threw
 */
export const overridesRoute: FastifyPluginAsync<OverridesRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.get('/api/overrides', async () => {
    return { overrides: opts.overrides.getAll() }
  })

  app.put('/api/overrides', async (req, reply) => {
    const parsed = PutBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      })
    }
    try {
      const overrides: Override[] = parsed.data.overrides.map((o) => {
        const item: Override = { entityId: o.entityId }
        if (o.roomId !== undefined) item.roomId = o.roomId as CanonicalRoomId
        if (o.hidden === true) item.hidden = true
        return item
      })
      opts.overrides.replaceAll(overrides)
      return reply.code(200).send({ overrides: opts.overrides.getAll() })
    } catch (err) {
      req.log.error({ err }, 'override storage failed')
      return reply
        .code(500)
        .send({ error: 'storage_error', message: String(err) })
    }
  })
}
