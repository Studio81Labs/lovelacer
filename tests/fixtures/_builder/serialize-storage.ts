import type { Fixture } from './types.js'

export const STORAGE_VERSIONS = {
  'core.floor_registry': { version: 1, minor_version: 2 },
  'core.area_registry': { version: 1, minor_version: 7 },
  'core.device_registry': { version: 1, minor_version: 7 },
  'core.entity_registry': { version: 1, minor_version: 16 },
} as const

export interface StorageEnvelope {
  version: number
  minor_version: number
  key: string
  data: unknown
}

export type StorageFiles = {
  [K in keyof typeof STORAGE_VERSIONS]: StorageEnvelope
}

export function serializeStorage(fx: Fixture): StorageFiles {
  return {
    'core.floor_registry': envelope('core.floor_registry', {
      floors: fx.floors.map((f) => ({
        floor_id: f.id,
        name: f.name,
        level: f.level,
        icon: f.icon,
        aliases: [],
      })),
    }),
    'core.area_registry': envelope('core.area_registry', {
      areas: fx.areas.map((a) => ({
        area_id: a.id,
        name: a.name,
        floor_id: a.floor,
        icon: a.icon,
        aliases: [],
        labels: [],
        picture: null,
      })),
    }),
    'core.device_registry': envelope('core.device_registry', {
      devices: fx.devices.map((d) => ({
        id: d.id,
        name: d.name,
        name_by_user: d.nameByUser,
        manufacturer: d.manufacturer,
        model: d.model,
        area_id: d.area,
        identifiers: [['lovelacer_fixture', d.id]],
        connections: [],
        config_entries: [],
        configuration_url: null,
        disabled_by: null,
        entry_type: null,
        hw_version: null,
        sw_version: null,
        via_device_id: null,
        labels: [],
      })),
      deleted_devices: [],
    }),
    'core.entity_registry': envelope('core.entity_registry', {
      entities: fx.entities.map((e) => ({
        entity_id: `${e.domain}.${e.objectId}`,
        unique_id: e.uniqueId,
        platform: 'lovelacer_fixture',
        name: e.nameByUser,
        original_name: e.originalName,
        area_id: e.area,
        device_id: e.device,
        device_class: e.deviceClass,
        original_device_class: e.deviceClass,
        entity_category: e.entityCategory,
        original_entity_category: e.entityCategory,
        disabled_by: e.disabled ? 'user' : null,
        hidden_by: e.hidden ? 'user' : null,
        config_entry_id: null,
        capabilities: null,
        supported_features: 0,
        unit_of_measurement: null,
        translation_key: null,
        options: {},
        aliases: [],
        labels: [],
        has_entity_name: false,
      })),
      deleted_entities: [],
      orphaned_timestamps: {},
    }),
  }
}

function envelope(key: keyof typeof STORAGE_VERSIONS, data: unknown): StorageEnvelope {
  const version = STORAGE_VERSIONS[key]
  return { ...version, key, data }
}
