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

  // HA connection — Add-on context uses SUPERVISOR_TOKEN, standalone uses HA_TOKEN
  HA_URL: z.string().url().default('http://supervisor/core'),
  HA_TOKEN: z.string().optional(),
  SUPERVISOR_TOKEN: z.string().optional(),
})

const parsed = ConfigSchema.parse(process.env)

const haToken = parsed.SUPERVISOR_TOKEN ?? parsed.HA_TOKEN
if (!haToken) {
  throw new Error(
    'No HA token configured. Set HA_TOKEN (standalone) or SUPERVISOR_TOKEN (Add-on context).',
  )
}

export const config = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  dataDir: parsed.DATA_DIR,
  ha: {
    url: parsed.HA_URL,
    token: haToken,
  },
} as const
