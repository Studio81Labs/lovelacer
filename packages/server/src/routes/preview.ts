import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import type { OverrideStore } from '../storage/override-store.js'
import { runPreview } from '../pipeline.js'

export interface PreviewRouteOptions {
  ha: HaClient
  overrides: OverrideStore
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
      const result = await runPreview(opts.ha, opts.overrides)
      return reply.code(200).send(result)
    } catch (err) {
      req.log.error({ err }, 'preview failed')
      return reply.code(500).send({ error: 'preview_failed', message: String(err) })
    }
  })
}
