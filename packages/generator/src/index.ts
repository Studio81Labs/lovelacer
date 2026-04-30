/**
 * @lovelacer/generator
 *
 * Builds Lovelace dashboard configurations from analyzer output.
 *
 * Implementation lands in:
 *   - P1a-6: room-view.ts (per-room sections layout)
 *   - P1a-7: home-view.ts (overview view, minimal in 1a)
 *   - P1a-8: storage-apply.ts (lovelace/config/save mechanics)
 *   - P1b-2: full domain card mappings
 *   - P1b-5: full home overview composition
 *   - Phase 2: yaml-export.ts (proper YAML serialization)
 *
 * Future packages/generator-smartpanel will be a sibling using the
 * same analyzer output. See SMART_PANEL_BRIDGE.md.
 */
export const GENERATOR_VERSION = '0.0.0'
export { buildRoomView, buildRoomViews } from './room-view.js'
export type {
  EntitiesCard,
  GlanceCard,
  GridSection,
  HeadingCard,
  LovelaceCard,
  MarkdownCard,
  RoomView,
  ThermostatCard,
  TileCard,
  TileFeature,
} from './lovelace-types.js'
