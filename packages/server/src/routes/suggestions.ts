import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { DismissedSuggestionStore } from '../storage/dismissed-suggestion-store.js'

export interface SuggestionsRouteOptions {
  dismissed: DismissedSuggestionStore
}

const SUGGESTION_TYPES = ['set_area_id', 'move_room', 'hide_diagnostic'] as const

const DismissBodySchema = z.object({
  entityId: z.string().min(1).max(255),
  suggestionType: z.enum(SUGGESTION_TYPES),
})

/**
 * POST /api/suggestions/dismiss — persists a dismissal so the suggestion
 * is filtered out of every future preview.
 *
 * Body: `{ entityId: string, suggestionType: SuggestionType }`.
 *
 * Errors:
 * - 400 invalid_body — body fails schema (missing/invalid fields)
 * - 500 storage_error — better-sqlite3 threw
 */
export const suggestionsRoute: FastifyPluginAsync<SuggestionsRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post('/api/suggestions/dismiss', async (req, reply) => {
    const parsed = DismissBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      })
    }
    try {
      opts.dismissed.dismiss(parsed.data.entityId, parsed.data.suggestionType)
      return reply.code(200).send({ ok: true })
    } catch (err) {
      req.log.error({ err }, 'dismiss suggestion failed')
      return reply.code(500).send({ error: 'storage_error', message: String(err) })
    }
  })
}
