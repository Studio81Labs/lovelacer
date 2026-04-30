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
    friendlyName: entity.name ?? entity.original_name ?? humanize(objectId),
    deviceClass: entity.device_class,
    entityCategory: entity.entity_category,
    haAreaId: entity.area_id,
    device: null, // device attachment in Task 4
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
