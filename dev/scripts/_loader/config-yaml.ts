import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const FIXTURE_INCLUDE_SENTINEL = '# lovelacer:fixtures'

/**
 * The included file emits a list of per-domain template groups (without a
 * leading `template:` key). We attach it via `template: !include …` so HA's
 * include directive resolves the file content under the canonical key.
 */
const INCLUDE_LINE = 'template: !include lovelacer-fixtures.yaml'

const DEFAULT_BODY = `default_config:

${FIXTURE_INCLUDE_SENTINEL}
${INCLUDE_LINE}
`

const APPEND_BLOCK = `
${FIXTURE_INCLUDE_SENTINEL}
${INCLUDE_LINE}
`

export function ensureFixtureInclude(haConfigDir: string): void {
  const path = join(haConfigDir, 'configuration.yaml')

  if (!existsSync(path)) {
    writeFileSync(path, DEFAULT_BODY)
    return
  }

  const current = readFileSync(path, 'utf8')
  if (current.includes(FIXTURE_INCLUDE_SENTINEL)) return

  const trailing = current.endsWith('\n') ? '' : '\n'
  writeFileSync(path, current + trailing + APPEND_BLOCK)
}
