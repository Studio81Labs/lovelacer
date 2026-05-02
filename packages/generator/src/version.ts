/**
 * Generator package version. Bumped manually with each meaningful release.
 *
 * Lives in its own module to break the cycle that would otherwise exist
 * between `index.ts` (re-exports from `yaml-export.ts`) and `yaml-export.ts`
 * (needs the version for the YAML header).
 */
export const GENERATOR_VERSION = '0.0.0'
