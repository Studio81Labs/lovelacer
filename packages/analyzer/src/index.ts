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
 *   - P1a-4: confidence.ts (scoring + corroboration)
 *   - P1a-5: grouping.ts (domain grouping within rooms)
 *
 * Public entry point will be analyze(registries) -> AnalysisResult.
 */
export const ANALYZER_VERSION = '0.0.0'
