import { config as loadDotenv } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

// Load .env from the repo root (4 levels up from this compiled file:
// packages/server/dist/config.js → /).
// Falls back gracefully if the file doesn't exist (e.g., Add-on context where
// config comes from SUPERVISOR_TOKEN injection, not .env).
const here = fileURLToPath(import.meta.url)
loadDotenv({ path: resolve(here, '../../../../.env') })
loadDotenv() // also try cwd as a fallback

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  DATA_DIR: z.string().default('./data'),

  // HA connection — standalone uses HA_TOKEN against HA_URL. Add-on context
  // uses SUPERVISOR_TOKEN against the Supervisor Core API proxy.
  HA_URL: z.string().url().optional(),
  HA_WEBSOCKET_URL: z.string().url().optional(),
  HA_TOKEN: z.string().optional(),
  SUPERVISOR_TOKEN: z.string().optional(),

  // Add-on option exposed through HA's config UI. Lets the user customize
  // the generated dashboard's url_path without rebuilding the image.
  DASHBOARD_URL_PATH: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, {
      message: 'must be a valid HA URL path slug (lowercase alphanumeric + hyphen)',
    })
    .default('lovelacer-home'),

  // Absolute path to the built SPA's static asset directory. Set in the
  // Add-on container so Fastify serves index.html + assets at /. Leave
  // unset in dev — Vite serves the SPA on :5173 with a proxy to :3000.
  WEB_DIST_DIR: z.string().optional(),

  // Set by the Home Assistant add-on wrapper from config.yaml. Used only
  // for health/startup diagnostics so we can confirm which image is running.
  ADDON_VERSION: z.string().optional(),
})

const parsed = ConfigSchema.parse(process.env)

// Use `||` rather than `??` so an empty-string SUPERVISOR_TOKEN (which Zod's
// `.optional()` admits) falls through to HA_TOKEN instead of shadowing it.
const supervisorToken = parsed.SUPERVISOR_TOKEN || undefined
const haToken = supervisorToken || parsed.HA_TOKEN
if (!haToken) {
  throw new Error(
    'No HA token configured. Set HA_TOKEN (standalone) or SUPERVISOR_TOKEN (Add-on context).',
  )
}

const haUrl =
  parsed.HA_URL ?? (supervisorToken ? 'http://supervisor/core/api' : 'http://homeassistant:8123')
const haWebsocketUrl =
  parsed.HA_WEBSOCKET_URL ?? (supervisorToken ? 'ws://supervisor/core/websocket' : undefined)

export const config = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  dataDir: parsed.DATA_DIR,
  ha: {
    url: haUrl,
    websocketUrl: haWebsocketUrl,
    token: haToken,
  },
  dashboardUrlPath: parsed.DASHBOARD_URL_PATH,
  webDistDir: parsed.WEB_DIST_DIR,
  addonVersion: parsed.ADDON_VERSION ?? 'dev',
} as const
