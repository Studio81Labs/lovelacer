import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

describe('Home Assistant add-on auth proxy wiring', () => {
  it('requests Home Assistant Core API access without broad Supervisor API access', () => {
    const config = parse(readFileSync(resolve('apps/addon/config.yaml'), 'utf8')) as Record<
      string,
      unknown
    >

    expect(config.homeassistant_api).toBe(true)
    expect(config.hassio_api).toBe(false)
  })

  it('starts the server against Supervisor Core proxy endpoints', () => {
    const runScript = readFileSync(resolve('apps/addon/run.sh'), 'utf8')

    expect(runScript).toContain('export HA_URL="http://supervisor/core/api"')
    expect(runScript).toContain('export HA_WEBSOCKET_URL="ws://supervisor/core/websocket"')
  })
})
