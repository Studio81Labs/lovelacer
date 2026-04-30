import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import type { Fixture } from '../../tests/fixtures/_builder/types.js'
import {
  serializeStorage,
  serializeTemplateYaml,
} from '../../tests/fixtures/_builder/index.js'
import { backupRegistries } from './_loader/backup.js'
import { ensureFixtureInclude } from './_loader/config-yaml.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const HA_CONFIG = join(REPO_ROOT, 'dev', 'ha-config')
const COMPOSE_FILE = join(REPO_ROOT, 'dev', 'ha-stack.yml')
const FIXTURES_DIR = join(REPO_ROOT, 'tests', 'fixtures')

async function main(): Promise<void> {
  const name = process.argv[2]
  if (!name) {
    printUsage()
    process.exit(1)
  }

  const fixturePath = join(FIXTURES_DIR, `${name}.ts`)
  if (!existsSync(fixturePath)) {
    console.error(`fixture not found: ${name}\n`)
    printUsage()
    process.exit(1)
  }

  if (!existsSync(HA_CONFIG) || !existsSync(join(HA_CONFIG, '.storage', 'auth'))) {
    console.error(
      `dev/ha-config not initialized — run 'pnpm dev:ha' and complete onboarding first.\n` +
        `See dev/README.md for the full first-run flow.`,
    )
    process.exit(2)
  }

  const fx = await loadFixture(fixturePath)
  console.log(`loaded fixture: ${fx.meta.name}`)
  console.log(
    `  ${fx.floors.length} floors · ${fx.areas.length} areas · ` +
      `${fx.devices.length} devices · ${fx.entities.length} entities`,
  )

  stopHa()

  const backup = backupRegistries(HA_CONFIG)
  if (backup) console.log(`backed up previous registries → ${backup}`)

  const storage = serializeStorage(fx)
  const storageDir = join(HA_CONFIG, '.storage')
  mkdirSync(storageDir, { recursive: true })
  for (const [key, env] of Object.entries(storage)) {
    writeFileSync(join(storageDir, key), JSON.stringify(env, null, 2))
  }
  console.log(`wrote 4 registry files to ${storageDir}`)

  const yaml = serializeTemplateYaml(fx)
  writeFileSync(join(HA_CONFIG, 'lovelacer-fixtures.yaml'), yaml)
  ensureFixtureInclude(HA_CONFIG)
  console.log('wrote lovelacer-fixtures.yaml + ensured configuration.yaml include')

  startHa()
  await waitForHealthy()

  console.log('\n✓ fixture loaded — HA is running at http://localhost:8123')
  console.log('  HA_TOKEN in .env is unaffected.\n')
}

function printUsage(): void {
  const available = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_'))
    .map((f) => f.replace(/\.ts$/, ''))
  console.error('Usage: pnpm fixtures:load <name>\n')
  console.error('Available fixtures:')
  for (const f of available) console.error(`  - ${f}`)
}

async function loadFixture(path: string): Promise<Fixture> {
  const mod = (await import(path)) as Record<string, unknown>
  for (const value of Object.values(mod)) {
    if (isFixture(value)) return value
  }
  throw new Error(`no Fixture export found in ${path}`)
}

function isFixture(value: unknown): value is Fixture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'meta' in value &&
    'floors' in value &&
    'areas' in value &&
    'devices' in value &&
    'entities' in value
  )
}

function stopHa(): void {
  const result = spawnSync('docker', ['compose', '-f', COMPOSE_FILE, 'stop', 'homeassistant'], {
    stdio: 'inherit',
  })
  if (result.error) {
    console.error('docker not available — is Docker installed?')
    process.exit(3)
  }
}

function startHa(): void {
  const result = spawnSync('docker', ['compose', '-f', COMPOSE_FILE, 'start', 'homeassistant'], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error('failed to start HA container')
    process.exit(4)
  }
}

async function waitForHealthy(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastStatus = ''
  while (Date.now() < deadline) {
    const out = spawnSync(
      'docker',
      ['inspect', '--format', '{{.State.Health.Status}}', 'lovelacer-dev-ha'],
      { encoding: 'utf8' },
    )
    lastStatus = (out.stdout ?? '').trim()
    if (lastStatus === 'healthy') return
    await sleep(2000)
  }
  console.warn(
    `warning: HA healthcheck did not report 'healthy' within ${timeoutMs}ms (last: ${lastStatus})`,
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

main().catch((err) => {
  console.error(err)
  process.exit(99)
})
