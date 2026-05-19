export type ScreenshotMode = 'dark' | 'light'

export interface ScreenshotModeSource {
  isDark: boolean
  hasDocumentClass?: (className: string) => boolean
}

export interface ScreenshotSourceOptions {
  name: string
  darkName?: string
  ext?: 'png' | 'jpg' | 'svg' | 'webp'
  singleSource?: boolean
}

export function getScreenshotMode(source: ScreenshotModeSource): ScreenshotMode {
  if (source.hasDocumentClass?.('dark')) {
    return 'dark'
  }

  if (source.hasDocumentClass?.('light')) {
    return 'light'
  }

  return source.isDark ? 'dark' : 'light'
}

export function getScreenshotSource(
  options: ScreenshotSourceOptions,
  mode: ScreenshotMode,
): string {
  const ext = options.ext ?? 'png'

  if (options.singleSource) {
    return `/screenshots/${options.name}.${ext}`
  }

  if (mode === 'dark') {
    return `/screenshots/${options.darkName ?? options.name}-dark.${ext}`
  }

  return `/screenshots/${options.name}-light.${ext}`
}
