import type {
  AnalyzedRoom,
  NormalizedEntity,
  Override,
  RoomAssignment,
  Suggestion,
} from '@lovelacer/shared'

/**
 * Input for {@link computeSuggestions}. All fields are required (callers
 * pre-build the lookups so the engine stays a pure O(n) walk with O(1)
 * map/set probes).
 */
export interface ComputeSuggestionsInput {
  rooms: AnalyzedRoom[]
  miscEntityIds: Set<string>
  entitiesById: Map<string, NormalizedEntity>
  overridesById: Map<string, Override>
  /** Serialized "entityId|type" keys for O(1) "is this dismissed?" lookup. */
  dismissed: Set<string>
}

const NAME_BASED_SOURCES = new Set(['friendly_name', 'entity_id', 'device_name'])
const SET_AREA_MIN_CONFIDENCE = 0.6
const MOVE_ROOM_MAX_CONFIDENCE = 0.5
/** Top alternative must be within this delta of the winner to be considered close. */
const MOVE_ROOM_GAP = 0.15

/**
 * Pure suggestion engine. Walks every assigned entity (skipping the misc
 * room) plus every misc entity, applies the three rules, filters
 * dismissed keys, sorts deterministically, returns the result.
 *
 * No IO. Caller pre-builds the lookups so this stays sub-millisecond on
 * realistic 500-entity installs.
 */
export function computeSuggestions(input: ComputeSuggestionsInput): Suggestion[] {
  const out: Suggestion[] = []

  for (const room of input.rooms) {
    if (room.id === 'misc') continue
    for (const a of room.assignments) {
      const entity = input.entitiesById.get(a.entityId)
      if (entity === undefined) continue
      const override = input.overridesById.get(a.entityId)

      const setArea = trySetAreaIdSuggestion(a, entity)
      if (setArea !== null && !isDismissed(input.dismissed, setArea)) out.push(setArea)

      const moveRoom = tryMoveRoomSuggestion(a, override)
      if (moveRoom !== null && !isDismissed(input.dismissed, moveRoom)) out.push(moveRoom)

      const hideDiag = tryHideDiagnosticSuggestion(entity, override)
      if (hideDiag !== null && !isDismissed(input.dismissed, hideDiag)) out.push(hideDiag)
    }
  }

  // Diagnostic suggestions also apply to misc entities — they can pile up
  // there as detection-eluding "Battery", "Signal Strength" sensors.
  for (const entityId of input.miscEntityIds) {
    const entity = input.entitiesById.get(entityId)
    if (entity === undefined) continue
    const override = input.overridesById.get(entityId)
    const hideDiag = tryHideDiagnosticSuggestion(entity, override)
    if (hideDiag !== null && !isDismissed(input.dismissed, hideDiag)) out.push(hideDiag)
  }

  out.sort((a, b) => {
    const cmp = a.entityId.localeCompare(b.entityId, 'en')
    if (cmp !== 0) return cmp
    return a.type.localeCompare(b.type, 'en')
  })

  return out
}

function isDismissed(set: Set<string>, s: Suggestion): boolean {
  return set.has(`${s.entityId}|${s.type}`)
}

function trySetAreaIdSuggestion(a: RoomAssignment, entity: NormalizedEntity): Suggestion | null {
  if (entity.haAreaId !== null) return null
  if ((entity.device?.haAreaId ?? null) !== null) return null
  if (a.confidence < SET_AREA_MIN_CONFIDENCE) return null
  // Find the highest-weight signal — that's the dominant detection
  // source for this assignment.
  let dominant = a.signals[0]
  for (const s of a.signals) {
    if (dominant === undefined || s.weight > dominant.weight) dominant = s
  }
  if (dominant === undefined || !NAME_BASED_SOURCES.has(dominant.source)) return null
  return {
    entityId: a.entityId,
    type: 'set_area_id',
    matchedRoomId: a.roomId,
    message:
      'This entity has no area set in HA. Detected via its name. Set the area in HA so the assignment is permanent.',
  }
}

function tryMoveRoomSuggestion(
  a: RoomAssignment,
  override: Override | undefined,
): Suggestion | null {
  if (a.confidence >= MOVE_ROOM_MAX_CONFIDENCE) return null
  if (override?.roomId !== undefined) return null
  const alt = a.alternatives?.[0]
  if (alt === undefined) return null
  if (alt.confidence <= a.confidence - MOVE_ROOM_GAP) return null
  return {
    entityId: a.entityId,
    type: 'move_room',
    suggestedRoomId: alt.roomId,
    message: `Low-confidence assignment (${Math.round(a.confidence * 100)}%). Consider moving to a different room.`,
  }
}

function tryHideDiagnosticSuggestion(
  entity: NormalizedEntity,
  override: Override | undefined,
): Suggestion | null {
  if (entity.entityCategory !== 'diagnostic') return null
  if (entity.isHidden) return null
  if (override?.hidden === true) return null
  return {
    entityId: entity.entityId,
    type: 'hide_diagnostic',
    message: 'Diagnostic entity. Hide from the dashboard?',
  }
}
