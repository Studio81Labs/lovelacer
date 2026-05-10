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

  it('keeps the direct backend debug port disabled by default and token-protected', () => {
    const config = parse(readFileSync(resolve('apps/addon/config.yaml'), 'utf8')) as Record<
      string,
      unknown
    >

    expect(config.ports).toMatchObject({ '3001/tcp': null })
    expect(config.options).toMatchObject({ debug_backend_token: '' })
    expect(config.schema).toMatchObject({ debug_backend_token: 'password?' })
  })

  it('starts the server against Supervisor Core proxy endpoints', () => {
    const runScript = readFileSync(resolve('apps/addon/run.sh'), 'utf8')

    expect(runScript).toContain('export HA_URL="http://supervisor/core/api"')
    expect(runScript).toContain('export HA_WEBSOCKET_URL="ws://supervisor/core/websocket"')
    expect(runScript).toContain('export DEBUG_BACKEND_TOKEN=')
    expect(runScript).toContain('exec node --expose-gc dist/main.js')
  })
})
