import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DoneStep from '../../../components/onboarding/DoneStep.vue'
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

function mountDone() {
  return mount(DoneStep, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })
}

describe('DoneStep', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders success heading and dashboard path from apply.result', async () => {
    const wrapper = mountDone()
    const apply = useApplyStore()
    apply.result = { ok: true, urlPath: 'lovelacer-home', created: true }
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('All set!')
    expect(wrapper.text()).toContain('/lovelace/lovelacer-home')
  })

  it('falls back to a default urlPath when apply.result is null', () => {
    const wrapper = mountDone()
    expect(wrapper.text()).toContain('/lovelace/lovelacer-home')
  })

  it('Open dashboard button calls window.open with the urlPath', async () => {
    const wrapper = mountDone()
    const apply = useApplyStore()
    apply.result = { ok: true, urlPath: 'my-custom-dash', created: true }
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="done-open-dashboard"]').trigger('click')
    expect(window.open).toHaveBeenCalledWith('/lovelace/my-custom-dash', '_blank')
  })

  it('Continue button emits "finish"', async () => {
    const wrapper = mountDone()
    await wrapper.find('[data-testid="done-finish"]').trigger('click')
    expect(wrapper.emitted('finish')).toBeTruthy()
  })

  it('does not render a Skip onboarding link on the final step', async () => {
    const wrapper = mountDone()
    expect(wrapper.find('[data-testid="done-skip"]').exists()).toBe(false)
  })
})
