import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import type { AppliedSnapshotStore } from '../storage/applied-snapshot-store.js'
import type { DismissedSuggestionStore } from '../storage/dismissed-suggestion-store.js'
import type { OverrideStore } from '../storage/override-store.js'
import type { SettingsStore } from '../storage/settings-store.js'
import { runPreview } from '../pipeline.js'
import { performance } from 'node:perf_hooks'
import { setImmediate as yieldToEventLoop } from 'node:timers/promises'

export interface PreviewRouteOptions {
  ha: HaClient
  overrides: OverrideStore
  appliedSnapshot: AppliedSnapshotStore
  dismissedSuggestions: DismissedSuggestionStore
  settings: SettingsStore
}

/**
 * POST /api/preview — runs analyze + builds the LovelaceConfig. Returns
 * rooms, misc, summary, plus the generated config. Frontend can show
 * a preview before applying.
 *
 * Errors:
 * - 503 ha_unavailable: HaClient not connected
 * - 500 preview_failed: pipeline threw
 */
export const previewRoute: FastifyPluginAsync<PreviewRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post('/api/preview', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      req.log.info('preview request accepted')
      const result = await runPreview(
        opts.ha,
        opts.overrides,
        opts.appliedSnapshot,
        opts.dismissedSuggestions,
        opts.settings,
        { logger: req.log },
      )
      req.log.info(
        {
          entities: result.summary.entityCount,
          rooms: result.rooms.length,
          misc: result.misc.length,
          views: result.config.views.length,
          suggestions: result.suggestions.length,
        },
        'preview request ready to send response',
      )
      const serializeStart = performance.now()
      req.log.info({ stage: 'preview_json_serialize' }, 'preview pipeline stage started')
      await yieldToEventLoop()
      const body = JSON.stringify(result)
      req.log.info(
        {
          stage: 'preview_json_serialize',
          durationMs: Math.round((performance.now() - serializeStart) * 10) / 10,
          bytes: Buffer.byteLength(body),
        },
        'preview pipeline stage completed',
      )
      return reply.code(200).type('application/json').send(body)
    } catch (err) {
      req.log.error({ err }, 'preview failed')
      return reply.code(500).send({ error: 'preview_failed', message: String(err) })
    }
  })
}
