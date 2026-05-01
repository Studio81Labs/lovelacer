import { describe, it, expect, vi } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import { HaApplyError, type ApplyDashboardResult } from '@lovelacer/ha-client'
import type { LovelaceConfig } from '@lovelacer/generator'
import type {
  HaAreaRegistryEntry,
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  HaFloorRegistryEntry,
} from '@lovelacer/shared'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import { runAnalyze, runApply, runPreview } from '../pipeline.js'
import { OverrideStore } from '../storage/override-store.js'

interface FakeHa {
  client: HaClient
  applyDashboard: ReturnType<typeof vi.fn>
  getEntityRegistry: ReturnType<typeof vi.fn>
  getDeviceRegistry: ReturnType<typeof vi.fn>
  getAreaRegistry: ReturnType<typeof vi.fn>
}

function makeFakeHa(): FakeHa {
  const ha = fixtureToHaRegistries(englishCluttered)
  const applyDashboard = vi.fn<[LovelaceConfig, unknown?], Promise<ApplyDashboardResult>>()
  const getEntityRegistry = vi.fn<[], Promise<HaEntityRegistryEntry[]>>(async () => ha.entities)
  const getDeviceRegistry = vi.fn<[], Promise<HaDeviceRegistryEntry[]>>(async () => ha.devices)
  const getAreaRegistry = vi.fn<[], Promise<HaAreaRegistryEntry[]>>(async () => ha.areas)
  const getFloorRegistry = vi.fn<[], Promise<HaFloorRegistryEntry[]>>(async () => [])

  const client = {
    isConnected: () => true,
    getEntityRegistry,
    getDeviceRegistry,
    getAreaRegistry,
    getFloorRegistry,
    applyDashboard,
  } as unknown as HaClient

  return { client, applyDashboard, getEntityRegistry, getDeviceRegistry, getAreaRegistry }
}

function makeStore(): OverrideStore {
  return new OverrideStore(':memory:')
}

describe('runAnalyze', () => {
  it('returns rooms, misc, summary with consistent counts', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(fake.client, makeStore())

    expect(result.summary.entityCount).toBeGreaterThan(0)
    expect(result.summary.roomCount).toBe(result.rooms.length)
    expect(result.summary.miscCount).toBe(result.misc.length)
    expect(fake.getEntityRegistry).toHaveBeenCalledOnce()
    expect(fake.getDeviceRegistry).toHaveBeenCalledOnce()
    expect(fake.getAreaRegistry).toHaveBeenCalledOnce()
  })

  it('rooms are sorted alphabetically by displayName', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(fake.client, makeStore())
    const names = result.rooms.map((r) => r.displayName)
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en'))
    expect(names).toEqual(sorted)
  })

  it('rooms array does not contain the misc room', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(fake.client, makeStore())
    expect(result.rooms.every((r) => r.id !== 'misc')).toBe(true)
  })
})

describe('runPreview', () => {
  it('returns analyze output plus a config', async () => {
    const fake = makeFakeHa()
    const result = await runPreview(fake.client, makeStore())

    expect(result.summary.entityCount).toBeGreaterThan(0)
    expect(result.config.title).toBe('Lovelacer — Home')
    expect(result.config.views.length).toBeGreaterThan(0)
    expect(result.config.views[0]!.path).toBe('home')
  })

  it('rooms in config.views (after home) match alphabetical order', async () => {
    const fake = makeFakeHa()
    const result = await runPreview(fake.client, makeStore())
    const titles = result.config.views.slice(1).map((v) => v.title)
    const sorted = [...titles].sort((a, b) => a.localeCompare(b, 'en'))
    expect(titles).toEqual(sorted)
  })
})

describe('runApply', () => {
  it('with body.config: applies that config and skips registry calls', async () => {
    const fake = makeFakeHa()
    const config: LovelaceConfig = {
      title: 'custom',
      views: [
        {
          type: 'sections',
          title: 'Home',
          path: 'home',
          icon: 'mdi:home-variant',
          sections: [],
        },
      ],
    }
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'lovelacer-home', created: true })

    const result = await runApply(fake.client, makeStore(), { config })

    expect(fake.applyDashboard).toHaveBeenCalledWith(config, {})
    expect(fake.getEntityRegistry).not.toHaveBeenCalled()
    expect(result).toEqual({ urlPath: 'lovelacer-home', created: true })
  })

  it('without body.config: re-runs preview and applies its config', async () => {
    const fake = makeFakeHa()
    fake.applyDashboard.mockResolvedValueOnce({
      urlPath: 'lovelacer-home',
      created: false,
    })

    const result = await runApply(fake.client, makeStore(), {})

    expect(fake.getEntityRegistry).toHaveBeenCalled()
    expect(fake.applyDashboard).toHaveBeenCalledOnce()
    const passedConfig = fake.applyDashboard.mock.calls[0]![0]
    expect(passedConfig.title).toBe('Lovelacer — Home')
    expect(passedConfig.views[0]!.path).toBe('home')
    expect(result.urlPath).toBe('lovelacer-home')
  })

  it('forwards options to applyDashboard', async () => {
    const fake = makeFakeHa()
    const config: LovelaceConfig = {
      title: 'x',
      views: [
        {
          type: 'sections',
          title: 'Home',
          path: 'home',
          icon: 'mdi:home-variant',
          sections: [],
        },
      ],
    }
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'foo', created: true })

    await runApply(fake.client, makeStore(), {
      config,
      options: { urlPath: 'foo', title: 'Foo' },
    })

    expect(fake.applyDashboard).toHaveBeenCalledWith(config, {
      urlPath: 'foo',
      title: 'Foo',
    })
  })

  it('propagates HaApplyError unchanged', async () => {
    const fake = makeFakeHa()
    const err = new HaApplyError('save', 'oops', new Error('boom'))
    fake.applyDashboard.mockRejectedValueOnce(err)

    await expect(
      runApply(fake.client, makeStore(), {
        config: {
          title: 'x',
          views: [
            {
              type: 'sections',
              title: 'Home',
              path: 'home',
              icon: 'mdi:home-variant',
              sections: [],
            },
          ],
        },
      }),
    ).rejects.toBe(err)
  })

  it('rejects malformed body.config (title not string)', async () => {
    const fake = makeFakeHa()
    const bad = { title: 123, views: [] } as unknown as LovelaceConfig
    await expect(runApply(fake.client, makeStore(), { config: bad })).rejects.toThrow(
      /invalid_config/,
    )
    expect(fake.applyDashboard).not.toHaveBeenCalled()
  })

  it('rejects malformed body.config (views not array)', async () => {
    const fake = makeFakeHa()
    const bad = { title: 'x', views: {} } as unknown as LovelaceConfig
    await expect(runApply(fake.client, makeStore(), { config: bad })).rejects.toThrow(
      /invalid_config/,
    )
  })

  it('forwards defaultOptions to applyDashboard when body has no options', async () => {
    const fake = makeFakeHa()
    const config: LovelaceConfig = {
      title: 'x',
      views: [
        {
          type: 'sections',
          title: 'Home',
          path: 'home',
          icon: 'mdi:home-variant',
          sections: [],
        },
      ],
    }
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'foo', created: true })

    await runApply(fake.client, makeStore(), { config }, { urlPath: 'foo' })

    expect(fake.applyDashboard).toHaveBeenCalledWith(config, { urlPath: 'foo' })
  })

  it('body.options overrides defaultOptions', async () => {
    const fake = makeFakeHa()
    const config: LovelaceConfig = {
      title: 'x',
      views: [
        {
          type: 'sections',
          title: 'Home',
          path: 'home',
          icon: 'mdi:home-variant',
          sections: [],
        },
      ],
    }
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'bar', created: true })

    await runApply(
      fake.client,
      makeStore(),
      { config, options: { urlPath: 'bar' } },
      { urlPath: 'foo' },
    )

    expect(fake.applyDashboard).toHaveBeenCalledWith(config, { urlPath: 'bar' })
  })
})

describe('runAnalyze with overrides', () => {
  it('roomId override moves an entity from its detected room to the override room', async () => {
    const fake = makeFakeHa()
    const store = makeStore()

    // Baseline run — record where the entity lands without any overrides.
    const baseline = await runAnalyze(fake.client, store)
    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId, 'fixture must have at least one entity routed to kitchen').not.toBeNull()

    // Set an override moving the entity to living_room.
    store.replaceAll([{ entityId: targetEntityId!, roomId: 'living_room' }])

    const overridden = await runAnalyze(fake.client, store)
    const livingRoom = overridden.rooms.find((r) => r.id === 'living_room')
    expect(livingRoom, 'living_room must exist in overridden output').toBeDefined()
    const movedAssignment = livingRoom!.assignments.find((a) => a.entityId === targetEntityId)
    expect(movedAssignment).toBeDefined()
    expect(movedAssignment!.confidence).toBe(1.0)
    expect(movedAssignment!.manual).toBe(true)

    // Original kitchen room (and all other non-living_room rooms) no longer
    // contains it. Unconditional check — covers the case where kitchen
    // disappeared from rooms entirely.
    const stillInOldRoom = overridden.rooms.some(
      (r) => r.id !== 'living_room' && r.assignments.some((a) => a.entityId === targetEntityId),
    )
    expect(stillInOldRoom).toBe(false)
  })

  it('hidden override drops an entity from the analyze output', async () => {
    const fake = makeFakeHa()
    const store = makeStore()

    const baseline = await runAnalyze(fake.client, store)
    const baselineEntityCount = baseline.summary.entityCount

    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId).not.toBeNull()

    // Anchor: the target entity is present in the baseline output. Without
    // this, a fixture change that causes pickEntityIn to return an entity
    // the pipeline drops for unrelated reasons would silently produce a
    // false-positive pass.
    const wasInBaseline = baseline.rooms.some((r) =>
      r.assignments.some((a) => a.entityId === targetEntityId),
    )
    expect(wasInBaseline).toBe(true)

    store.replaceAll([{ entityId: targetEntityId!, hidden: true }])

    const filtered = await runAnalyze(fake.client, store)
    expect(filtered.summary.entityCount).toBe(baselineEntityCount - 1)

    // The entity is in NO room and NOT in misc.
    const inAnyRoom = filtered.rooms.some((r) =>
      r.assignments.some((a) => a.entityId === targetEntityId),
    )
    expect(inAnyRoom).toBe(false)
    expect(filtered.misc.find((m) => m.entityId === targetEntityId)).toBeUndefined()
  })

  it('combined override applies both room move and hide simultaneously', async () => {
    const fake = makeFakeHa()
    const store = makeStore()

    const baseline = await runAnalyze(fake.client, store)
    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId).not.toBeNull()

    store.replaceAll([{ entityId: targetEntityId!, roomId: 'living_room', hidden: true }])

    const result = await runAnalyze(fake.client, store)
    // Hidden takes precedence over room move at the visibility level.
    const inAnyRoom = result.rooms.some((r) =>
      r.assignments.some((a) => a.entityId === targetEntityId),
    )
    expect(inAnyRoom).toBe(false)
    expect(result.misc.find((m) => m.entityId === targetEntityId)).toBeUndefined()
  })

  it('orphaned override (entityId not in registry) silently no-ops', async () => {
    const fake = makeFakeHa()
    const store = makeStore()

    // Capture baseline before applying the orphan override.
    const baseline = await runAnalyze(fake.client, store)

    // Now load the orphan override.
    store.replaceAll([{ entityId: 'light.does_not_exist', roomId: 'bedroom' }])

    const result = await runAnalyze(fake.client, store)
    // Identical entity count — the orphan didn't add a phantom entity nor
    // corrupt the existing count.
    expect(result.summary.entityCount).toBe(baseline.summary.entityCount)
    expect(result.summary.roomCount).toBe(baseline.summary.roomCount)
    expect(result.misc.length).toBe(baseline.misc.length)
  })
})

describe('runPreview with overrides', () => {
  it('roomId override is reflected in the generated config views', async () => {
    const fake = makeFakeHa()
    const store = makeStore()

    const baseline = await runPreview(fake.client, store)
    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId).not.toBeNull()

    store.replaceAll([{ entityId: targetEntityId!, roomId: 'living_room' }])

    const overridden = await runPreview(fake.client, store)
    const livingRoomView = overridden.config.views.find((v) => v.path === 'living_room')
    expect(livingRoomView).toBeDefined()
    // The entityId should appear somewhere in the living_room view's cards.
    const json = JSON.stringify(livingRoomView)
    expect(json).toContain(targetEntityId)
  })
})

/**
 * Helper: pick the first entityId in the analyze result that's bound to
 * the given canonical room, or null if none exists.
 */
function pickEntityIn(
  result: { rooms: { id: string; assignments: { entityId: string }[] }[] },
  canonical: string,
): string | null {
  const room = result.rooms.find((r) => r.id === canonical)
  if (room === undefined || room.assignments.length === 0) return null
  return room.assignments[0]!.entityId
}
