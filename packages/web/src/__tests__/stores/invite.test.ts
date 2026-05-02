import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useInviteStore } from '../../stores/invite.js'
import type { ApiError } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
  getInvite: vi.fn(),
  postInvite: vi.fn(),
}))

const { getInvite, postInvite } = await import('../../api/client.js')

describe('useInviteStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getInvite).mockReset()
    vi.mocked(postInvite).mockReset()
  })

  it('starts with accepted=null, phase=idle, error=null', () => {
    const store = useInviteStore()
    expect(store.accepted).toBeNull()
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
  })

  it('loadStatus sets accepted from server response', async () => {
    vi.mocked(getInvite).mockResolvedValueOnce({ accepted: true })
    const store = useInviteStore()
    await store.loadStatus()
    expect(store.accepted).toBe(true)
    expect(store.phase).toBe('idle')
  })

  it('loadStatus on error sets phase=error and preserves prior accepted', async () => {
    const apiError: ApiError = { error: 'network', message: 'offline' }
    vi.mocked(getInvite).mockRejectedValueOnce(apiError)
    const store = useInviteStore()
    await store.loadStatus()
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiError)
    expect(store.accepted).toBeNull() // unchanged from initial
  })

  it('submit with valid code sets accepted=true', async () => {
    vi.mocked(postInvite).mockResolvedValueOnce({ accepted: true })
    const store = useInviteStore()
    await store.submit('BETA-2026-ALPHA')
    expect(store.accepted).toBe(true)
    expect(store.phase).toBe('idle')
  })

  it('submit with wrong code sets phase=error, preserves accepted', async () => {
    const apiError: ApiError = {
      error: 'invalid_code',
      message: 'Invite code not recognized.',
    }
    vi.mocked(postInvite).mockRejectedValueOnce(apiError)
    const store = useInviteStore()
    await store.submit('WRONG-CODE')
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiError)
    expect(store.accepted).toBeNull() // unchanged
  })
})
