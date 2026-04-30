import { slug, uniqueIdFor } from './ids.js'
import type { AreaSpec, DeviceSpec, EntitySpec, FixtureDomain, FloorSpec } from './types.js'

interface FloorOpts {
  level?: number
  icon?: string
}

export function floor(name: string, opts: FloorOpts = {}): FloorSpec {
  return {
    id: slug(name),
    name,
    level: opts.level ?? null,
    icon: opts.icon ?? null,
  }
}

interface AreaOpts {
  floor?: string
  icon?: string
}

export function area(name: string, opts: AreaOpts = {}): AreaSpec {
  return {
    id: slug(name),
    name,
    floor: opts.floor ?? null,
    icon: opts.icon ?? null,
  }
}

interface DeviceOpts {
  manufacturer?: string
  model?: string
  area?: string
  nameByUser?: string
}

export function device(name: string, opts: DeviceOpts = {}): DeviceSpec {
  return {
    id: slug(name),
    name,
    nameByUser: opts.nameByUser ?? null,
    manufacturer: opts.manufacturer ?? null,
    model: opts.model ?? null,
    area: opts.area ?? null,
  }
}

interface EntityOpts {
  area?: string
  device?: string
  objectId?: string
  nameByUser?: string
  hidden?: boolean
  disabled?: boolean
  entityCategory?: 'config' | 'diagnostic'
}

interface BuildEntityArgs extends EntityOpts {
  domain: FixtureDomain
  fixtureName: string
  friendlyName: string
  deviceClass: string | null
  templateState: string | null
}

function buildEntity(args: BuildEntityArgs): EntitySpec {
  const objectId = args.objectId ?? slug(args.friendlyName)
  const entityId = `${args.domain}.${objectId}`
  return {
    domain: args.domain,
    objectId,
    uniqueId: uniqueIdFor(args.fixtureName, entityId),
    originalName: args.friendlyName,
    nameByUser: args.nameByUser ?? null,
    area: args.area ?? null,
    device: args.device ?? null,
    deviceClass: args.deviceClass,
    entityCategory: args.entityCategory ?? null,
    hidden: args.hidden ?? false,
    disabled: args.disabled ?? false,
    templateState: args.templateState,
  }
}

export function light(fixtureName: string, friendlyName: string, opts: EntityOpts = {}): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'light',
    fixtureName,
    friendlyName,
    deviceClass: null,
    templateState: null,
  })
}

export function switch_(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'switch',
    fixtureName,
    friendlyName,
    deviceClass: null,
    templateState: 'off',
  })
}

export function tempSensor(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'sensor',
    fixtureName,
    friendlyName,
    deviceClass: 'temperature',
    templateState: '21.5',
  })
}

export function humiditySensor(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'sensor',
    fixtureName,
    friendlyName,
    deviceClass: 'humidity',
    templateState: '47',
  })
}

export function motion(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'binary_sensor',
    fixtureName,
    friendlyName,
    deviceClass: 'motion',
    templateState: 'off',
  })
}

export function occupancy(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'binary_sensor',
    fixtureName,
    friendlyName,
    deviceClass: 'occupancy',
    templateState: 'off',
  })
}

export function door(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'binary_sensor',
    fixtureName,
    friendlyName,
    deviceClass: 'door',
    templateState: 'off',
  })
}

export function climate(
  fixtureName: string,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain: 'climate',
    fixtureName,
    friendlyName,
    deviceClass: null,
    templateState: null,
  })
}

/**
 * Generic registry-only entity for domains where the loader does not emit
 * template YAML (cover, media_player, lock, fan, camera, vacuum).
 */
export function registryEntry(
  fixtureName: string,
  domain: FixtureDomain,
  friendlyName: string,
  opts: EntityOpts = {},
): EntitySpec {
  return buildEntity({
    ...opts,
    domain,
    fixtureName,
    friendlyName,
    deviceClass: null,
    templateState: null,
  })
}
