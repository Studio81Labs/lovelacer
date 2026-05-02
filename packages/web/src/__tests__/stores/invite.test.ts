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

  describe('shouldShowGate', () => {
    it('is false initially (accepted=null, phase=idle) so the page does not flash a modal during the status check', () => {
      const store = useInviteStore()
      expect(store.shouldShowGate).toBe(false)
    })

    it('is true when loadStatus fails (network error) so the user has a recovery path instead of being stranded', async () => {
      const apiError: ApiError = { error: 'network', message: 'offline' }
      vi.mocked(getInvite).mockRejectedValueOnce(apiError)
      const store = useInviteStore()
      await store.loadStatus()
      expect(store.accepted).toBeNull()
      expect(store.phase).toBe('error')
      expect(store.shouldShowGate).toBe(true)
    })

    it('is true when accepted=false', async () => {
      vi.mocked(getInvite).mockResolvedValueOnce({ accepted: false })
      const store = useInviteStore()
      await store.loadStatus()
      expect(store.shouldShowGate).toBe(true)
    })

    it('is false when accepted=true', async () => {
      vi.mocked(getInvite).mockResolvedValueOnce({ accepted: true })
      const store = useInviteStore()
      await store.loadStatus()
      expect(store.shouldShowGate).toBe(false)
    })

    it('stays true while submit is in flight from the recovery-path gate (regression: prevents the modal from unmounting and losing the typed code)', async () => {
      // Set up the recovery state: loadStatus failed.
      vi.mocked(getInvite).mockRejectedValueOnce({ error: 'network', message: 'offline' })
      const store = useInviteStore()
      await store.loadStatus()
      expect(store.accepted).toBeNull()
      expect(store.shouldShowGate).toBe(true)

      // Hold the POST open so we can observe the in-flight state.
      let resolvePost: (value: { accepted: boolean }) => void = () => {}
      vi.mocked(postInvite).mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePost = resolve
        }),
      )

      const submission = store.submit('BETA-2026-ALPHA')
      // Mid-request: phase=submitting, accepted still null. Gate must stay
      // mounted, otherwise the InviteGate component's local `code` ref
      // (the user's typed input) is destroyed.
      expect(store.phase).toBe('submitting')
      expect(store.accepted).toBeNull()
      expect(store.shouldShowGate).toBe(true)

      // Resolve with success so the test cleans up.
      resolvePost({ accepted: true })
      await submission
      expect(store.shouldShowGate).toBe(false)
    })
  })
})
