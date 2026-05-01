import type { CanonicalRoomId } from './constants.js'

/**
 * User-specified override for a single entity. At least one of `roomId`
 * or `hidden` must be set (enforced by API zod validator and DB CHECK
 * constraint).
 *
 * - `roomId` set: assignment is moved to that room (`confidence` becomes
 *   `1.0` and `manual: true` on the resulting `RoomAssignment`).
 * - `hidden: true`: entity is OR-merged into `NormalizedEntity.isHidden`
 *   so existing hidden filters drop it from views.
 *
 * P1b-3 storage in SQLite; P1b-4 frontend UI.
 */
export interface Override {
  entityId: string
  roomId?: CanonicalRoomId
  hidden?: boolean
}
