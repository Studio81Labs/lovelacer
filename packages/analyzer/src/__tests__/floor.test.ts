import { describe, it, expect } from 'vitest'
import type { AnalyzedRoom, HaAreaRegistryEntry, HaFloorRegistryEntry } from '@lovelacer/shared'
import { assignFloors } from '../floor.js'

function room(id: AnalyzedRoom['id'], haAreaId: string | null): AnalyzedRoom {
  return {
    id,
    haAreaId,
    displayName: id === 'misc' ? 'Other' : id,
    icon: 'mdi:silverware-fork-knife',
    entityCount: 0,
    averageConfidence: 0,
    assignments: [],
  }
}

function area(area_id: string, floor_id: string | null): HaAreaRegistryEntry {
  return { area_id, name: area_id, floor_id, icon: null }
}

function floor(floor_id: string, name: string, level: number | null = null): HaFloorRegistryEntry {
  return { floor_id, name, level, icon: null }
}

describe('assignFloors', () => {
  it('returns an empty map when given zero rooms', () => {
    const result = assignFloors({ rooms: [], areas: [], floors: [] })
    expect(result.size).toBe(0)
  })

  it('maps every room to null when the floors registry is empty', () => {
    const result = assignFloors({
      rooms: [room('kitchen', 'kitchen_area')],
      areas: [area('kitchen_area', 'ground')],
      floors: [],
    })
    expect(result.get('kitchen')).toBeNull()
  })

  it('maps a room with no haAreaId to null', () => {
    const result = assignFloors({
      rooms: [room('kitchen', null)],
      areas: [],
      floors: [floor('ground', 'Ground Floor', 0)],
    })
    expect(result.get('kitchen')).toBeNull()
  })

  it('maps a room whose area has no floor_id to null', () => {
    const result = assignFloors({
      rooms: [room('kitchen', 'kitchen_area')],
      areas: [area('kitchen_area', null)],
      floors: [floor('ground', 'Ground Floor', 0)],
    })
    expect(result.get('kitchen')).toBeNull()
  })

  it('maps a room whose floor_id is not in the registry to null (stale data)', () => {
    const result = assignFloors({
      rooms: [room('kitchen', 'kitchen_area')],
      areas: [area('kitchen_area', 'ghost_floor')],
      floors: [floor('ground', 'Ground Floor', 0)],
    })
    expect(result.get('kitchen')).toBeNull()
  })

  it('maps a room with a full chain to the correct FloorAssignment', () => {
    const result = assignFloors({
      rooms: [room('kitchen', 'kitchen_area')],
      areas: [area('kitchen_area', 'ground')],
      floors: [floor('ground', 'Ground Floor', 0)],
    })
    expect(result.get('kitchen')).toEqual({
      floorId: 'ground',
      name: 'Ground Floor',
      level: 0,
      icon: null,
    })
  })

  it('partitions multiple rooms across multiple floors correctly', () => {
    const result = assignFloors({
      rooms: [
        room('kitchen', 'kitchen_area'),
        room('living_room', 'living_area'),
        room('bedroom', 'bedroom_area'),
        room('office', 'office_area'),
      ],
      areas: [
        area('kitchen_area', 'ground'),
        area('living_area', 'ground'),
        area('bedroom_area', 'upstairs'),
        area('office_area', 'upstairs'),
      ],
      floors: [floor('ground', 'Ground', 0), floor('upstairs', 'Upstairs', 1)],
    })
    expect(result.get('kitchen')?.floorId).toBe('ground')
    expect(result.get('living_room')?.floorId).toBe('ground')
    expect(result.get('bedroom')?.floorId).toBe('upstairs')
    expect(result.get('office')?.floorId).toBe('upstairs')
  })

  it('excludes the misc room entirely (not in the result map)', () => {
    const result = assignFloors({
      rooms: [room('kitchen', 'kitchen_area'), room('misc', null)],
      areas: [area('kitchen_area', 'ground')],
      floors: [floor('ground', 'Ground', 0)],
    })
    expect(result.has('misc')).toBe(false)
    expect(result.has('kitchen')).toBe(true)
  })
})
