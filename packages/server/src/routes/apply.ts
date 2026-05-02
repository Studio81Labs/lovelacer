import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import { HaApplyError } from '@lovelacer/ha-client'
import type { AppliedSnapshotStore } from '../storage/applied-snapshot-store.js'
import type { OverrideStore } from '../storage/override-store.js'
import { InvalidConfigError, runApply, type ApplyInput } from '../pipeline.js'

/**
 * Wire shape of the 200 response. Snake_case fields (`snapshot_skipped`,
 * `snapshot_persisted`) are intentional — they're flags the route emits
 * and the frontend mirrors verbatim. Existing fields (`urlPath`,
 * `created`) come from `ApplyDashboardResult` and stay camelCase to
 * preserve backward compatibility.
 */
interface ApplySuccessResponse {
  ok: true
  urlPath: string
  created: boolean
  snapshot_skipped?: 'invalid'
  snapshot_persisted?: false
}

export interface ApplyRouteOptions {
  ha: HaClient
  overrides: OverrideStore
  appliedSnapshot: AppliedSnapshotStore
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
      const result = await runApply(opts.ha, opts.overrides, opts.appliedSnapshot, body, {
        urlPath: opts.dashboardUrlPath,
      })
      if (result.snapshotPersisted === false) {
        req.log.error(
          { err: result.snapshotError, urlPath: result.urlPath },
          'snapshot persistence failed after successful apply',
        )
      }
      const responseBody: ApplySuccessResponse = {
        ok: true,
        urlPath: result.urlPath,
        created: result.created,
      }
      if (result.snapshotSkipped !== undefined)
        responseBody.snapshot_skipped = result.snapshotSkipped
      if (result.snapshotPersisted === false) responseBody.snapshot_persisted = false
      return reply.code(200).send(responseBody)
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
