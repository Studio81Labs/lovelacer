import { describe, expect, it, vi } from 'vitest'
import { isEmbeddedInFrame, openHomeAssistantPath } from '../navigation.js'

describe('navigation helpers', () => {
  it('detects a top-level window', () => {
    const self = {}
    const win = { self, top: self }

    expect(isEmbeddedInFrame(win)).toBe(false)
  })

  it('detects an embedded iframe window', () => {
    const win = { self: {}, top: {} }

    expect(isEmbeddedInFrame(win)).toBe(true)
  })

  it('treats inaccessible top windows as embedded', () => {
    const win = { self: {} }
    Object.defineProperty(win, 'top', {
      get() {
        throw new Error('cross-origin frame access denied')
      },
    })

    expect(isEmbeddedInFrame(win)).toBe(true)
  })

  it('opens HA paths in the top frame when embedded', () => {
    const open = vi.fn()
    const win = { self: {}, top: {}, open }

    openHomeAssistantPath('/lovelacer-home', win)

    expect(open).toHaveBeenCalledWith('/lovelacer-home', '_top')
  })

  it('opens HA paths in a new tab when already top-level', () => {
    const self = {}
    const open = vi.fn()
    const win = { self, top: self, open }

    openHomeAssistantPath('/lovelacer-home', win)

    expect(open).toHaveBeenCalledWith('/lovelacer-home', '_blank')
  })
})
