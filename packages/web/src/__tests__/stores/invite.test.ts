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

  it('starts accepted for public access, phase=idle, error=null', () => {
    const store = useInviteStore()
    expect(store.accepted).toBe(true)
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

  it('loadStatus on error preserves public access and records the error', async () => {
    const apiError: ApiError = { error: 'network', message: 'offline' }
    vi.mocked(getInvite).mockRejectedValueOnce(apiError)
    const store = useInviteStore()
    await store.loadStatus()
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiError)
    expect(store.accepted).toBe(true)
  })

  it('submit with valid code sets accepted=true', async () => {
    vi.mocked(postInvite).mockResolvedValueOnce({ accepted: true })
    const store = useInviteStore()
    await store.submit('BETA-2026-ALPHA')
    expect(store.accepted).toBe(true)
    expect(store.phase).toBe('idle')
  })

  it('submit with wrong code sets phase=error, preserves public access', async () => {
    const apiError: ApiError = {
      error: 'invalid_code',
      message: 'Invite code not recognized.',
    }
    vi.mocked(postInvite).mockRejectedValueOnce(apiError)
    const store = useInviteStore()
    await store.submit('WRONG-CODE')
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiError)
    expect(store.accepted).toBe(true)
  })

  describe('shouldShowGate', () => {
    it('is false initially because the invite gate is no longer shown', () => {
      const store = useInviteStore()
      expect(store.shouldShowGate).toBe(false)
    })

    it('is false when loadStatus fails because public access no longer uses the invite modal as recovery UI', async () => {
      const apiError: ApiError = { error: 'network', message: 'offline' }
      vi.mocked(getInvite).mockRejectedValueOnce(apiError)
      const store = useInviteStore()
      await store.loadStatus()
      expect(store.accepted).toBe(true)
      expect(store.phase).toBe('error')
      expect(store.shouldShowGate).toBe(false)
    })

    it('is false even when a legacy server reports accepted=false', async () => {
      vi.mocked(getInvite).mockResolvedValueOnce({ accepted: false })
      const store = useInviteStore()
      await store.loadStatus()
      expect(store.shouldShowGate).toBe(false)
    })

    it('is false when accepted=true', async () => {
      vi.mocked(getInvite).mockResolvedValueOnce({ accepted: true })
      const store = useInviteStore()
      await store.loadStatus()
      expect(store.shouldShowGate).toBe(false)
    })

    it('stays false while submit is in flight from the retired gate path', async () => {
      vi.mocked(getInvite).mockRejectedValueOnce({ error: 'network', message: 'offline' })
      const store = useInviteStore()
      await store.loadStatus()
      expect(store.accepted).toBe(true)
      expect(store.shouldShowGate).toBe(false)

      // Hold the POST open so we can observe the in-flight state.
      let resolvePost: (value: { accepted: boolean }) => void = () => {}
      vi.mocked(postInvite).mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePost = resolve
        }),
      )

      const submission = store.submit('BETA-2026-ALPHA')
      expect(store.phase).toBe('submitting')
      expect(store.accepted).toBe(true)
      expect(store.shouldShowGate).toBe(false)

      // Resolve with success so the test cleans up.
      resolvePost({ accepted: true })
      await submission
      expect(store.shouldShowGate).toBe(false)
    })
  })
})
