import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const FIXTURE_INCLUDE_SENTINEL = '# lovelacer:fixtures'

const DEFAULT_BODY = `default_config:

${FIXTURE_INCLUDE_SENTINEL}
homeassistant: !include lovelacer-fixtures.yaml
`

const APPEND_BLOCK = `
${FIXTURE_INCLUDE_SENTINEL}
homeassistant: !include lovelacer-fixtures.yaml
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
