import { detect, groupByDomain, normalize, type RoomGrouping } from '@lovelacer/analyzer'
import {
  buildHomeView,
  buildLovelaceConfig,
  buildRoomViews,
  type LovelaceConfig,
} from '@lovelacer/generator'
import type { ApplyDashboardOptions, ApplyDashboardResult, HaClient } from '@lovelacer/ha-client'
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  HaAreaRegistryEntry,
  NormalizedEntity,
  RoomAssignment,
} from '@lovelacer/shared'

export interface AnalyzeOutput {
  rooms: AnalyzedRoom[]
  misc: { entityId: string; friendlyName: string; domain: string }[]
  summary: { entityCount: number; roomCount: number; miscCount: number }
}

export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
}

export interface ApplyInput {
  config?: LovelaceConfig
  options?: ApplyDashboardOptions
}

/**
 * Thrown by `runApply` when the caller-supplied `body.config` fails the
 * minimal shape check (`title: string`, `views: array`). The route catches
 * this with `instanceof InvalidConfigError` and returns 400.
 */
export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidConfigError'
  }
}

/**
 * Display names for the 14 canonical rooms. Used as fallback when a room
 * has no entities with `haAreaId` set (i.e., entities matched only via
 * name signals so we can't pull a localized area name).
 *
 * Mirrors the titles used in `packages/generator/src/room-view.ts`'s
 * `ROOM_DISPLAY` table. P1b-2 may DRY these up; for now the duplication
 * is small and self-contained.
 */
const CANONICAL_ROOM_NAMES: Record<CanonicalRoomId, string> = {
  kitchen: 'Kitchen',
  living_room: 'Living Room',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  office: 'Office',
  garage: 'Garage',
  garden: 'Garden',
  dining_room: 'Dining Room',
  laundry: 'Laundry',
  basement: 'Basement',
  attic: 'Attic',
  kids_room: "Kids' Room",
  guest_room: 'Guest Room',
  hallway: 'Hallway',
  misc: 'Other',
}

export async function runAnalyze(ha: HaClient): Promise<AnalyzeOutput> {
  const [entityRegistry, deviceRegistry, areaRegistry] = await Promise.all([
    ha.getEntityRegistry(),
    ha.getDeviceRegistry(),
    ha.getAreaRegistry(),
  ])

  const entities = normalize({
    entities: entityRegistry,
    devices: deviceRegistry,
  })
  const assignments = detect({ entities, areas: areaRegistry })
  const groupings = groupByDomain({ assignments, entities })

  const entityById = new Map(entities.map((e) => [e.entityId, e]))

  const rooms: AnalyzedRoom[] = []
  const misc: AnalyzeOutput['misc'] = []

  for (const grouping of groupings) {
    // Skip hidden/disabled entities everywhere — `groupByDomain` already
    // filters them from views, so the analyze counts must match what users
    // actually see in the dashboard.
    const roomAssignments = assignments.filter((a) => {
      if (a.roomId !== grouping.roomId) return false
      const e = entityById.get(a.entityId)
      return e !== undefined && !e.isHidden && !e.isDisabled
    })
    if (grouping.roomId === 'misc') {
      for (const a of roomAssignments) {
        const e = entityById.get(a.entityId)
        if (e === undefined) continue
        misc.push({
          entityId: e.entityId,
          friendlyName: e.friendlyName,
          domain: e.domain,
        })
      }
      continue
    }

    rooms.push(buildAnalyzedRoom(grouping, roomAssignments, entityById, areaRegistry))
  }

  rooms.sort((a, b) => a.displayName.localeCompare(b.displayName, 'en'))

  // Match `entityCount` to what the analyzer/generator actually surfaces:
  // hidden + disabled entities don't appear in any view, so don't count them.
  const visibleEntityCount = entities.filter((e) => !e.isHidden && !e.isDisabled).length

  return {
    rooms,
    misc,
    summary: {
      entityCount: visibleEntityCount,
      roomCount: rooms.length,
      miscCount: misc.length,
    },
  }
}

function buildAnalyzedRoom(
  grouping: RoomGrouping,
  roomAssignments: RoomAssignment[],
  entityById: ReadonlyMap<string, NormalizedEntity>,
  areas: HaAreaRegistryEntry[],
): AnalyzedRoom {
  // Find the dominant haAreaId (the most common area_id among entities in
  // this room). If no entities have an area, fall back to canonical name.
  const areaCounts = new Map<string, number>()
  for (const a of roomAssignments) {
    const e = entityById.get(a.entityId)
    if (e?.haAreaId !== null && e?.haAreaId !== undefined) {
      areaCounts.set(e.haAreaId, (areaCounts.get(e.haAreaId) ?? 0) + 1)
    }
  }

  let haAreaId: string | null = null
  if (areaCounts.size > 0) {
    let topArea: string | null = null
    let topCount = 0
    for (const [areaId, count] of areaCounts) {
      if (count > topCount) {
        topArea = areaId
        topCount = count
      }
    }
    haAreaId = topArea
  }

  const displayName =
    haAreaId !== null
      ? (areas.find((a) => a.area_id === haAreaId)?.name ?? CANONICAL_ROOM_NAMES[grouping.roomId])
      : CANONICAL_ROOM_NAMES[grouping.roomId]

  const totalConfidence = roomAssignments.reduce((sum, a) => sum + a.confidence, 0)
  const averageConfidence =
    roomAssignments.length === 0 ? 0 : totalConfidence / roomAssignments.length

  return {
    id: grouping.roomId,
    haAreaId,
    displayName,
    entityCount: roomAssignments.length,
    averageConfidence,
    assignments: roomAssignments,
  }
}

export async function runPreview(ha: HaClient): Promise<PreviewOutput> {
  const analyze = await runAnalyze(ha)

  // We need the entities + groupings again. Re-fetch is cheap; alternative
  // is to thread them out of runAnalyze, but that bloats AnalyzeOutput.
  const [entityRegistry, deviceRegistry, areaRegistry] = await Promise.all([
    ha.getEntityRegistry(),
    ha.getDeviceRegistry(),
    ha.getAreaRegistry(),
  ])
  const entities = normalize({
    entities: entityRegistry,
    devices: deviceRegistry,
  })
  const assignments = detect({ entities, areas: areaRegistry })
  const groupings = groupByDomain({ assignments, entities })

  // Drop the misc grouping before view generation: misc entities surface
  // via the analyze response's `misc[]` field, not as a dashboard view.
  const dashboardGroupings = groupings.filter((g) => g.roomId !== 'misc')

  const home = buildHomeView({ entities })
  const rooms = buildRoomViews(dashboardGroupings)
  const config = buildLovelaceConfig({ home, rooms })

  return { ...analyze, config }
}

export async function runApply(ha: HaClient, body: ApplyInput): Promise<ApplyDashboardResult> {
  if (body.config !== undefined) {
    if (typeof body.config.title !== 'string' || !Array.isArray(body.config.views)) {
      throw new InvalidConfigError('invalid_config: title must be string and views must be array')
    }
    return ha.applyDashboard(body.config, body.options)
  }

  const preview = await runPreview(ha)
  return ha.applyDashboard(preview.config, body.options)
}
