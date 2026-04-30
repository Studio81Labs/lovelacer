import type {
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  NormalizedEntity,
} from '@lovelacer/shared'

export interface NormalizeInput {
  entities: HaEntityRegistryEntry[]
  devices: HaDeviceRegistryEntry[]
}

export function normalize(input: NormalizeInput): NormalizedEntity[] {
  return input.entities.map((entity) => normalizeEntity(entity))
}

function normalizeEntity(entity: HaEntityRegistryEntry): NormalizedEntity {
  const dotIndex = entity.entity_id.indexOf('.')
  const domain = entity.entity_id.slice(0, dotIndex)
  const objectId = entity.entity_id.slice(dotIndex + 1)

  return {
    entityId: entity.entity_id,
    domain,
    objectId,
    friendlyName: entity.name ?? entity.original_name ?? objectId, // humanization in Task 3
    deviceClass: entity.device_class,
    entityCategory: entity.entity_category,
    haAreaId: entity.area_id,
    device: null, // device attachment in Task 4
    isHidden: entity.hidden_by !== null,
    isDisabled: entity.disabled_by !== null,
  }
}
