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
    const publishedInstallDocs = readText('apps/docs/src/docs/install/supervised.md')

    expect(runScript).toContain(`export HA_URL="${expectedHttpProxy}"`)
    expect(runScript).toContain(`export HA_WEBSOCKET_URL="${expectedWebsocketProxy}"`)

    for (const doc of [installDocs, publishedInstallDocs]) {
      expect(doc).toContain('Public v1.0.0 release')
      expect(doc).toContain(expectedHttpProxy)
      expect(doc).toContain(expectedWebsocketProxy)
      expect(doc).toContain('SUPERVISOR_TOKEN')
      expect(doc).toContain('homeassistant_api: true')
      expect(doc).not.toContain('Phase 1a alpha')
      expect(doc).not.toContain('ws://homeassistant:8123/api/websocket')
    }
  })

  it('keeps architecture auth text aligned with runtime endpoints', () => {
    const architecture = readText('docs/ARCHITECTURE.md')
    const publishedArchitecture = readText('apps/docs/src/docs/architecture.md')

    for (const doc of [architecture, publishedArchitecture]) {
      expect(doc).toContain(expectedHttpProxy)
      expect(doc).toContain(expectedWebsocketProxy)
      expect(doc).not.toContain('http://supervisor/core/websocket')
    }
  })

  it('documents config, changelog, and tag expectations before pre-release promotion', () => {
    const checklist = readText('docs/RELEASE_CHECKLIST.md')

    expect(checklist).toContain('Before cutting the pre-release tag')
    expect(checklist).toContain('apps/addon/config.yaml')
    expect(checklist).toContain('apps/addon/CHANGELOG.md')
    expect(checklist).toContain('git tag')
    expect(checklist).toContain('vX.Y.Z')
  })

  it('keeps release smoke docs honest about Core dev stack versus Supervisor-only checks', () => {
    const checklist = readText('docs/RELEASE_CHECKLIST.md')
    const issueTemplate = readText('.github/ISSUE_TEMPLATE/release-smoke-test.md')

    expect(checklist).toContain('HA Core stack, not a Supervisor install')
    expect(checklist).toMatch(
      /Supervisor-specific\s+add-on install, ingress, and sidebar checks are real-install checks/,
    )
    expect(checklist).not.toContain(
      'Dev HA: `pnpm dev:ha` brings HA up; add-on installs from the local repo.',
    )

    expect(issueTemplate).toContain('Dev HA Core stack')
    expect(issueTemplate).toContain('Real HA Supervisor add-on install')
    expect(issueTemplate).toContain('Supervisor add-on install, ingress, sidebar icon')
    expect(issueTemplate).not.toContain('| Install/startup/ingress/sidebar icon | [ ] | [ ] |')
  })
})
