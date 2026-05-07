/**
 * P2-9 — first-paint locale detection.
 *
 * Priority chain:
 *   1. localStorage cache (instant first-paint, no flash on reload)
 *   2. navigator.language prefix matched against supported locales
 *      (e.g. 'cs-CZ' → 'cs', 'de-AT' → 'de', 'fr-FR' → null → fallback)
 *   3. fallback to English
 *
 * Settings.uiLanguage from the server only takes effect AFTER first paint,
 * via a Pinia watcher that reconciles server state with the cached value
 * once `useSettingsStore.loadFromServer()` resolves.
 */
import type { UiLocale } from './index.js'

const SUPPORTED: readonly UiLocale[] = ['en', 'cs', 'de']

function isSupported(value: unknown): value is UiLocale {
  return typeof value === 'string' && (SUPPORTED as readonly string[]).includes(value)
}

export function detectInitialLocale(): UiLocale {
  try {
    const cached = localStorage.getItem('lovelacer.uiLocale')
    if (isSupported(cached)) return cached
  } catch {
    // localStorage unavailable (private-mode quirks); fall through.
  }
  const prefix = navigator.language.split('-')[0]?.toLowerCase()
  if (isSupported(prefix)) return prefix
  return 'en'
}
