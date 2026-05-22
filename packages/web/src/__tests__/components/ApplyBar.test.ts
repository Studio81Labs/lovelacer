import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApplyBar from '../../components/ApplyBar.vue'
import { useAnalyzeStore } from '../../stores/analyze.js'
import { useApplyStore } from '../../stores/apply.js'
import { useSettingsStore } from '../../stores/settings.js'
import type { PreviewOutput } from '../../api/types.js'
import { createTestI18n } from '../test-utils.js'

const preview: PreviewOutput = {
  rooms: [],
  misc: [],
  summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
  config: {
    title: 'Lovelacer - Home',
    views: [
      { type: 'sections', title: 'Home', path: 'home', icon: 'mdi:home-variant' },
      { type: 'sections', title: 'Kitchen', path: 'kitchen', icon: 'mdi:silverware' },
    ],
  },
  diff: null,
  suggestions: [],
}

describe('ApplyBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('open', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps the analyzed preview after apply success until the user explicitly starts over', async () => {
    const wrapper = mount(ApplyBar, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const analyze = useAnalyzeStore()
    const apply = useApplyStore()
    analyze.$patch({ phase: 'ready', preview })

    apply.$patch({
      phase: 'success',
      result: { ok: true, urlPath: 'lovelacer-home', created: true },
    })
    await vi.runAllTimersAsync()

    expect(analyze.phase).toBe('ready')
    expect(analyze.preview).toEqual(preview)
    expect(apply.phase).toBe('success')
    const openDashboard = wrapper.get('[data-testid="apply-open-dashboard"]')
    await openDashboard.trigger('click')
    expect(window.open).toHaveBeenCalledWith('/lovelacer-home', '_blank')

    const startOver = wrapper.findAll('button').find((button) => button.text() === 'Start over')
    expect(startOver).toBeDefined()
    await startOver!.trigger('click')

    expect(analyze.phase).toBe('idle')
    expect(analyze.preview).toBeNull()
    expect(apply.phase).toBe('idle')
  })

  it('renders as a sticky bottom action bar with view summary', async () => {
    const wrapper = mount(ApplyBar, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const analyze = useAnalyzeStore()
    analyze.$patch({
      phase: 'ready',
      preview,
      analyzedAt: Math.floor(Date.now() / 1000),
    })
    await wrapper.vm.$nextTick()

    const bar = wrapper.get('[data-testid="apply-bar"]')
    expect(bar.classes()).toContain('fixed')
    expect(bar.classes()).toContain('bottom-0')
    expect(bar.text()).toContain('Will create 2 dashboard views')
    expect(bar.text()).toContain('Last analyzed today.')
    expect(bar.text()).toContain('Apply to Home Assistant')
    expect(bar.text()).toContain('Start over')
  })

  it('disables apply while room settings are saving or preview is refreshing', async () => {
    const wrapper = mount(ApplyBar, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const analyze = useAnalyzeStore()
    const settings = useSettingsStore()
    analyze.$patch({ phase: 'ready', preview })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()

    settings.$patch({ phase: 'saving' })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    settings.$patch({ phase: 'idle' })
    analyze.$patch({ isRefreshingPreview: true })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })
})
