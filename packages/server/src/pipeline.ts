import {
  computeDiff,
  detect,
  groupByDomain,
  normalize,
  type RoomGrouping,
} from '@lovelacer/analyzer'
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
  DiffResult,
  HaAreaRegistryEntry,
  NormalizedEntity,
  Override,
  RoomAssignment,
  SnapshotAssignment,
} from '@lovelacer/shared'
import type { AppliedSnapshotStore } from './storage/applied-snapshot-store.js'
import type { OverrideStore } from './storage/override-store.js'

export interface AnalyzeOutput {
  rooms: AnalyzedRoom[]
  misc: { entityId: string; friendlyName: string; domain: string }[]
  summary: { entityCount: number; roomCount: number; miscCount: number }
}

export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
  /** Null when no snapshot has been saved yet (first-run case). */
  diff: DiffResult | null
}

export interface ApplyInput {
  config?: LovelaceConfig
  options?: ApplyDashboardOptions
  /**
   * Optional. When present and valid, the server persists this as the
   * "last applied" snapshot AFTER the HA push succeeds. The production
   * frontend always sends it; scripts and tests may omit.
   */
  snapshot?: {
    assignments: SnapshotAssignment[]
    config: unknown
  }
}

export interface RunApplyResult extends ApplyDashboardResult {
  /** Set when a snapshot field was sent but rejected by validation. */
  snapshotSkipped?: 'invalid'
  /** Set when persistence threw (SQLite write failure, etc). */
  snapshotPersisted?: false
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
 * Validates the snapshot body. Returns true iff `assignments` is an array
 * of `{ entityId: string, roomId: string|null }` and `config` is an object.
 * Defense-in-depth — the route is the trust boundary.
 */
function isValidSnapshotShape(value: unknown): value is NonNullable<ApplyInput['snapshot']> {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (!Array.isArray(v.assignments)) return false
  for (const a of v.assignments) {
    if (typeof a !== 'object' || a === null) return false
    const r = a as Record<string, unknown>
    if (typeof r.entityId !== 'string') return false
    if (r.roomId !== null && typeof r.roomId !== 'string') return false
  }
  if (typeof v.config !== 'object' || v.config === null) return false
  return true
}

/**
 * Display names for the 14 canonical rooms. Used as fallback when a room
 * has no entities with `haAreaId` set (i.e., entities matched only via
 * name signals so we can't pull a localized area name).
 *
 * Mirrors the titles used in `packages/generator/src/rooms.ts`'s
 * `ROOM_DISPLAY` table. The duplication is small and self-contained;
 * a future ticket may share the source-of-truth across the
 * server/generator boundary.
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

/**
 * Internal pipeline state shared by `runAnalyze` and `runPreview`. Holds
 * everything they need from a single registry fetch so the two routes
 * never race against a HA registry mutation between calls.
 */
interface PipelineState {
  entities: NormalizedEntity[]
  groupings: RoomGrouping[]
  rooms: AnalyzedRoom[]
  misc: AnalyzeOutput['misc']
  summary: AnalyzeOutput['summary']
}

/**
 * Patches detector output with user overrides. Mutates `assignments` and
 * `entities` in place. Called by `runFullPipeline` between `detect` and
 * `groupByDomain` (wired in the next layer).
 *
 * - Each override with `roomId` set: replace the matching assignment's
 *   `roomId`, set `confidence = 1.0` and `manual = true`.
 * - Each override with `hidden: true`: OR-merge into the matching
 *   entity's `isHidden` so existing hidden filters drop it from views.
 *
 * Orphaned overrides (entityId not in assignments) silently no-op so
 * stale overrides from a since-removed integration don't blow up the
 * pipeline.
 *
 * Caller MUST ensure `overrides` contains no duplicate entityIds —
 * duplicates are last-write-wins (the route layer's zod refine enforces
 * this on PUT /api/overrides).
 */
export function applyOverrides(
  state: { assignments: RoomAssignment[]; entities: NormalizedEntity[] },
  overrides: Override[],
): void {
  if (overrides.length === 0) return // hot path

  const byEntityId = new Map(overrides.map((o) => [o.entityId, o]))

  for (const a of state.assignments) {
    const o = byEntityId.get(a.entityId)
    if (o?.roomId !== undefined) {
      a.roomId = o.roomId
      a.confidence = 1.0
      a.manual = true
    }
  }
  for (const e of state.entities) {
    const o = byEntityId.get(e.entityId)
    if (o?.hidden === true) {
      e.isHidden = true
    }
  }
}

async function runFullPipeline(ha: HaClient, overrides: OverrideStore): Promise<PipelineState> {
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
  applyOverrides({ assignments, entities }, overrides.getAll())
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
    entities,
    groupings,
    rooms,
    misc,
    summary: {
      entityCount: visibleEntityCount,
      roomCount: rooms.length,
      miscCount: misc.length,
    },
  }
}

export async function runAnalyze(ha: HaClient, overrides: OverrideStore): Promise<AnalyzeOutput> {
  const state = await runFullPipeline(ha, overrides)
  return { rooms: state.rooms, misc: state.misc, summary: state.summary }
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

export async function runPreview(
  ha: HaClient,
  overrides: OverrideStore,
  appliedSnapshot: AppliedSnapshotStore,
): Promise<PreviewOutput> {
  const state = await runFullPipeline(ha, overrides)

  // Drop the misc grouping before view generation: misc entities surface
  // via the analyze response's `misc[]` field, not as a dashboard view.
  const dashboardGroupings = state.groupings.filter((g) => g.roomId !== 'misc')

  const home = buildHomeView({ entities: state.entities, groupings: dashboardGroupings })
  const rooms = buildRoomViews(dashboardGroupings)
  const config = buildLovelaceConfig({ home, rooms })

  // Build the flat assignments list the diff expects: every visible
  // entity → its assigned room (or null for misc). Mirrors what the
  // frontend will send back at apply time.
  const currentAssignments: SnapshotAssignment[] = []
  for (const room of state.rooms) {
    for (const a of room.assignments) {
      currentAssignments.push({ entityId: a.entityId, roomId: room.id })
    }
  }
  for (const m of state.misc) {
    currentAssignments.push({ entityId: m.entityId, roomId: null })
  }

  const snapshot = appliedSnapshot.get()
  const diff =
    snapshot === null
      ? null
      : computeDiff({ snapshot, current: { assignments: currentAssignments } })

  return {
    rooms: state.rooms,
    misc: state.misc,
    summary: state.summary,
    config,
    diff,
  }
}

export async function runApply(
  ha: HaClient,
  overrides: OverrideStore,
  appliedSnapshot: AppliedSnapshotStore,
  body: ApplyInput,
  defaultOptions: ApplyDashboardOptions = {},
): Promise<RunApplyResult> {
  const options = { ...defaultOptions, ...body.options } // body wins

  let result: ApplyDashboardResult
  if (body.config !== undefined) {
    if (typeof body.config.title !== 'string' || !Array.isArray(body.config.views)) {
      throw new InvalidConfigError('invalid_config: title must be string and views must be array')
    }
    result = await ha.applyDashboard(body.config, options)
  } else {
    const preview = await runPreview(ha, overrides, appliedSnapshot)
    result = await ha.applyDashboard(preview.config, options)
  }

  // Snapshot persistence happens AFTER the HA push succeeds. A push
  // failure throws above and we never reach this — that's deliberate
  // (we don't want to snapshot a config that didn't actually land).
  if (body.snapshot === undefined) {
    return result
  }
  if (!isValidSnapshotShape(body.snapshot)) {
    return { ...result, snapshotSkipped: 'invalid' }
  }
  try {
    appliedSnapshot.save({
      assignments: body.snapshot.assignments,
      config: body.snapshot.config,
    })
    return result
  } catch {
    // SQLite write failed (disk full, IO error). The dashboard is live in
    // HA; the user just doesn't get a fresh diff baseline this time.
    return { ...result, snapshotPersisted: false }
  }
}
