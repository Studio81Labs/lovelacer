import type {
  HaAreaRegistryEntry,
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  HaFloorRegistryEntry,
} from '@lovelacer/shared'
import type { Fixture } from './types.js'

export interface HaRegistries {
  entities: HaEntityRegistryEntry[]
  devices: HaDeviceRegistryEntry[]
  areas: HaAreaRegistryEntry[]
  floors: HaFloorRegistryEntry[]
}

/**
 * Convert a fixture-builder Fixture into the four HA registry list shapes
 * exposed via HA's WS API. The shapes intentionally mirror what
 * home-assistant-js-websocket returns from
 * `config/{entity,device,area,floor}_registry/list`.
 *
 * Fields the analyzer doesn't read are filled with sensible defaults.
 */
export function fixtureToHaRegistries(fx: Fixture): HaRegistries {
  return {
    entities: fx.entities.map((e) => ({
      entity_id: `${e.domain}.${e.objectId}`,
      name: e.nameByUser,
      original_name: e.originalName,
      area_id: e.area,
      device_id: e.device,
      platform: 'lovelacer_fixture',
      hidden_by: e.hidden ? 'user' : null,
      disabled_by: e.disabled ? 'user' : null,
      entity_category: e.entityCategory,
      device_class: e.deviceClass,
    })),
    devices: fx.devices.map((d) => ({
      id: d.id,
      name: d.name,
      name_by_user: d.nameByUser,
      manufacturer: d.manufacturer,
      model: d.model,
      area_id: d.area,
    })),
    areas: fx.areas.map((a) => ({
      area_id: a.id,
      name: a.name,
      floor_id: a.floor,
      icon: a.icon,
    })),
    floors: fx.floors.map((f) => ({
      floor_id: f.id,
      name: f.name,
      level: f.level,
      icon: f.icon,
    })),
  }
}
