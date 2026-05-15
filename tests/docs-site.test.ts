import { describe, expect, test } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()

const readText = (path: string): string => readFileSync(join(repoRoot, path), 'utf8')

describe('docs site workspace', () => {
  test('defines a static docs package with build and preview scripts', () => {
    const packagePath = 'apps/docs/package.json'

    expect(existsSync(join(repoRoot, packagePath))).toBe(true)

    const packageJson = JSON.parse(readText(packagePath)) as {
      name?: string
      private?: boolean
      scripts?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    expect(packageJson.name).toBe('@lovelacer/docs')
    expect(packageJson.private).toBe(true)
    expect(packageJson.scripts?.build).toBe('vitepress build src')
    expect(packageJson.scripts?.dev).toBe('vitepress dev src --host 0.0.0.0')
    expect(packageJson.scripts?.preview).toBe('vitepress preview src --host 0.0.0.0')
    expect(packageJson.devDependencies?.vitepress).toBeDefined()
  })

  test('publishes the Phase 2 docs content required by the roadmap', () => {
    const requiredPages = [
      'apps/docs/src/index.md',
      'apps/docs/src/install/supervised.md',
      'apps/docs/src/install/standalone-docker.md',
      'apps/docs/src/architecture.md',
      'apps/docs/src/faq.md',
    ]

    for (const page of requiredPages) {
      expect(existsSync(join(repoRoot, page)), page).toBe(true)
    }

    expect(readText('apps/docs/src/install/supervised.md')).toContain('Home Assistant Supervised')
    expect(readText('apps/docs/src/install/standalone-docker.md')).toContain('standalone Docker')
    expect(readText('apps/docs/src/architecture.md')).toContain('@lovelacer/ha-client')
    expect(readText('apps/docs/src/faq.md')).toContain('AI features')
  })

  test('builds in CI and deploys to Cloudflare Workers from main', () => {
    const ciWorkflow = readText('.github/workflows/ci.yml')
    const deployWorkflow = readText('.github/workflows/docs-pages.yml')
    const wranglerConfig = readText('apps/docs/wrangler.jsonc')

    expect(ciWorkflow).toContain('pnpm build')
    expect(deployWorkflow).toContain('Deploy documentation to Cloudflare Workers')
    expect(deployWorkflow).toContain('node-version: 22')
    expect(deployWorkflow).toContain('pnpm --filter @lovelacer/docs build')
    expect(deployWorkflow).toContain('pnpm dlx wrangler@latest deploy --name "$WORKER_NAME"')
    expect(deployWorkflow).toContain('DOCS_WORKER_NAME')
    expect(deployWorkflow).toContain('DOCS_WORKERS_SUBDOMAIN')
    expect(deployWorkflow).toContain('CLOUDFLARE_ACCOUNT_ID')
    expect(deployWorkflow).toContain('CLOUDFLARE_API_TOKEN')

    expect(wranglerConfig).toContain('"compatibility_date": "2026-05-15"')
    expect(wranglerConfig).toContain('"directory": "./src/.vitepress/dist"')
    expect(wranglerConfig).toContain('"not_found_handling": "404-page"')
    expect(wranglerConfig).toContain('"html_handling": "auto-trailing-slash"')
  })
})
