import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApplyBar from '../../components/ApplyBar.vue'
import { useAnalyzeStore } from '../../stores/analyze.js'
import { useApplyStore } from '../../stores/apply.js'
import type { PreviewOutput } from '../../api/types.js'
import { createTestI18n } from '../test-utils.js'

const preview: PreviewOutput = {
  rooms: [],
  misc: [],
  summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
  config: { title: 'Lovelacer - Home', views: [] },
  diff: null,
  suggestions: [],
}

describe('ApplyBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
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

    await wrapper.get('button').trigger('click')

    expect(analyze.phase).toBe('idle')
    expect(analyze.preview).toBeNull()
    expect(apply.phase).toBe('idle')
  })
})
