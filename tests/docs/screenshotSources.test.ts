import { describe, expect, it } from 'vitest'

import {
  getScreenshotMode,
  getScreenshotSource,
  type ScreenshotModeSource,
} from '../../apps/docs/src/.vitepress/theme/components/screenshotSources'

function modeSource(classes: string[], isDark: boolean): ScreenshotModeSource {
  return {
    isDark,
    hasDocumentClass(className) {
      return classes.includes(className)
    },
  }
}

describe('screenshotSources', () => {
  it('uses the document dark class when VitePress isDark has not caught up after reload', () => {
    expect(getScreenshotMode(modeSource(['dark'], false))).toBe('dark')
  })

  it('uses the document light class over a stale dark VitePress value', () => {
    expect(getScreenshotMode(modeSource(['light'], true))).toBe('light')
  })

  it('falls back to the VitePress value when no document class is available', () => {
    expect(getScreenshotMode(modeSource([], true))).toBe('dark')
    expect(getScreenshotMode(modeSource([], false))).toBe('light')
  })

  it('builds light, dark, custom dark, and single-source screenshot paths', () => {
    expect(getScreenshotSource({ name: 'room-list', ext: 'png' }, 'light')).toBe(
      '/screenshots/room-list-light.png',
    )
    expect(getScreenshotSource({ name: 'room-list', ext: 'png' }, 'dark')).toBe(
      '/screenshots/room-list-dark.png',
    )
    expect(getScreenshotSource({ name: 'entity-overrides', darkName: 'room-detail' }, 'dark')).toBe(
      '/screenshots/room-detail-dark.png',
    )
    expect(getScreenshotSource({ name: 'empty-state', singleSource: true }, 'dark')).toBe(
      '/screenshots/empty-state.png',
    )
  })
})
