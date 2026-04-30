import type { Fixture, FixtureMeta, FloorSpec, AreaSpec, DeviceSpec, EntitySpec } from './types.js'

interface FixtureInput {
  meta: FixtureMeta
  floors: FloorSpec[]
  areas: AreaSpec[]
  devices: DeviceSpec[]
  entities: EntitySpec[]
}

export function fixture(input: FixtureInput): Fixture {
  const floorIds = new Set<string>()
  for (const f of input.floors) {
    if (floorIds.has(f.id)) throw new Error(`duplicate floor id: ${f.id}`)
    floorIds.add(f.id)
  }

  const areaIds = new Set<string>()
  for (const a of input.areas) {
    if (areaIds.has(a.id)) throw new Error(`duplicate area id: ${a.id}`)
    if (a.floor !== null && !floorIds.has(a.floor)) {
      throw new Error(`area ${a.id} references unknown floor: ${a.floor}`)
    }
    areaIds.add(a.id)
  }

  const deviceIds = new Set<string>()
  for (const d of input.devices) {
    if (deviceIds.has(d.id)) throw new Error(`duplicate device id: ${d.id}`)
    if (d.area !== null && !areaIds.has(d.area)) {
      throw new Error(`device ${d.id} references unknown area: ${d.area}`)
    }
    deviceIds.add(d.id)
  }

  const entityIds = new Set<string>()
  for (const e of input.entities) {
    const entityId = `${e.domain}.${e.objectId}`
    if (entityIds.has(entityId)) throw new Error(`duplicate entity id: ${entityId}`)
    if (e.area !== null && !areaIds.has(e.area)) {
      throw new Error(`entity ${entityId} references unknown area: ${e.area}`)
    }
    if (e.device !== null && !deviceIds.has(e.device)) {
      throw new Error(`entity ${entityId} references unknown device: ${e.device}`)
    }
    entityIds.add(entityId)
  }

  return input
}
