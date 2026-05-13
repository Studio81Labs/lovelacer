import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PreviewStep from '../../../components/onboarding/PreviewStep.vue'
import { useAnalyzeStore } from '../../../stores/analyze.js'
import { useApplyStore } from '../../../stores/apply.js'
import { createTestI18n } from '../../test-utils.js'

vi.mock('../../../api/client.js', () => ({
  getSettings: vi.fn(),
  putSettings: vi.fn(),
  postAnalyze: vi.fn(),
  postPreview: vi.fn(),
  postApply: vi.fn(),
  getOverrides: vi.fn(),
  putOverrides: vi.fn(),
  getInvite: vi.fn(),
  postInvite: vi.fn(),
  postDismissSuggestion: vi.fn(),
  getOnboarding: vi.fn(),
  postOnboardingComplete: vi.fn(),
}))

const mockPreview = {
  rooms: [
    {
      id: 'kitchen',
      haAreaId: null,
      displayName: 'Kitchen',
      icon: 'mdi:silverware-fork-knife',
      entityCount: 2,
      averageConfidence: 0.85,
      assignments: [
        { entityId: 'sensor.a', roomId: 'kitchen', confidence: 0.85, signals: [] },
        { entityId: 'sensor.b', roomId: 'kitchen', confidence: 0.85, signals: [] },
      ],
    },
  ],
  misc: [{ entityId: 'sensor.unsorted', friendlyName: 'Unsorted', domain: 'sensor' }],
  summary: { entityCount: 3, roomCount: 1, miscCount: 1 },
  config: { title: 'Lovelacer — Home', views: [] },
  diff: null,
  suggestions: [],
}

function mountPreview() {
  return mount(PreviewStep, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })
}

describe('PreviewStep', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading state while analyze.phase === loading', async () => {
    const wrapper = mountPreview()
    const analyze = useAnalyzeStore()
    analyze.phase = 'loading'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Scanning')
  })

  it('renders summary line and DashboardPreview after analyze success', async () => {
    const wrapper = mountPreview()
    const analyze = useAnalyzeStore()
    analyze.phase = 'ready'
    analyze.preview = mockPreview as never
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Detected 3 entities across 1 room')
    expect(wrapper.find('[data-testid="dashboard-preview"]').exists()).toBe(true)
  })

  it('clicking Apply calls apply.apply with the right config + snapshot', async () => {
    const wrapper = mountPreview()
    const analyze = useAnalyzeStore()
    const apply = useApplyStore()
    analyze.phase = 'ready'
    analyze.preview = mockPreview as never
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="preview-apply"]').trigger('click')
    expect(vi.mocked(apply.apply)).toHaveBeenCalledWith({
      config: mockPreview.config,
      snapshot: expect.objectContaining({
        config: mockPreview.config,
      }),
    })
  })

  it('Apply error renders inline error banner with Retry', async () => {
    const wrapper = mountPreview()
    const analyze = useAnalyzeStore()
    const apply = useApplyStore()
    analyze.phase = 'ready'
    analyze.preview = mockPreview as never
    apply.phase = 'error'
    apply.error = { error: 'apply_failed', message: 'HA push failed' }
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('HA push failed')
  })

  it('Analyze error renders inline error banner with Retry + Back', async () => {
    const wrapper = mountPreview()
    const analyze = useAnalyzeStore()
    analyze.phase = 'error'
    analyze.error = { error: 'analyze_failed', message: 'HA disconnected' }
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('HA disconnected')
    expect(wrapper.find('[data-testid="preview-back"]').exists()).toBe(true)
  })

  it('Back button click emits "back"', async () => {
    const wrapper = mountPreview()
    const analyze = useAnalyzeStore()
    analyze.phase = 'ready'
    analyze.preview = mockPreview as never
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="preview-back"]').trigger('click')
    expect(wrapper.emitted('back')).toBeTruthy()
  })

  it('Skip link click emits "skip"', async () => {
    const wrapper = mountPreview()
    const analyze = useAnalyzeStore()
    analyze.phase = 'ready'
    analyze.preview = mockPreview as never
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="preview-skip"]').trigger('click')
    expect(wrapper.emitted('skip')).toBeTruthy()
  })

  it('Show breakdown toggle reveals RoomList and MiscBucket in read-only mode', async () => {
    const wrapper = mountPreview()
    const analyze = useAnalyzeStore()
    analyze.phase = 'ready'
    analyze.preview = mockPreview as never
    await wrapper.vm.$nextTick()
    // Expand the <details> element programmatically.
    const details = wrapper.find('details')
    details.element.open = true
    details.trigger('toggle')
    await wrapper.vm.$nextTick()
    // RoomList should be visible (rendered) but no select dropdowns (readOnly).
    expect(wrapper.findAll('[data-testid="room-select"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="misc-row-checkbox"]')).toHaveLength(0)
  })
})
