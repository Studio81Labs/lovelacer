import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectInitialLocale } from '../locale-detect.js'

describe('detectInitialLocale', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns the cached locale when set in localStorage', () => {
    localStorage.setItem('lovelacer.uiLocale', 'de')
    expect(detectInitialLocale()).toBe('de')
  })

  it('falls back to navigator.language prefix when no cache', () => {
    Object.defineProperty(navigator, 'language', { value: 'cs-CZ', configurable: true })
    expect(detectInitialLocale()).toBe('cs')
  })

  it('handles uppercase navigator.language prefix', () => {
    Object.defineProperty(navigator, 'language', { value: 'DE-AT', configurable: true })
    expect(detectInitialLocale()).toBe('de')
  })

  it('falls back to en when navigator.language is unsupported', () => {
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true })
    expect(detectInitialLocale()).toBe('en')
  })

  it('rejects malicious or invalid localStorage values and falls through', () => {
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true })
    localStorage.setItem('lovelacer.uiLocale', '__proto__')
    expect(detectInitialLocale()).toBe('en')
  })

  it('handles localStorage unavailability gracefully', () => {
    Object.defineProperty(navigator, 'language', { value: 'cs-CZ', configurable: true })
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage disabled')
    })
    expect(detectInitialLocale()).toBe('cs')
    spy.mockRestore()
  })
})
