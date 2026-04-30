import type {
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  NormalizedDevice,
  NormalizedEntity,
} from '@lovelacer/shared'

export interface NormalizeInput {
  entities: HaEntityRegistryEntry[]
  devices: HaDeviceRegistryEntry[]
}

export function normalize(input: NormalizeInput): NormalizedEntity[] {
  const devicesById = new Map(input.devices.map((d) => [d.id, d]))
  return input.entities.map((entity) => normalizeEntity(entity, devicesById))
}

function normalizeEntity(
  entity: HaEntityRegistryEntry,
  devicesById: Map<string, HaDeviceRegistryEntry>,
): NormalizedEntity {
  const dotIndex = entity.entity_id.indexOf('.')
  if (dotIndex <= 0 || dotIndex === entity.entity_id.length - 1) {
    throw new Error(
      `malformed entity_id: ${JSON.stringify(entity.entity_id)} — expected '<domain>.<object_id>'`,
    )
  }
  const domain = entity.entity_id.slice(0, dotIndex)
  const objectId = entity.entity_id.slice(dotIndex + 1)

  const haDevice = entity.device_id !== null ? devicesById.get(entity.device_id) : undefined
  const device: NormalizedDevice | null = haDevice
    ? {
        id: haDevice.id,
        name: haDevice.name,
        nameByUser: haDevice.name_by_user,
        manufacturer: haDevice.manufacturer,
        model: haDevice.model,
        haAreaId: haDevice.area_id,
      }
    : null

  return {
    entityId: entity.entity_id,
    domain,
    objectId,
    friendlyName: entity.name ?? entity.original_name ?? humanize(objectId),
    deviceClass: entity.device_class,
    entityCategory: entity.entity_category,
    haAreaId: entity.area_id,
    device,
    isHidden: entity.hidden_by !== null,
    isDisabled: entity.disabled_by !== null,
  }
}

/**
 * Convert an objectId slug to a display string.
 *
 * Replaces underscores with spaces and title-cases each whitespace-
 * separated word (first letter upper, rest lower). No acronym
 * preservation, no number-aware casing — keep simple until a consumer
 * needs more.
 */
function humanize(slug: string): string {
  if (slug.length === 0) return ''
  return slug
    .split('_')
    .filter((word) => word.length > 0)
    .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
