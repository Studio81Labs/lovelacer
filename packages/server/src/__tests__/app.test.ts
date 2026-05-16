import { Writable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pino } from 'pino'
import type { HaClient } from '@lovelacer/ha-client'
import { createApp } from '../app.js'
import { AppliedSnapshotStore } from '../storage/applied-snapshot-store.js'
import { DismissedSuggestionStore } from '../storage/dismissed-suggestion-store.js'
import { InviteStore } from '../storage/invite-store.js'
import { OnboardingStore } from '../storage/onboarding-store.js'
import { OverrideStore } from '../storage/override-store.js'
import { SettingsStore } from '../storage/settings-store.js'

const stores: Array<{ close: () => void }> = []

afterEach(() => {
  while (stores.length > 0) {
    stores.pop()?.close()
  }
})

function trackStore<T extends { close: () => void }>(store: T): T {
  stores.push(store)
  return store
}

function makeInvite(): InviteStore {
  const invite = trackStore(new InviteStore(':memory:'))
  invite.accept('BETA-2026-ALPHA')
  return invite
}

function makeHa(): HaClient {
  return {
    isConnected: () => true,
    getEntityRegistry: vi.fn(async () => []),
    getDeviceRegistry: vi.fn(async () => []),
    getAreaRegistry: vi.fn(async () => []),
    getFloorRegistry: vi.fn(async () => []),
  } as unknown as HaClient
}

function makeLogCapture() {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk))
      callback()
    },
  })

  return {
    logger: pino({ level: 'info' }, stream),
    output: () => chunks.join(''),
  }
}

async function makeApp(logger: ReturnType<typeof pino>) {
  return createApp({
    ha: makeHa(),
    overrides: trackStore(new OverrideStore(':memory:')),
    invite: makeInvite(),
    appliedSnapshot: trackStore(new AppliedSnapshotStore(':memory:')),
    dismissedSuggestions: trackStore(new DismissedSuggestionStore(':memory:')),
    settings: trackStore(new SettingsStore(':memory:')),
    onboarding: trackStore(new OnboardingStore(':memory:')),
    logger,
    isDev: true,
    dashboardUrlPath: 'lovelacer-home',
  })
}

describe('dev-noise routes', () => {
  it('keeps socket.io websocket probes from flooding request logs', async () => {
    const logs = makeLogCapture()
    const app = await makeApp(logs.logger)

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/socket.io/?EIO=4&transport=websocket',
      })

      expect(res.statusCode).toBe(404)
      expect(logs.output()).not.toContain('/socket.io/')
      expect(logs.output()).not.toContain('Route GET:/socket.io/')
    } finally {
      await app.close()
    }
  })
})
