import type {
  AlternativeAssignment,
  CanonicalRoomId,
  DetectionSignal,
  HaAreaRegistryEntry,
  LanguageCode,
  NormalizedEntity,
  RoomAssignment,
} from '@lovelacer/shared'
import { findRoom } from './match-room.js'

export interface AreaIndexEntry {
  /** The HA area's name (used as `matchedValue` on priority-1/2 signals). */
  name: string
  /**
   * Canonical room the area's name maps to via findRoom, or null when the
   * area exists but its name doesn't match any of the 14 canonical patterns.
   */
  canonical: Exclude<CanonicalRoomId, 'misc'> | null
}

export interface DetectionContext {
  /**
   * Maps HA area_id → AreaIndexEntry. Absence from the map means the
   * area_id doesn't exist in the input areas list at all (stale registry);
   * priorities 1/2 treat that the same as a null canonical (they don't fire).
   */
  areaIndex: ReadonlyMap<string, AreaIndexEntry>
  /**
   * P2-6 — narrows priorities 3-5 (friendly_name, entity_id, device_name)
   * to a single language's keyword set. Undefined = match-all (today's
   * default). Priorities 1-2 (HA-supplied area names) ignore this — area
   * names from HA's registry are matched against ALL keyword sets in
   * `buildDetectionContext`, regardless of the user's language pick.
   */
  language?: LanguageCode
}

export interface DetectInput {
  entities: NormalizedEntity[]
  areas: HaAreaRegistryEntry[]
  /** P2-6 — narrows priorities 3-5 to this language. Undefined = match all. */
  language?: LanguageCode
}

export interface BuildDetectionContextOptions {
  /** P2-6 — forwarded to the returned `DetectionContext.language`. */
  language?: LanguageCode
}

export function buildDetectionContext(
  areas: HaAreaRegistryEntry[],
  opts: BuildDetectionContextOptions = {},
): DetectionContext {
  const areaIndex = new Map<string, AreaIndexEntry>()
  for (const area of areas) {
    // Area-name matching stays multilingual — HA's registry data is
    // what it is. Only priorities 3-5 narrow.
    const match = findRoom(area.name)
    areaIndex.set(area.area_id, {
      name: area.name,
      canonical: match !== null ? match.canonical : null,
    })
  }
  return {
    areaIndex,
    ...(opts.language !== undefined ? { language: opts.language } : {}),
  }
}

interface FiredSignal extends DetectionSignal {
  /** The canonical room this signal targets. */
  target: Exclude<CanonicalRoomId, 'misc'>
}

export function detectEntity(entity: NormalizedEntity, ctx: DetectionContext): RoomAssignment {
  const fired: FiredSignal[] = []

  // Priority 1 — entity_area
  if (entity.haAreaId !== null) {
    const entry = ctx.areaIndex.get(entity.haAreaId)
    if (entry !== undefined && entry.canonical !== null) {
      fired.push({
        source: 'entity_area',
        weight: 1.0,
        matchedValue: entry.name,
        target: entry.canonical,
      })
    }
  }

  // Priority 2 — device_area
  if (entity.device !== null && entity.device.haAreaId !== null) {
    const entry = ctx.areaIndex.get(entity.device.haAreaId)
    if (entry !== undefined && entry.canonical !== null) {
      fired.push({
        source: 'device_area',
        weight: 0.85,
        matchedValue: entry.name,
        target: entry.canonical,
      })
    }
  }

  // Priority 3 — friendly_name
  const fnMatch = findRoom(
    entity.friendlyName,
    ctx.language !== undefined ? { language: ctx.language } : {},
  )
  if (fnMatch !== null) {
    fired.push({
      source: 'friendly_name',
      weight: 0.6,
      matchedValue: fnMatch.pattern,
      target: fnMatch.canonical,
    })
  }

  // Priority 4 — entity_id (objectId)
  const idMatch = findRoom(
    entity.objectId,
    ctx.language !== undefined ? { language: ctx.language } : {},
  )
  if (idMatch !== null) {
    fired.push({
      source: 'entity_id',
      weight: 0.5,
      matchedValue: idMatch.pattern,
      target: idMatch.canonical,
    })
  }

  // Priority 5 — device_name (prefer nameByUser, fall back to name)
  if (entity.device !== null) {
    const candidates = [entity.device.nameByUser, entity.device.name].filter(
      (s): s is string => s !== null,
    )
    for (const name of candidates) {
      const match = findRoom(name, ctx.language !== undefined ? { language: ctx.language } : {})
      if (match !== null) {
        fired.push({
          source: 'device_name',
          weight: 0.45,
          matchedValue: match.pattern,
          target: match.canonical,
        })
        break
      }
    }
  }

  return assemble(entity.entityId, fired)
}

export function detect(input: DetectInput): RoomAssignment[] {
  const ctx = buildDetectionContext(input.areas, {
    ...(input.language !== undefined ? { language: input.language } : {}),
  })
  return input.entities.map((entity) => detectEntity(entity, ctx))
}

const ALTERNATIVE_THRESHOLD = 0.2
const ALTERNATIVE_LIMIT = 2

/**
 * Confidence = top signal weight + corroboration boost (5% per extra
 * signal, capped at 10%), final result capped at 1.0. Used both for the
 * winner score in `assemble` and for each alternative target.
 */
function scoreTarget(topWeight: number, corroborationCount: number): number {
  const boost = Math.min(0.1, (corroborationCount - 1) * 0.05)
  return Math.min(1.0, topWeight + boost)
}

function assemble(entityId: string, fired: FiredSignal[]): RoomAssignment {
  if (fired.length === 0) {
    return { entityId, roomId: 'misc', confidence: 0, signals: [] }
  }
  // Highest-weight target wins; ties broken by priority (insertion) order.
  let winner = fired[0]!
  for (const s of fired) {
    if (s.weight > winner.weight) winner = s
  }

  // Corroboration boost: count fired signals pointing to the winning room.
  // Each additional corroborator adds 0.05; cap at 0.10. Final confidence
  // capped at 1.0. Different-target signals don't corroborate — see
  // docs/HEURISTICS.md "Boost for corroboration" and the P1a-4 spec.
  const corroborationCount = fired.filter((s) => s.target === winner.target).length
  const confidence = scoreTarget(winner.weight, corroborationCount)

  // Strip the internal `target` field before exposing signals publicly.
  const signals: DetectionSignal[] = fired.map(({ target: _t, ...rest }) => rest)

  // P2-5 — compute alternative rooms. Group fired signals by target,
  // score each non-winner target the same way (top weight + same
  // corroboration formula capped at 1.0), filter below threshold, sort
  // desc, take top N. Same boost formula as the winner so users see
  // comparable confidence numbers across the panel.
  const byTarget = new Map<Exclude<CanonicalRoomId, 'misc'>, FiredSignal[]>()
  for (const s of fired) {
    const list = byTarget.get(s.target)
    if (list === undefined) byTarget.set(s.target, [s])
    else list.push(s)
  }
  const altScores: AlternativeAssignment[] = []
  for (const [target, sigs] of byTarget) {
    if (target === winner.target) continue
    // Priority order means sigs[0] is always the highest-weight signal for this target.
    const topWeight = sigs[0]!.weight
    const altConfidence = scoreTarget(topWeight, sigs.length)
    if (altConfidence >= ALTERNATIVE_THRESHOLD) {
      altScores.push({ roomId: target, confidence: altConfidence })
    }
  }
  altScores.sort((a, b) => b.confidence - a.confidence)
  const alternatives = altScores.slice(0, ALTERNATIVE_LIMIT)

  return {
    entityId,
    roomId: winner.target,
    confidence,
    signals,
    ...(alternatives.length > 0 ? { alternatives } : {}),
  }
}
