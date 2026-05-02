import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import { configToYaml } from '@lovelacer/generator'
import type { OverrideStore } from '../storage/override-store.js'
import type { AppliedSnapshotStore } from '../storage/applied-snapshot-store.js'
import { runPreview } from '../pipeline.js'

export interface ExportRouteOptions {
  ha: HaClient
  overrides: OverrideStore
  appliedSnapshot: AppliedSnapshotStore
  /** Filename suggested via Content-Disposition. Matches dashboardUrlPath. */
  dashboardUrlPath: string
}

const SAFE_FILENAME = /^[a-zA-Z0-9_-]+$/

/**
 * GET /api/export.yaml — runs the preview pipeline, serializes the
 * resulting LovelaceConfig as YAML, and returns it as an attachment.
 *
 * Errors:
 * - 503 ha_unavailable: HaClient not connected
 * - 500 export_failed: pipeline or serialization threw
 */
export const exportRoute: FastifyPluginAsync<ExportRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.get('/api/export.yaml', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      const preview = await runPreview(opts.ha, opts.overrides, opts.appliedSnapshot)
      const yaml = configToYaml(preview.config)
      const safeStem = SAFE_FILENAME.test(opts.dashboardUrlPath)
        ? opts.dashboardUrlPath
        : 'lovelacer-home'
      // X-Content-Type-Options: nosniff prevents browsers from re-interpreting
      // the YAML body as HTML/JS if a future bug ever lets unsafe content slip
      // into the LovelaceConfig. Defense-in-depth — application/yaml is already
      // the IANA-registered type and fixture content is structured data, but
      // the header is free.
      return reply
        .code(200)
        .header('Content-Type', 'application/yaml; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${safeStem}.yaml"`)
        .header('X-Content-Type-Options', 'nosniff')
        .send(yaml)
    } catch (err) {
      req.log.error({ err }, 'export failed')
      return reply.code(500).send({ error: 'export_failed', message: String(err) })
    }
  })
}
