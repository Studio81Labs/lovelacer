import type { SettingsTheme } from './api/types.js'

export type ResolvedTheme = 'light' | 'dark'

export function currentSystemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function resolveTheme(
  theme: SettingsTheme,
  systemPrefersDark = currentSystemPrefersDark(),
): ResolvedTheme {
  return theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme
}

export function applyThemeToDocument(
  theme: SettingsTheme,
  systemPrefersDark = currentSystemPrefersDark(),
): ResolvedTheme {
  const resolved = resolveTheme(theme, systemPrefersDark)
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  return resolved
}
