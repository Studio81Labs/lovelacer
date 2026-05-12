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
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import { runAnalyze, runApply, runPreview } from '../pipeline.js'
import { AppliedSnapshotStore } from '../storage/applied-snapshot-store.js'
import { DismissedSuggestionStore } from '../storage/dismissed-suggestion-store.js'
import { OverrideStore } from '../storage/override-store.js'
import { SettingsStore } from '../storage/settings-store.js'

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
  const getFloorRegistry = vi.fn<[], Promise<HaFloorRegistryEntry[]>>(async () => ha.floors)

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

function makeHa(connected = true): HaClient {
  const ha = fixtureToHaRegistries(englishCluttered)
  return {
    isConnected: () => connected,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => ha.floors),
  } as unknown as HaClient
}

function makeCzechHa(): HaClient {
  const ha = fixtureToHaRegistries(czechTidy)
  return {
    isConnected: () => true,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => ha.floors),
  } as unknown as HaClient
}

function makeStore(): OverrideStore {
  return new OverrideStore(':memory:')
}

function makeAppliedSnapshot(): AppliedSnapshotStore {
  return new AppliedSnapshotStore(':memory:')
}

function makeDismissed(): DismissedSuggestionStore {
  return new DismissedSuggestionStore(':memory:')
}

function makeSettings(): SettingsStore {
  return new SettingsStore(':memory:')
}

function makeSettingsWithRoomOrder(roomOrder: string[]): SettingsStore {
  const settings = makeSettings()
  settings.save({ ...settings.get(), roomOrder })
  return settings
}

function makeAdministrativeHa(): HaClient {
  const areas: HaAreaRegistryEntry[] = [
    { area_id: 'kitchen', name: 'Kitchen', floor_id: null, icon: null },
  ]
  const entities: HaEntityRegistryEntry[] = [
    {
      entity_id: 'sensor.kitchen_temperature',
      name: 'Kitchen Temperature',
      original_name: null,
      area_id: 'kitchen',
      device_id: null,
      platform: 'test',
      hidden_by: null,
      disabled_by: null,
      entity_category: null,
      device_class: 'temperature',
    },
    {
      entity_id: 'sensor.kitchen_voltage',
      name: 'Kitchen Voltage',
      original_name: null,
      area_id: 'kitchen',
      device_id: null,
      platform: 'test',
      hidden_by: null,
      disabled_by: null,
      entity_category: null,
      device_class: 'voltage',
    },
    {
      entity_id: 'sensor.kitchen_rssi',
      name: 'Kitchen RSSI',
      original_name: null,
      area_id: 'kitchen',
      device_id: null,
      platform: 'test',
      hidden_by: null,
      disabled_by: null,
      entity_category: null,
      device_class: null,
    },
  ]

  return {
    isConnected: () => true,
    getEntityRegistry: vi.fn(async () => entities),
    getDeviceRegistry: vi.fn(async () => []),
    getAreaRegistry: vi.fn(async () => areas),
    getFloorRegistry: vi.fn(async () => []),
  } as unknown as HaClient
}

function makePowerQuickStatsHa(): HaClient {
  const areas: HaAreaRegistryEntry[] = [
    { area_id: 'kitchen', name: 'Kitchen', floor_id: null, icon: null },
  ]
  const entities: HaEntityRegistryEntry[] = [
    {
      entity_id: 'weather.home',
      name: 'Home Weather',
      original_name: null,
      area_id: null,
      device_id: null,
      platform: 'test',
      hidden_by: null,
      disabled_by: null,
      entity_category: null,
    },
    {
      entity_id: 'sensor.house_power_now',
      name: 'House Power Now',
      original_name: null,
      area_id: 'kitchen',
      device_id: null,
      platform: 'test',
      hidden_by: null,
      disabled_by: null,
      entity_category: null,
      device_class: 'power',
    },
    {
      entity_id: 'sensor.outdoor_temperature',
      name: 'Outdoor Temperature',
      original_name: null,
      area_id: 'kitchen',
      device_id: null,
      platform: 'test',
      hidden_by: null,
      disabled_by: null,
      entity_category: 'diagnostic',
      device_class: 'temperature',
    },
    {
      entity_id: 'binary_sensor.home_presence',
      name: 'Home Presence',
      original_name: null,
      area_id: 'kitchen',
      device_id: null,
      platform: 'test',
      hidden_by: null,
      disabled_by: null,
      entity_category: 'diagnostic',
      device_class: 'presence',
    },
  ]

  return {
    isConnected: () => true,
    getEntityRegistry: vi.fn(async () => entities),
    getDeviceRegistry: vi.fn(async () => []),
    getAreaRegistry: vi.fn(async () => areas),
    getFloorRegistry: vi.fn(async () => []),
  } as unknown as HaClient
}

describe('runAnalyze', () => {
  it('returns rooms, misc, summary with consistent counts', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(fake.client, makeStore(), makeSettings())

    expect(result.summary.entityCount).toBeGreaterThan(0)
    expect(result.summary.roomCount).toBe(result.rooms.length)
    expect(result.summary.miscCount).toBe(result.misc.length)
    expect(fake.getEntityRegistry).toHaveBeenCalledOnce()
    expect(fake.getDeviceRegistry).toHaveBeenCalledOnce()
    expect(fake.getAreaRegistry).toHaveBeenCalledOnce()
  })

  it('rooms are sorted alphabetically by displayName', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(fake.client, makeStore(), makeSettings())
    const names = result.rooms.map((r) => r.displayName)
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en'))
    expect(names).toEqual(sorted)
  })

  it('places rooms from settings.roomOrder before the default alphabetical tail', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(
      fake.client,
      makeStore(),
      makeSettingsWithRoomOrder(['living_room', 'kitchen']),
    )
    const ids = result.rooms.map((r) => r.id)

    expect(ids.indexOf('living_room')).toBeLessThan(ids.indexOf('kitchen'))
  })

  it('rooms array does not contain the misc room', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(fake.client, makeStore(), makeSettings())
    expect(result.rooms.every((r) => r.id !== 'misc')).toBe(true)
  })

  it('excludes config and diagnostic entities from room and misc output', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(fake.client, makeStore(), makeSettings())
    const fixture = fixtureToHaRegistries(englishCluttered)
    const entityById = new Map(fixture.entities.map((entity) => [entity.entity_id, entity]))

    for (const room of result.rooms) {
      for (const assignment of room.assignments) {
        expect(entityById.get(assignment.entityId)?.entity_category ?? null).toBeNull()
      }
    }
    for (const entity of result.misc) {
      expect(entityById.get(entity.entityId)?.entity_category ?? null).toBeNull()
    }
  })

  it('soft-hides administrative entities but keeps them available for reassignment', async () => {
    const result = (await runAnalyze(
      makeAdministrativeHa(),
      makeStore(),
      makeSettings(),
    )) as Awaited<ReturnType<typeof runAnalyze>> & {
      administrative?: { entityId: string; roomId?: string }[]
    }

    const kitchen = result.rooms.find((room) => room.id === 'kitchen')
    expect(kitchen?.assignments.map((assignment) => assignment.entityId)).toEqual([
      'sensor.kitchen_temperature',
    ])
    expect(result.misc.map((entity) => entity.entityId)).toEqual([])
    expect(result.administrative?.map((entity) => [entity.entityId, entity.roomId])).toEqual([
      ['sensor.kitchen_rssi', 'kitchen'],
      ['sensor.kitchen_voltage', 'kitchen'],
    ])
  })

  it('shows a soft-hidden administrative entity when a room override exists', async () => {
    const overrides = makeStore()
    overrides.replaceAll([{ entityId: 'sensor.kitchen_voltage', roomId: 'kitchen' }])

    const result = (await runAnalyze(makeAdministrativeHa(), overrides, makeSettings())) as Awaited<
      ReturnType<typeof runAnalyze>
    > & {
      administrative?: { entityId: string }[]
    }

    const kitchen = result.rooms.find((room) => room.id === 'kitchen')
    expect(kitchen?.assignments.map((assignment) => assignment.entityId)).toEqual([
      'sensor.kitchen_temperature',
      'sensor.kitchen_voltage',
    ])
    expect(result.administrative?.map((entity) => entity.entityId)).toEqual(['sensor.kitchen_rssi'])
  })

  it('keeps hard-hidden administrative entities out of the administrative recovery panel', async () => {
    const overrides = makeStore()
    overrides.replaceAll([{ entityId: 'sensor.kitchen_voltage', hidden: true }])

    const result = (await runAnalyze(makeAdministrativeHa(), overrides, makeSettings())) as Awaited<
      ReturnType<typeof runAnalyze>
    > & {
      administrative?: { entityId: string }[]
    }

    expect(result.hidden.map((entity) => entity.entityId)).toContain('sensor.kitchen_voltage')
    expect(result.administrative?.map((entity) => entity.entityId)).toEqual(['sensor.kitchen_rssi'])
  })
})

describe('runPreview', () => {
  it('keeps default generated room views sorted by English title when roomOrder is unset', async () => {
    const result = await runPreview(
      makeCzechHa(),
      makeStore(),
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
    )
    const roomTitles = result.config.views.slice(1).map((view) => view.title)

    expect(roomTitles).toEqual([...roomTitles].sort((a, b) => a.localeCompare(b, 'en')))
    expect(roomTitles.indexOf('Bedroom')).toBeLessThan(roomTitles.indexOf('Kitchen'))
  })

  it('orders generated room views by settings.roomOrder', async () => {
    const fake = makeFakeHa()
    const result = await runPreview(
      fake.client,
      makeStore(),
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettingsWithRoomOrder(['living_room', 'kitchen']),
    )
    const titles = result.config.views.map((view) => view.title)

    expect(titles.indexOf('Living Room')).toBeLessThan(titles.indexOf('Kitchen'))
  })

  it('trims unused HA registry fields and normalizes entities in place', async () => {
    const fake = makeFakeHa()
    const entities = await fake.getEntityRegistry()
    const devices = await fake.getDeviceRegistry()
    const entityWithExtraFields = entities[0]! as HaEntityRegistryEntry & Record<string, unknown>
    const deviceWithExtraFields = devices[0]! as HaDeviceRegistryEntry & Record<string, unknown>
    const originalEntityId = entityWithExtraFields.entity_id
    entityWithExtraFields.large_unused_payload = 'x'.repeat(1024)
    entityWithExtraFields.aliases = ['one', 'two']
    deviceWithExtraFields.large_unused_payload = 'x'.repeat(1024)
    deviceWithExtraFields.config_entries = ['abc']

    await runPreview(
      fake.client,
      makeStore(),
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
    )

    expect(entityWithExtraFields.large_unused_payload).toBeUndefined()
    expect(entityWithExtraFields.aliases).toBeUndefined()
    expect(entityWithExtraFields.entity_id).toBeUndefined()
    expect(entityWithExtraFields.entityId).toBe(originalEntityId)
    expect(deviceWithExtraFields.large_unused_payload).toBeUndefined()
    expect(deviceWithExtraFields.config_entries).toBeUndefined()
    expect(deviceWithExtraFields.name_by_user).toBeUndefined()
    expect(deviceWithExtraFields.nameByUser).toBeDefined()
  })

  it('returns analyze output plus a config', async () => {
    const fake = makeFakeHa()
    const result = await runPreview(
      fake.client,
      makeStore(),
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
    )

    expect(result.summary.entityCount).toBeGreaterThan(0)
    expect(result.config.title).toBe('Lovelacer — Home')
    expect(result.config.views.length).toBeGreaterThan(0)
    expect(result.config.views[0]!.path).toBe('home')
  })

  it('rooms in config.views (after home) match alphabetical order', async () => {
    const fake = makeFakeHa()
    const result = await runPreview(
      fake.client,
      makeStore(),
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
    )
    const titles = result.config.views.slice(1).map((v) => v.title)
    const sorted = [...titles].sort((a, b) => a.localeCompare(b, 'en'))
    expect(titles).toEqual(sorted)
  })

  it('calls getFloorRegistry and surfaces floor headings in the home view (via runPreview)', async () => {
    const ha = makeHa(true)
    const overrides = makeStore()
    const appliedSnapshot = makeAppliedSnapshot()
    const result = await runPreview(ha, overrides, appliedSnapshot, makeDismissed(), makeSettings())
    // The englishCluttered fixture has two floors. After Task 3 wires
    // assignFloors through, the home view should contain heading cards
    // whose text matches the fixture's floor names.
    const home = result.config.views[0]
    expect(home).not.toBeUndefined()
    expect(home!.path).toBe('home')
    const allCards = (home!.sections ?? []).flatMap((s) => s.cards ?? [])
    const headingTexts = allCards
      .filter((c): c is { type: 'heading'; heading: string } => c.type === 'heading')
      .map((c) => c.heading)
    expect(headingTexts.length).toBeGreaterThan(0)
  })

  it('runPreview does not throw when getFloorRegistry rejects (defensive catch)', async () => {
    const fixture = fixtureToHaRegistries(englishCluttered)
    const ha = {
      isConnected: () => true,
      getEntityRegistry: vi.fn(async () => fixture.entities),
      getDeviceRegistry: vi.fn(async () => fixture.devices),
      getAreaRegistry: vi.fn(async () => fixture.areas),
      getFloorRegistry: vi.fn(async () => {
        throw new Error('not supported on this HA version')
      }),
    } as unknown as HaClient
    const overrides = makeStore()
    const appliedSnapshot = makeAppliedSnapshot()
    // Should not throw — the catch in runFullPipeline downgrades the
    // rejection to an empty floor list.
    await expect(
      runPreview(ha, overrides, appliedSnapshot, makeDismissed(), makeSettings()),
    ).resolves.toBeDefined()
  })

  it('keeps soft-hidden power sensors available for home quick stats without exposing diagnostic candidates', async () => {
    const result = await runPreview(
      makePowerQuickStatsHa(),
      makeStore(),
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
    )

    const home = result.config.views[0]
    const quickStats = home?.sections
      ?.flatMap((section) => section.cards ?? [])
      .find((card): card is { type: 'glance'; title?: string; entities: string[] } => {
        return card.type === 'glance' && card.title === 'Quick stats'
      })

    expect(quickStats?.entities).toEqual(['weather.home', 'sensor.house_power_now'])
    expect(quickStats?.entities).not.toContain('sensor.outdoor_temperature')
    expect(quickStats?.entities).not.toContain('binary_sensor.home_presence')
    expect(result.rooms.flatMap((room) => room.assignments.map((a) => a.entityId))).not.toContain(
      'sensor.house_power_now',
    )
    expect(result.administrative?.map((entity) => entity.entityId)).toEqual([
      'binary_sensor.home_presence',
      'sensor.house_power_now',
      'sensor.outdoor_temperature',
    ])
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

    const result = await runApply(
      fake.client,
      makeStore(),
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
      { config },
    )

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

    const result = await runApply(
      fake.client,
      makeStore(),
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
      {},
    )

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

    await runApply(
      fake.client,
      makeStore(),
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
      {
        config,
        options: { urlPath: 'foo', title: 'Foo' },
      },
    )

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
      runApply(fake.client, makeStore(), makeAppliedSnapshot(), makeDismissed(), makeSettings(), {
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
    await expect(
      runApply(fake.client, makeStore(), makeAppliedSnapshot(), makeDismissed(), makeSettings(), {
        config: bad,
      }),
    ).rejects.toThrow(/invalid_config/)
    expect(fake.applyDashboard).not.toHaveBeenCalled()
  })

  it('rejects malformed body.config (views not array)', async () => {
    const fake = makeFakeHa()
    const bad = { title: 'x', views: {} } as unknown as LovelaceConfig
    await expect(
      runApply(fake.client, makeStore(), makeAppliedSnapshot(), makeDismissed(), makeSettings(), {
        config: bad,
      }),
    ).rejects.toThrow(/invalid_config/)
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

    await runApply(
      fake.client,
      makeStore(),
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
      { config },
      { urlPath: 'foo' },
    )

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
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
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
    const baseline = await runAnalyze(fake.client, store, makeSettings())
    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId, 'fixture must have at least one entity routed to kitchen').not.toBeNull()

    // Set an override moving the entity to living_room.
    store.replaceAll([{ entityId: targetEntityId!, roomId: 'living_room' }])

    const overridden = await runAnalyze(fake.client, store, makeSettings())
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

    const baseline = await runAnalyze(fake.client, store, makeSettings())
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

    const filtered = await runAnalyze(fake.client, store, makeSettings())
    expect(filtered.summary.entityCount).toBe(baselineEntityCount - 1)
    expect(filtered.hidden).toContainEqual(
      expect.objectContaining({
        entityId: targetEntityId,
        friendlyName: expect.any(String),
        domain: expect.any(String),
      }),
    )

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

    const baseline = await runAnalyze(fake.client, store, makeSettings())
    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId).not.toBeNull()

    store.replaceAll([{ entityId: targetEntityId!, roomId: 'living_room', hidden: true }])

    const result = await runAnalyze(fake.client, store, makeSettings())
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
    const baseline = await runAnalyze(fake.client, store, makeSettings())

    // Now load the orphan override.
    store.replaceAll([{ entityId: 'light.does_not_exist', roomId: 'bedroom' }])

    const result = await runAnalyze(fake.client, store, makeSettings())
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

    const baseline = await runPreview(
      fake.client,
      store,
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
    )
    const targetEntityId = pickEntityIn(baseline, 'kitchen')
    expect(targetEntityId).not.toBeNull()

    store.replaceAll([{ entityId: targetEntityId!, roomId: 'living_room' }])

    const overridden = await runPreview(
      fake.client,
      store,
      makeAppliedSnapshot(),
      makeDismissed(),
      makeSettings(),
    )
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
