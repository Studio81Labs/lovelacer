import { performance } from 'node:perf_hooks'
import { setImmediate as yieldToEventLoop } from 'node:timers/promises'
import {
  assignFloors,
  computeDiff,
  computeSuggestions,
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
  FloorAssignment,
  HaAreaRegistryEntry,
  NormalizedEntity,
  Override,
  RoomAssignment,
  Settings,
  SettingsSections,
  SnapshotAssignment,
  Suggestion,
} from '@lovelacer/shared'
import type { AppliedSnapshotStore } from './storage/applied-snapshot-store.js'
import type { DismissedSuggestionStore } from './storage/dismissed-suggestion-store.js'
import type { OverrideStore } from './storage/override-store.js'
import type { SettingsStore } from './storage/settings-store.js'

export interface AnalyzeOutput {
  rooms: AnalyzedRoom[]
  misc: { entityId: string; friendlyName: string; domain: string }[]
  summary: { entityCount: number; roomCount: number; miscCount: number }
}

export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
  /** Null when no snapshot has been saved yet (first-run case). */
  diff: DiffResult | null
  /** P2-5 — actionable hints. Always present (empty array when none). */
  suggestions: Suggestion[]
}

interface PipelineLogger {
  info(obj: Record<string, unknown>, msg: string): void
  error(obj: Record<string, unknown>, msg: string): void
}

export interface PipelineRunOptions {
  logger?: PipelineLogger
}

function durationMs(start: number): number {
  return Math.round((performance.now() - start) * 10) / 10
}

function countResult(value: unknown): Record<string, unknown> {
  return Array.isArray(value) ? { count: value.length } : {}
}

async function timedStage<T>(
  options: PipelineRunOptions | undefined,
  stage: string,
  task: () => Promise<T>,
): Promise<T> {
  const start = performance.now()
  options?.logger?.info({ stage }, 'preview pipeline stage started')
  try {
    const result = await task()
    options?.logger?.info(
      { stage, durationMs: durationMs(start), ...countResult(result) },
      'preview pipeline stage completed',
    )
    return result
  } catch (err) {
    options?.logger?.error(
      { stage, durationMs: durationMs(start), err },
      'preview pipeline stage failed',
    )
    throw err
  }
}

async function timedSyncStage<T>(
  options: PipelineRunOptions | undefined,
  stage: string,
  task: () => T,
): Promise<T> {
  const start = performance.now()
  options?.logger?.info({ stage }, 'preview pipeline stage started')
  await yieldToEventLoop()
  try {
    const result = task()
    options?.logger?.info(
      { stage, durationMs: durationMs(start), ...countResult(result) },
      'preview pipeline stage completed',
    )
    return result
  } catch (err) {
    options?.logger?.error(
      { stage, durationMs: durationMs(start), err },
      'preview pipeline stage failed',
    )
    throw err
  }
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
  /**
   * Internal — only set when persistence threw, so the route can include
   * the cause in its error log. NOT part of the wire response.
   */
  snapshotError?: unknown
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
 *
 * Hand-rolled instead of zod (the project's typical body validator) by
 * design: the snapshot body is a closed shape that won't grow, and the
 * validator runs on every successful apply. The looseness on `config`
 * (any non-null object) is intentional — the snapshot's config is
 * archival, not consumed by the diff. Tightening it would silently
 * reject valid frontend payloads if the LovelaceConfig shape evolves.
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
  floorAssignments: Map<CanonicalRoomId, FloorAssignment | null>
  /** P2-6 — per-section toggles read from SettingsStore at the top of runFullPipeline. */
  sectionFlags: SettingsSections
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

async function runFullPipeline(
  ha: HaClient,
  overrides: OverrideStore,
  settings: SettingsStore,
  options?: PipelineRunOptions,
): Promise<PipelineState> {
  // P2-6 — read settings at the top so language/sections threading is
  // consistent across the entire pipeline call.
  const cfg: Settings = settings.get()
  const detectLanguage = cfg.language === 'auto' ? undefined : cfg.language

  // Floor registry is opportunistic — older HA versions may not expose
  // `config/floor_registry/list`. If it errors, we treat as empty and
  // proceed; the rest of analyze must not depend on floor data.
  const [entityRegistry, deviceRegistry, areaRegistry, floorRegistry] = await Promise.all([
    timedStage(options, 'ha.entity_registry', () => ha.getEntityRegistry()),
    timedStage(options, 'ha.device_registry', () => ha.getDeviceRegistry()),
    timedStage(options, 'ha.area_registry', () => ha.getAreaRegistry()),
    timedStage(options, 'ha.floor_registry', () =>
      ha.getFloorRegistry().catch((err: unknown) => {
        options?.logger?.info(
          { stage: 'ha.floor_registry', err },
          'preview pipeline optional floor registry unavailable',
        )
        return [] as Awaited<ReturnType<typeof ha.getFloorRegistry>>
      }),
    ),
  ])

  const entities = await timedSyncStage(options, 'normalize', () =>
    normalize({
      entities: entityRegistry,
      devices: deviceRegistry,
    }),
  )
  const assignments = await timedSyncStage(options, 'detect', () =>
    detect({
      entities,
      areas: areaRegistry,
      ...(detectLanguage !== undefined ? { language: detectLanguage } : {}),
    }),
  )
  await timedSyncStage(options, 'apply_overrides', () =>
    applyOverrides({ assignments, entities }, overrides.getAll()),
  )
  const groupings = await timedSyncStage(options, 'group_by_domain', () =>
    groupByDomain({ assignments, entities }),
  )

  const entityById = new Map(entities.map((e) => [e.entityId, e]))

  const rooms: AnalyzedRoom[] = []
  const misc: AnalyzeOutput['misc'] = []

  await timedSyncStage(options, 'build_analyze_output', () => {
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
  })

  rooms.sort((a, b) => a.displayName.localeCompare(b.displayName, 'en'))

  // Match `entityCount` to what the analyzer/generator actually surfaces:
  // hidden + disabled entities don't appear in any view, so don't count them.
  const visibleEntityCount = entities.filter((e) => !e.isHidden && !e.isDisabled).length

  const floorAssignments = await timedSyncStage(options, 'assign_floors', () =>
    assignFloors({
      rooms,
      areas: areaRegistry,
      floors: floorRegistry,
    }),
  )

  options?.logger?.info(
    {
      stage: 'pipeline_summary',
      entities: visibleEntityCount,
      rooms: rooms.length,
      misc: misc.length,
      groupings: groupings.length,
    },
    'preview pipeline state ready',
  )

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
    floorAssignments,
    sectionFlags: cfg.sections,
  }
}

export async function runAnalyze(
  ha: HaClient,
  overrides: OverrideStore,
  settings: SettingsStore,
  options?: PipelineRunOptions,
): Promise<AnalyzeOutput> {
  const state = await runFullPipeline(ha, overrides, settings, options)
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
  dismissedSuggestions: DismissedSuggestionStore,
  settings: SettingsStore,
  options?: PipelineRunOptions,
): Promise<PreviewOutput> {
  const state = await runFullPipeline(ha, overrides, settings, options)

  // Drop the misc grouping before view generation: misc entities surface
  // via the analyze response's `misc[]` field, not as a dashboard view.
  const dashboardGroupings = state.groupings.filter((g) => g.roomId !== 'misc')

  const home = await timedSyncStage(options, 'build_home_view', () =>
    buildHomeView({
      entities: state.entities,
      groupings: dashboardGroupings,
      rooms: state.rooms,
      floorAssignments: state.floorAssignments,
      sections: state.sectionFlags,
    }),
  )
  const rooms = await timedSyncStage(options, 'build_room_views', () =>
    buildRoomViews(dashboardGroupings),
  )
  const config = await timedSyncStage(options, 'build_lovelace_config', () =>
    buildLovelaceConfig({ home, rooms }),
  )

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

  // P2-5 — compute suggestions. Pre-build the lookups computeSuggestions
  // expects so the engine stays a pure O(n) walk. miscEntityIds is
  // derived from state.misc which is already filtered to visible
  // (non-hidden, non-disabled) entities by runFullPipeline.
  const overridesById = new Map<string, Override>()
  for (const o of overrides.getAll()) overridesById.set(o.entityId, o)
  const entitiesById = new Map<string, NormalizedEntity>()
  for (const e of state.entities) entitiesById.set(e.entityId, e)
  const miscEntityIds = new Set(state.misc.map((m) => m.entityId))

  const suggestions = await timedSyncStage(options, 'compute_suggestions', () =>
    computeSuggestions({
      rooms: state.rooms,
      miscEntityIds,
      entitiesById,
      overridesById,
      dismissed: dismissedSuggestions.getAllAsKeySet(),
    }),
  )

  options?.logger?.info(
    {
      stage: 'preview_summary',
      entities: state.summary.entityCount,
      rooms: state.rooms.length,
      misc: state.misc.length,
      views: config.views.length,
      suggestions: suggestions.length,
    },
    'preview pipeline output ready',
  )

  return {
    rooms: state.rooms,
    misc: state.misc,
    summary: state.summary,
    config,
    diff,
    suggestions,
  }
}

export async function runApply(
  ha: HaClient,
  overrides: OverrideStore,
  appliedSnapshot: AppliedSnapshotStore,
  dismissedSuggestions: DismissedSuggestionStore,
  settings: SettingsStore,
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
    const preview = await runPreview(ha, overrides, appliedSnapshot, dismissedSuggestions, settings)
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
  } catch (err) {
    // SQLite write failed (disk full, IO error). The dashboard is live in
    // HA; the user just doesn't get a fresh diff baseline this time.
    return { ...result, snapshotPersisted: false, snapshotError: err }
  }
}
