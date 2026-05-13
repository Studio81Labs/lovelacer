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
export { GENERATOR_VERSION } from './version.js'
export { buildRoomView, buildRoomViews } from './room-view.js'
export { resolveRoomDisplay, shouldShowRoomNameOnCard } from './rooms.js'
export type { RoomDisplayOverrides } from './rooms.js'
export type {
  ConditionalCard,
  ConditionEntry,
  CoverOpenCloseFeature,
  EntitiesCard,
  FanSpeedFeature,
  GlanceCard,
  GlanceEntityEntry,
  GridSection,
  HeadingCard,
  LightBrightnessFeature,
  LovelaceCard,
  MarkdownCard,
  MediaControlCard,
  NavigateAction,
  OrCondition,
  PictureEntityCard,
  RoomView,
  StateCondition,
  ThermostatCard,
  TileCard,
  TileFeature,
} from './lovelace-types.js'
export { buildHomeView, buildRoomsByFloorSection, pickQuickStatsEntities } from './home-view.js'
export type { BuildHomeViewInput, BuildRoomsByFloorSectionInput, HomeView } from './home-view.js'
export { buildLovelaceConfig } from './lovelace-config.js'
export type { BuildLovelaceConfigInput, LovelaceConfig } from './lovelace-config.js'
export { configToYaml } from './yaml-export.js'
export type { ConfigToYamlOptions } from './yaml-export.js'
