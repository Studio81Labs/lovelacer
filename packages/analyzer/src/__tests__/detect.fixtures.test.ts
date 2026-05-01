import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { germanMassive } from '../../../../tests/fixtures/german-massive.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import { normalize } from '../normalize.js'
import { detect, buildDetectionContext } from '../detect.js'

describe('detect — english-cluttered fixture', () => {
  const ha = fixtureToHaRegistries(englishCluttered)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })

  it('produces one assignment per input entity', () => {
    expect(assignments).toHaveLength(entities.length)
  })

  it('preserves entity order', () => {
    for (let i = 0; i < entities.length; i++) {
      expect(assignments[i]!.entityId).toBe(entities[i]!.entityId)
    }
  })

  it('misc bucket size is between 10% and 30% of entities', () => {
    const miscCount = assignments.filter((a) => a.roomId === 'misc').length
    const ratio = miscCount / assignments.length
    expect(ratio, `${miscCount}/${assignments.length} entities in misc`).toBeGreaterThanOrEqual(0.1)
    expect(ratio).toBeLessThanOrEqual(0.3)
  })

  it('≥80% of entities with non-null fixture area land in their fixture-area canonical', () => {
    // english-cluttered area slugs ARE the canonical IDs (e.g. 'living_room', 'kitchen'),
    // so we can compare a.roomId directly against e.area.
    let testable = 0
    let correct = 0
    const fixtureAreaToEntityId = new Map<string, string[]>()
    for (const e of englishCluttered.entities) {
      if (e.area === null) continue
      const list = fixtureAreaToEntityId.get(e.area) ?? []
      list.push(`${e.domain}.${e.objectId}`)
      fixtureAreaToEntityId.set(e.area, list)
    }
    const assignmentByEntityId = new Map(assignments.map((a) => [a.entityId, a]))
    for (const [areaSlug, entityIds] of fixtureAreaToEntityId) {
      for (const id of entityIds) {
        const a = assignmentByEntityId.get(id)
        if (a === undefined) continue
        testable++
        if (a.roomId === areaSlug) correct++
      }
    }
    expect(testable).toBeGreaterThan(50)
    const ratio = correct / testable
    expect(ratio, `${correct}/${testable} matched`).toBeGreaterThanOrEqual(0.8)
  })
})

describe('detect — czech-tidy fixture', () => {
  const ha = fixtureToHaRegistries(czechTidy)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })

  it('produces zero misc bucket entries', () => {
    const miscCount = assignments.filter((a) => a.roomId === 'misc').length
    expect(miscCount).toBe(0)
  })

  it('every entity lands in the canonical of its fixture area', () => {
    // Build a map from fixture area ID (slug) → canonical room ID by running
    // buildDetectionContext on the HA areas. Czech area slugs differ from
    // canonical IDs (e.g. 'obyvaci_pokoj' → 'living_room'), so we must look
    // up the canonical before comparing.
    const ctx = buildDetectionContext(ha.areas)
    const areaIdToCanonical = new Map<string, string>()
    for (const [areaId, entry] of ctx.areaIndex) {
      if (entry.canonical !== null) {
        areaIdToCanonical.set(areaId, entry.canonical)
      }
    }

    const expectedById = new Map<string, string>()
    for (const e of czechTidy.entities) {
      if (e.area === null) continue
      const canonical = areaIdToCanonical.get(e.area)
      if (canonical !== undefined) {
        expectedById.set(`${e.domain}.${e.objectId}`, canonical)
      }
    }

    // Regression guard: every entity in czech-tidy MUST be testable. If
    // buildDetectionContext fails to resolve a Czech area name (e.g. because
    // ROOM_KEYWORDS doesn't cover it), expectedById would be smaller than
    // the entity count and the mismatch loop below would silently pass.
    const expectedTestableCount = czechTidy.entities.filter((e) => e.area !== null).length
    expect(expectedById.size, 'all czech-tidy entities should be testable').toBe(
      expectedTestableCount,
    )

    const mismatches: string[] = []
    for (const a of assignments) {
      const expected = expectedById.get(a.entityId)
      if (expected === undefined) continue
      if (a.roomId !== expected) {
        mismatches.push(`${a.entityId}: got ${a.roomId}, expected ${expected}`)
      }
    }
    expect(mismatches, mismatches.join('\n')).toEqual([])
  })

  it('at least 50% of fired signals reference a Czech matchedValue', () => {
    const czechMarker =
      /[áčďéěíňóřšťúůýž]|kuchyne|loznice|koupelna|obyvac|kancelar|pokoj|svetlo|teplota|vlhkost|pohyb/i
    let totalFired = 0
    let czechFired = 0
    for (const a of assignments) {
      for (const s of a.signals) {
        totalFired++
        if (s.matchedValue !== undefined && czechMarker.test(s.matchedValue)) czechFired++
      }
    }
    const ratio = czechFired / totalFired
    expect(ratio).toBeGreaterThanOrEqual(0.5)
  })
})

describe('detect — german-massive fixture', () => {
  const ha = fixtureToHaRegistries(germanMassive)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })

  it('produces one assignment per input entity', () => {
    expect(assignments).toHaveLength(entities.length)
  })

  it('preserves entity order', () => {
    for (let i = 0; i < entities.length; i++) {
      expect(assignments[i]!.entityId).toBe(entities[i]!.entityId)
    }
  })

  it('misc bucket size is at most 20% of entities', () => {
    const miscCount = assignments.filter((a) => a.roomId === 'misc').length
    const ratio = miscCount / assignments.length
    expect(ratio, `${miscCount}/${assignments.length} entities in misc`).toBeLessThanOrEqual(0.2)
  })

  it('≥85% of entities with non-null fixture area land in their fixture-area canonical', () => {
    // German area slugs differ from canonical ids (e.g. 'kueche' → 'kitchen'),
    // so we look up canonical via buildDetectionContext (same approach as
    // the czech-tidy block above).
    const ctx = buildDetectionContext(ha.areas)
    const areaIdToCanonical = new Map<string, string>()
    for (const [areaId, entry] of ctx.areaIndex) {
      if (entry.canonical !== null) {
        areaIdToCanonical.set(areaId, entry.canonical)
      }
    }

    const expectedById = new Map<string, string>()
    const haEntityById = new Map(ha.entities.map((e) => [e.entity_id, e]))
    for (const e of germanMassive.entities) {
      const haEntity = haEntityById.get(`${e.domain}.${e.objectId}`)
      const haAreaId = haEntity?.area_id ?? null
      if (haAreaId === null) continue
      const canonical = areaIdToCanonical.get(haAreaId)
      if (canonical === undefined) continue
      expectedById.set(`${e.domain}.${e.objectId}`, canonical)
    }

    let testable = 0
    let correct = 0
    const assignmentByEntityId = new Map(assignments.map((a) => [a.entityId, a]))
    for (const [id, expected] of expectedById) {
      const a = assignmentByEntityId.get(id)
      if (a === undefined) continue
      testable++
      if (a.roomId === expected) correct++
    }
    expect(testable).toBeGreaterThan(60)
    const ratio = correct / testable
    expect(ratio, `${correct}/${testable} matched`).toBeGreaterThanOrEqual(0.85)
  })

  it('all Bad EG and Bad OG entities resolve to bathroom', () => {
    const ctx = buildDetectionContext(ha.areas)
    const bathroomAreaIds: string[] = []
    for (const [areaId, entry] of ctx.areaIndex) {
      if (entry.canonical === 'bathroom') bathroomAreaIds.push(areaId)
    }
    expect(
      bathroomAreaIds.length,
      'fixture should declare two bathroom-canonical areas (Bad EG, Bad OG)',
    ).toBeGreaterThanOrEqual(2)

    const assignmentByEntityId = new Map(assignments.map((a) => [a.entityId, a]))
    for (const e of ha.entities) {
      if (e.area_id === null) continue
      if (!bathroomAreaIds.includes(e.area_id)) continue
      const a = assignmentByEntityId.get(e.entity_id)
      expect(a?.roomId, `${e.entity_id} should be bathroom`).toBe('bathroom')
    }
  })

  it('Hobbyraum entities fall through to misc (non-canonical room)', () => {
    const ctx = buildDetectionContext(ha.areas)
    let hobbyAreaId: string | null = null
    for (const [areaId, entry] of ctx.areaIndex) {
      if (entry.name === 'Hobbyraum') {
        hobbyAreaId = areaId
        break
      }
    }
    expect(hobbyAreaId, 'Hobbyraum area should exist').not.toBeNull()

    const assignmentByEntityId = new Map(assignments.map((a) => [a.entityId, a]))
    for (const e of ha.entities) {
      if (e.area_id !== hobbyAreaId) continue
      const a = assignmentByEntityId.get(e.entity_id)
      expect(a?.roomId, `${e.entity_id} should be misc`).toBe('misc')
    }
  })
})
