import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import App from '../App.vue'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useOverridesStore } from '../stores/overrides.js'
import type { PreviewOutput } from '../api/types.js'

vi.mock('../api/client.js', () => ({
  postPreview: vi.fn(),
  postApply: vi.fn(),
  getOverrides: vi.fn(),
  putOverrides: vi.fn(),
  getInvite: vi.fn(),
  postInvite: vi.fn(),
}))

const { postPreview, getOverrides, putOverrides, getInvite, postInvite } =
  await import('../api/client.js')

const mockPreview: PreviewOutput = {
  rooms: [
    {
      id: 'kitchen',
      haAreaId: 'kitchen',
      displayName: 'Kitchen',
      entityCount: 1,
      averageConfidence: 0.9,
      assignments: [
        { entityId: 'light.kitchen_ceiling', roomId: 'kitchen', confidence: 0.9, signals: [] },
      ],
    },
  ],
  misc: [],
  summary: { entityCount: 1, roomCount: 1, miscCount: 0 },
  config: { title: 'Lovelacer — Home', views: [] },
  diff: null,
}

describe('App integration', () => {
  beforeEach(() => {
    vi.mocked(postPreview).mockReset()
    vi.mocked(getOverrides).mockReset()
    vi.mocked(putOverrides).mockReset()
    vi.mocked(getInvite).mockReset()
    // Default: most existing tests assume the gate is already accepted.
    // Tests that need accepted=false will override this.
    vi.mocked(getInvite).mockResolvedValue({ accepted: true })
  })

  it('triggers loadFromServer when analyze.phase transitions to ready', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({ overrides: [] })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    const analyze = useAnalyzeStore()

    // Simulate a successful analyze
    analyze.$patch({ phase: 'ready', preview: mockPreview })
    await wrapper.vm.$nextTick()

    expect(getOverrides).toHaveBeenCalledOnce()
  })

  it('loadFromServer fires once even on multiple ready transitions', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({ overrides: [] })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    const analyze = useAnalyzeStore()

    analyze.$patch({ phase: 'ready', preview: mockPreview })
    await wrapper.vm.$nextTick()
    analyze.$patch({ phase: 'loading' })
    await wrapper.vm.$nextTick()
    analyze.$patch({ phase: 'ready' })
    await wrapper.vm.$nextTick()

    // Only the first ready transition triggers the load.
    expect(getOverrides).toHaveBeenCalledOnce()
  })

  it('renders DiffBanner, room badges, and entity tags when preview includes a diff', async () => {
    const previewWithDiff: PreviewOutput = {
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          entityCount: 2,
          averageConfidence: 0.9,
          assignments: [
            {
              entityId: 'light.kitchen_ceiling',
              roomId: 'kitchen',
              confidence: 0.9,
              signals: [],
            },
            { entityId: 'light.new_lamp', roomId: 'kitchen', confidence: 0.9, signals: [] },
          ],
        },
      ],
      misc: [],
      summary: { entityCount: 2, roomCount: 1, miscCount: 0 },
      config: { title: 'x', views: [] },
      diff: {
        entities: [
          {
            entityId: 'light.new_lamp',
            kind: 'added',
            currentRoomId: 'kitchen',
          },
          {
            entityId: 'light.guest_lamp',
            kind: 'removed',
            previousRoomId: 'guest_room',
          },
        ],
        perRoom: { kitchen: { added: 1, movedIn: 0, movedOut: 0 } },
        totals: { added: 1, moved: 0, removed: 1 },
        appliedAt: Math.floor(Date.now() / 1000),
      },
    }

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    const analyze = useAnalyzeStore()
    analyze.$patch({ phase: 'ready', preview: previewWithDiff })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="diff-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diff-banner-added"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="diff-banner-removed"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="removed-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-diff-added"]').text()).toContain('1')
    // Open the room details to render the entity rows
    await wrapper.find('details').trigger('click')
    const tags = wrapper.findAll('[data-testid="entity-diff-tag"]')
    expect(tags.some((t) => t.text() === 'New')).toBe(true)
  })

  it('end-to-end: edit → save → re-analyze flow', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({ overrides: [] })
    vi.mocked(putOverrides).mockResolvedValueOnce({
      overrides: [{ entityId: 'light.kitchen_ceiling', roomId: 'living_room' }],
    })
    vi.mocked(postPreview).mockResolvedValueOnce(mockPreview)

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    const analyze = useAnalyzeStore()
    const overrides = useOverridesStore()

    // Bring app to ready state
    analyze.$patch({ phase: 'ready', preview: mockPreview })
    await wrapper.vm.$nextTick()

    // User edits
    overrides.setRoomId('light.kitchen_ceiling', 'living_room')
    await wrapper.vm.$nextTick()

    // OverridesBar visible with 1 pending change
    expect(wrapper.find('[data-testid="overrides-bar"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('1 pending change')

    // User clicks Save
    await wrapper.find('[data-testid="save-button"]').trigger('click')
    // Wait for async save + reanalyze chain
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(putOverrides).toHaveBeenCalledWith({
      overrides: [{ entityId: 'light.kitchen_ceiling', roomId: 'living_room' }],
    })
    expect(postPreview).toHaveBeenCalled()
  })
})

describe('App invite gate', () => {
  beforeEach(() => {
    vi.mocked(getInvite).mockReset()
  })

  it('calls invite.loadStatus on mount', async () => {
    vi.mocked(getInvite).mockResolvedValueOnce({ accepted: true })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    await wrapper.vm.$nextTick()

    expect(getInvite).toHaveBeenCalledOnce()
  })

  it('renders InviteGate when accepted === false', async () => {
    vi.mocked(getInvite).mockResolvedValueOnce({ accepted: false })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(true)
  })

  it('does not render InviteGate when accepted === true', async () => {
    vi.mocked(getInvite).mockResolvedValueOnce({ accepted: true })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(false)
  })

  it('does not render InviteGate while accepted === null (loading state)', () => {
    // Don't resolve the mock; accepted stays null.
    vi.mocked(getInvite).mockReturnValue(new Promise(() => {})) // never resolves

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })

    // Synchronously: no modal yet because we haven't resolved.
    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(false)
  })

  it('renders InviteGate when loadStatus fails (network error) so the user is not stranded', async () => {
    // Without this fallback, accepted stays null forever and every other
    // API call returns 403 invite_required — page refresh is the only out.
    vi.mocked(getInvite).mockRejectedValueOnce({ error: 'network', message: 'offline' })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(true)
  })

  it('keeps the typed code in the gate input while a submit from the recovery gate is in flight (regression: gate must not unmount)', async () => {
    // Set up the recovery path: initial loadStatus fails so the gate
    // surfaces with accepted=null + phase=error.
    vi.mocked(getInvite).mockRejectedValueOnce({ error: 'network', message: 'offline' })
    // Hold the POST open so we can observe the in-flight render.
    vi.mocked(postInvite).mockReturnValueOnce(new Promise(() => {}))

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(true)

    const input = wrapper.find('[data-testid="invite-input"]')
    await input.setValue('BETA-2026-ALPHA')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    // Mid-request: gate must still be mounted (otherwise the local
    // `code` ref is destroyed and remounts blank on failure) and the
    // typed value must still be there.
    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(true)
    expect((wrapper.find('[data-testid="invite-input"]').element as HTMLInputElement).value).toBe(
      'BETA-2026-ALPHA',
    )
  })
})
