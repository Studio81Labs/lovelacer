import { describe, it, expect } from 'vitest'
import type { HaAreaRegistryEntry } from '@lovelacer/shared'
import { buildDetectionContext } from '../detect.js'

describe('buildDetectionContext', () => {
  it('returns an empty index for empty input', () => {
    const ctx = buildDetectionContext([])
    expect(ctx.areaIndex.size).toBe(0)
  })

  it('maps area whose name matches a canonical via findRoom', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'living_room', name: 'Living Room', floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    const entry = ctx.areaIndex.get('living_room')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe('Living Room')
    expect(entry!.canonical).toBe('living_room')
  })

  it('maps Czech area name via diacritic-stripping pipeline', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'loznice', name: 'Ložnice', floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    const entry = ctx.areaIndex.get('loznice')
    expect(entry!.canonical).toBe('bedroom')
  })

  it('records canonical=null when area name does not map', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'barts_den', name: "Bart's Den", floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    const entry = ctx.areaIndex.get('barts_den')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe("Bart's Den")
    expect(entry!.canonical).toBeNull()
  })

  it('builds one entry per input area', () => {
    const areas: HaAreaRegistryEntry[] = [
      { area_id: 'living_room', name: 'Living Room', floor_id: null, icon: null },
      { area_id: 'kitchen', name: 'Kitchen', floor_id: null, icon: null },
      { area_id: 'unknown', name: "Bart's Den", floor_id: null, icon: null },
    ]
    const ctx = buildDetectionContext(areas)
    expect(ctx.areaIndex.size).toBe(3)
  })
})
