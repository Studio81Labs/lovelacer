import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import { HaApplyError } from '@lovelacer/ha-client'
import { InvalidConfigError, runApply, type ApplyInput } from '../pipeline.js'

export interface ApplyRouteOptions {
  ha: HaClient
  /** Default url_path for the generated dashboard. Body.options.urlPath wins when present. */
  dashboardUrlPath: string
}

/**
 * POST /api/apply — pushes a Lovelace dashboard to HA via storage-mode WS.
 *
 * Hybrid mode: accepts an optional `config` body. If present, that config
 * is pushed directly. If absent, the server re-runs preview internally
 * and pushes its config. The route's `dashboardUrlPath` option provides
 * a server-config default that the request body can override.
 *
 * Errors:
 * - 400 invalid_config: body.config provided but malformed (non-string
 *   title or non-array views)
 * - 502 ha_apply_failed: HaApplyError thrown by applyDashboard
 *   (response includes `step: 'list' | 'create' | 'save'`)
 * - 503 ha_unavailable: HaClient not connected
 * - 500: anything else
 */
export const applyRoute: FastifyPluginAsync<ApplyRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post<{ Body: ApplyInput }>('/api/apply', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      const body = (req.body ?? {}) as ApplyInput
      const result = await runApply(opts.ha, body, { urlPath: opts.dashboardUrlPath })
      return reply.code(200).send({ ok: true, ...result })
    } catch (err) {
      if (err instanceof HaApplyError) {
        req.log.error({ err, step: err.step }, 'ha apply failed')
        return reply.code(502).send({
          error: 'ha_apply_failed',
          step: err.step,
          message: err.message,
        })
      }
      if (err instanceof InvalidConfigError) {
        return reply.code(400).send({
          error: 'invalid_config',
          message: err.message,
        })
      }
      req.log.error({ err }, 'apply failed')
      return reply.code(500).send({ error: 'apply_failed', message: String(err) })
    }
  })
}
