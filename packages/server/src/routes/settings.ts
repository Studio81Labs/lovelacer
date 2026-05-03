import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { SUPPORTED_CARD_PACKS, SUPPORTED_LANGUAGES, type Settings } from '@lovelacer/shared'
import type { SettingsStore } from '../storage/settings-store.js'

export interface SettingsRouteOptions {
  settings: SettingsStore
}

const SectionsSchema = z.object({
  welcome: z.boolean(),
  quickStats: z.boolean(),
  people: z.boolean(),
  roomsByFloor: z.boolean(),
  activeRooms: z.boolean(),
  scenes: z.boolean(),
  cameras: z.boolean(),
})

const PutBodySchema = z.object({
  settings: z.object({
    language: z.enum(SUPPORTED_LANGUAGES),
    cardPack: z.enum(SUPPORTED_CARD_PACKS),
    sections: SectionsSchema,
  }),
})

/**
 * GET  /api/settings — returns `{ settings: Settings }`. DEFAULT_SETTINGS
 *                      when no row exists.
 * PUT  /api/settings — body `{ settings: Settings }`, full replace.
 *                      Returns the persisted state.
 *
 * Errors:
 *   - 400 invalid_body — body fails Zod schema.
 *   - 500 storage_error — better-sqlite3 threw on save.
 */
export const settingsRoute: FastifyPluginAsync<SettingsRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.get('/api/settings', async () => {
    return { settings: opts.settings.get() }
  })

  app.put('/api/settings', async (req, reply) => {
    const parsed = PutBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      })
    }
    try {
      const next: Settings = parsed.data.settings
      opts.settings.save(next)
      return reply.code(200).send({ settings: opts.settings.get() })
    } catch (err) {
      req.log.error({ err }, 'settings storage failed')
      return reply.code(500).send({ error: 'storage_error', message: String(err) })
    }
  })
}
