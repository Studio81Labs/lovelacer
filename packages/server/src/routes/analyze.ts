import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import type { OverrideStore } from '../storage/override-store.js'
import type { SettingsStore } from '../storage/settings-store.js'
import { runAnalyze } from '../pipeline.js'

export interface AnalyzeRouteOptions {
  ha: HaClient
  overrides: OverrideStore
  settings: SettingsStore
}

/**
 * POST /api/analyze — pulls registries from HA, runs the full analyzer
 * pipeline (normalize → detect → applyOverrides → groupByDomain), and
 * returns a summary with rooms, misc bucket, and counts.
 *
 * Errors:
 * - 503 ha_unavailable: HaClient not connected
 * - 500 analyze_failed: registry fetch or analysis threw
 */
export const analyzeRoute: FastifyPluginAsync<AnalyzeRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post('/api/analyze', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      const result = await runAnalyze(opts.ha, opts.overrides, opts.settings)
      return reply.code(200).send(result)
    } catch (err) {
      req.log.error({ err }, 'analyze failed')
      return reply.code(500).send({ error: 'analyze_failed', message: String(err) })
    }
  })
}
