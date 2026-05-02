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
}))

const { postPreview, getOverrides, putOverrides } = await import('../api/client.js')

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
}

describe('App integration', () => {
  beforeEach(() => {
    vi.mocked(postPreview).mockReset()
    vi.mocked(getOverrides).mockReset()
    vi.mocked(putOverrides).mockReset()
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
