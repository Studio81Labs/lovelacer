import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

const readText = (path: string): string => readFileSync(resolve(path), 'utf8')

const addonConfig = parse(readText('apps/addon/config.yaml')) as { version: string }
const addonVersion = addonConfig.version
const runScript = readText('apps/addon/run.sh')

const expectedHttpProxy = 'http://supervisor/core/api'
const expectedWebsocketProxy = 'ws://supervisor/core/websocket'

describe('add-on release documentation', () => {
  it('keeps the README add-on badge aligned with add-on metadata', () => {
    const readme = readText('README.md')

    expect(readme).toContain(`https://img.shields.io/badge/add--on-${addonVersion}-amber`)
  })

  it('documents the current add-on release phase and Supervisor proxy wiring', () => {
    const installDocs = readText('docs/ADDON_INSTALL.md')

    expect(runScript).toContain(`export HA_URL="${expectedHttpProxy}"`)
    expect(runScript).toContain(`export HA_WEBSOCKET_URL="${expectedWebsocketProxy}"`)
    expect(installDocs).toContain('Phase 2 alpha')
    expect(installDocs).toContain(expectedHttpProxy)
    expect(installDocs).toContain(expectedWebsocketProxy)
    expect(installDocs).toContain('SUPERVISOR_TOKEN')
    expect(installDocs).not.toContain('Phase 1a alpha')
    expect(installDocs).not.toContain('ws://homeassistant:8123/api/websocket')
  })

  it('keeps architecture auth text aligned with runtime endpoints', () => {
    const architecture = readText('docs/ARCHITECTURE.md')

    expect(architecture).toContain(expectedHttpProxy)
    expect(architecture).toContain(expectedWebsocketProxy)
    expect(architecture).not.toContain('http://supervisor/core/websocket')
  })

  it('documents config, changelog, and tag expectations before pre-release promotion', () => {
    const checklist = readText('docs/RELEASE_CHECKLIST.md')

    expect(checklist).toContain('Before cutting the pre-release tag')
    expect(checklist).toContain('apps/addon/config.yaml')
    expect(checklist).toContain('apps/addon/CHANGELOG.md')
    expect(checklist).toContain('git tag')
    expect(checklist).toContain('vX.Y.Z')
  })
})
