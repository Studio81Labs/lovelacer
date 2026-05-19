import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

describe('Home Assistant add-on runtime image', () => {
  it('uses the same add-on base family as Smart Panel', () => {
    const build = parse(readFileSync(resolve('apps/addon/build.yaml'), 'utf8')) as {
      build_from?: Record<string, string>
    }

    expect(build.build_from).toEqual({
      aarch64: 'ghcr.io/hassio-addons/base:17.2.4',
      amd64: 'ghcr.io/hassio-addons/base:17.2.4',
    })
  })

  it('uses the official Node 24 runtime instead of Alpine packaged nodejs', () => {
    const dockerfile = readFileSync(resolve('apps/addon/Dockerfile'), 'utf8')

    expect(dockerfile).toContain('ARG BUILD_FROM=ghcr.io/hassio-addons/base:17.2.4')
    expect(dockerfile).toContain('FROM node:24-alpine3.21 AS node-runtime')
    expect(dockerfile).toContain('COPY --from=node-runtime /usr/local/bin/node')
    expect(dockerfile).not.toContain('apk add --no-cache nodejs')
  })

  it('rebuilds native modules before entering the Home Assistant base image', () => {
    const dockerfile = readFileSync(resolve('apps/addon/Dockerfile'), 'utf8')

    expect(dockerfile).toContain('FROM node:24-alpine3.21 AS native-rebuild')
    expect(dockerfile).toContain('RUN npm rebuild better-sqlite3')
    expect(dockerfile).toContain('COPY --from=native-rebuild /app ./')
    expect(dockerfile).not.toContain('--virtual .lovelacer-build-deps')
    expect(dockerfile).not.toContain('--virtual .build-deps')
  })
})
