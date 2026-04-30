/**
 * @lovelacer/analyzer
 *
 * Pure functions for analyzing HA registry data and assigning entities
 * to rooms with confidence scores.
 *
 * Implementation lands in:
 *   - P1a-1: normalize.ts
 *   - P1a-2: keywords.ts (room keyword database, EN+CS for 1a)
 *   - P1a-3: detect.ts (priority chain)
 *   - P1a-4: detect.ts assemble() — corroboration boost
 *   - P1a-5: grouping.ts (domain grouping within rooms)
 */
export const ANALYZER_VERSION = '0.0.0'
export { normalize } from './normalize.js'
export type { NormalizeInput } from './normalize.js'
export { findRoom } from './match-room.js'
export type { FindRoomOptions, RoomMatch } from './match-room.js'
export { buildDetectionContext, detect, detectEntity } from './detect.js'
export type { AreaIndexEntry, DetectInput, DetectionContext } from './detect.js'
export { domainGroup, groupByDomain } from './grouping.js'
export type { DomainGroupKey, DomainGroup, GroupByDomainInput, RoomGrouping } from './grouping.js'
