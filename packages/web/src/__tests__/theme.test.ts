import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyThemeToDocument, currentSystemPrefersDark, resolveTheme } from '../theme.js'

describe('theme helpers', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  it('falls back to light system preference when matchMedia is unavailable', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia

    expect(currentSystemPrefersDark()).toBe(false)
    expect(resolveTheme('system')).toBe('light')
  })

  it('applies explicit themes without requiring matchMedia', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia

    expect(() => applyThemeToDocument('dark')).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('uses matchMedia for system theme when available', () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia

    expect(resolveTheme('system')).toBe('dark')
  })
})
