import { createHash } from 'node:crypto'
import type { Fixture } from './types.js'

/**
 * HA storage schema versions. Verified against `home-assistant/home-assistant:stable`
 * by running the loader against an onboarded HA install and inspecting the values
 * HA writes to disk. Bump these (and the data shape below) when HA migrates the
 * schema; HA refuses to read JSON whose minor_version is higher than the running
 * core supports, but accepts equal-or-lower and runs forward migrations.
 *
 * Floor registry minor_version 2 is the format introduced when floors first
 * shipped; it has remained stable.
 */
export const STORAGE_VERSIONS = {
  'core.floor_registry': { version: 1, minor_version: 3 },
  'core.area_registry': { version: 1, minor_version: 9 },
  'core.device_registry': { version: 1, minor_version: 12 },
  'core.entity_registry': { version: 1, minor_version: 22 },
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
  // Single timestamp for the whole serialization run. The exact value is
  // unimportant; HA only requires a parseable ISO 8601 string.
  const ts = new Date().toISOString().replace('Z', '+00:00')

  return {
    'core.floor_registry': envelope('core.floor_registry', {
      floors: fx.floors.map((f) => ({
        floor_id: f.id,
        name: f.name,
        level: f.level,
        icon: f.icon,
        aliases: [],
        created_at: ts,
        modified_at: ts,
      })),
    }),
    'core.area_registry': envelope('core.area_registry', {
      areas: fx.areas.map((a) => ({
        // v1.9 renamed area_id → id (still slug-shaped, still the FK target).
        id: a.id,
        name: a.name,
        floor_id: a.floor,
        icon: a.icon,
        aliases: [],
        labels: [],
        picture: null,
        humidity_entity_id: null,
        temperature_entity_id: null,
        created_at: ts,
        modified_at: ts,
      })),
    }),
    'core.device_registry': envelope('core.device_registry', {
      devices: fx.devices.map((d) => ({
        id: d.id,
        name: d.name,
        name_by_user: d.nameByUser,
        manufacturer: d.manufacturer,
        model: d.model,
        model_id: null,
        serial_number: null,
        area_id: d.area,
        identifiers: [['lovelacer_fixture', d.id]],
        connections: [],
        config_entries: [],
        config_entries_subentries: {},
        primary_config_entry: null,
        configuration_url: null,
        disabled_by: null,
        entry_type: null,
        hw_version: null,
        sw_version: null,
        via_device_id: null,
        labels: [],
        created_at: ts,
        modified_at: ts,
      })),
      deleted_devices: [],
    }),
    'core.entity_registry': envelope('core.entity_registry', {
      entities: fx.entities.map((e) => {
        const entityId = `${e.domain}.${e.objectId}`
        return {
          entity_id: entityId,
          // v1.22 added an internal row id (32-char hex). We derive it
          // deterministically from the entity_id so re-runs are stable.
          id: hexId(entityId),
          unique_id: e.uniqueId,
          platform: 'lovelacer_fixture',
          name: e.nameByUser,
          original_name: e.originalName,
          area_id: e.area,
          device_id: e.device,
          device_class: e.deviceClass,
          original_device_class: e.deviceClass,
          entity_category: e.entityCategory,
          icon: null,
          original_icon: null,
          disabled_by: e.disabled ? 'user' : null,
          hidden_by: e.hidden ? 'user' : null,
          config_entry_id: null,
          config_subentry_id: null,
          capabilities: null,
          categories: {},
          supported_features: 0,
          unit_of_measurement: null,
          translation_key: null,
          options: {},
          aliases: [],
          aliases_v2: [null],
          labels: [],
          has_entity_name: false,
          object_id_base: null,
          suggested_object_id: null,
          previous_unique_id: null,
          created_at: ts,
          modified_at: ts,
        }
      }),
      deleted_entities: [],
      orphaned_timestamps: {},
    }),
  }
}

function envelope(key: keyof typeof STORAGE_VERSIONS, data: unknown): StorageEnvelope {
  const version = STORAGE_VERSIONS[key]
  return { ...version, key, data }
}

function hexId(seed: string): string {
  return createHash('md5').update(seed).digest('hex')
}
