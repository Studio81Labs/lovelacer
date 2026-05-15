import { describe, expect, it } from 'vitest'
import { resolveRoomDisplay } from '@lovelacer/generator'

describe('@lovelacer/generator package exports', () => {
  it('exposes room display helpers used by the server pipeline', () => {
    expect(resolveRoomDisplay('kitchen').title).toBe('Kitchen')
  })
})
