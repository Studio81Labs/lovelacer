import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  SUPPORTED_CARD_PACKS,
  SUPPORTED_LANGUAGES,
  SUPPORTED_UI_LANGUAGES,
  type Settings,
} from '@lovelacer/shared'
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

const RoomOverrideSchema = z.object({
  name: z.string().optional(),
  icon: z.string().optional(),
  showNameOnCard: z.boolean().optional(),
  hiddenFromDashboard: z.boolean().optional(),
})

const PutBodySchema = z.object({
  settings: z.object({
    language: z.enum(SUPPORTED_LANGUAGES),
    cardPack: z.enum(SUPPORTED_CARD_PACKS),
    sections: SectionsSchema,
    uiLanguage: z.enum(SUPPORTED_UI_LANGUAGES).optional(),
    roomOrder: z.array(z.string()).optional(),
    roomOverrides: z.record(z.string().min(1), RoomOverrideSchema).optional(),
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
      // Zod's `.optional()` produces `T | undefined`, but our `Settings`
      // type uses `?:` under `exactOptionalPropertyTypes: true`, which
      // forbids the field from being present-with-value-undefined.
      // Conditionally include `uiLanguage` only when the body actually
      // carried a value so the persisted shape matches the type contract.
      const data = parsed.data.settings
      const next: Settings = {
        language: data.language,
        cardPack: data.cardPack,
        sections: data.sections,
        ...(data.uiLanguage !== undefined && { uiLanguage: data.uiLanguage }),
        ...(data.roomOrder !== undefined && { roomOrder: data.roomOrder }),
        ...(data.roomOverrides !== undefined && {
          roomOverrides: normalizeRoomOverrides(data.roomOverrides),
        }),
      }
      opts.settings.save(next)
      return reply.code(200).send({ settings: opts.settings.get() })
    } catch (err) {
      req.log.error({ err }, 'settings storage failed')
      return reply.code(500).send({ error: 'storage_error', message: String(err) })
    }
  })
}

function normalizeRoomOverrides(
  roomOverrides: z.infer<typeof PutBodySchema>['settings']['roomOverrides'],
): NonNullable<Settings['roomOverrides']> {
  if (roomOverrides === undefined) return {}
  return Object.fromEntries(
    Object.entries(roomOverrides).map(([roomId, override]) => [
      roomId,
      {
        ...(override.name !== undefined && { name: override.name }),
        ...(override.icon !== undefined && { icon: override.icon }),
        ...(override.showNameOnCard !== undefined && {
          showNameOnCard: override.showNameOnCard,
        }),
        ...(override.hiddenFromDashboard !== undefined && {
          hiddenFromDashboard: override.hiddenFromDashboard,
        }),
      },
    ]),
  )
}
