import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OnboardingWizard from '../../components/OnboardingWizard.vue'
import { useAnalyzeStore } from '../../stores/analyze.js'
import { useApplyStore } from '../../stores/apply.js'
import { useOnboardingStore } from '../../stores/onboarding.js'
import { useSettingsStore } from '../../stores/settings.js'

vi.mock('../../api/client.js', async () => {
  const { DEFAULT_SETTINGS } =
    await vi.importActual<typeof import('../../api/types.js')>('../../api/types.js')
  return {
    getSettings: vi.fn().mockResolvedValue({ settings: DEFAULT_SETTINGS }),
    putSettings: vi.fn().mockResolvedValue({ settings: DEFAULT_SETTINGS }),
    postAnalyze: vi.fn(),
    postPreview: vi.fn().mockResolvedValue({
      rooms: [],
      misc: [],
      summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
      config: { title: 'Lovelacer — Home', views: [] },
      diff: null,
      suggestions: [],
    }),
    postApply: vi.fn(),
    getOverrides: vi.fn(),
    putOverrides: vi.fn(),
    getInvite: vi.fn(),
    postInvite: vi.fn(),
    postDismissSuggestion: vi.fn(),
    getOnboarding: vi.fn(),
    postOnboardingComplete: vi.fn().mockResolvedValue({ completedAt: 1700000000 }),
  }
})

function mountWizard() {
  return mount(OnboardingWizard, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
    },
  })
}

describe('OnboardingWizard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders WelcomeStep by default', () => {
    const wrapper = mountWizard()
    expect(wrapper.find('[data-testid="welcome-step"]').exists()).toBe(true)
  })

  it('Continue from WelcomeStep calls settings.saveAndReanalyze and transitions to PreviewStep', async () => {
    const wrapper = mountWizard()
    const settings = useSettingsStore()
    await wrapper.find('[data-testid="welcome-continue"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(settings.saveAndReanalyze)).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="preview-step"]').exists()).toBe(true)
  })

  it('Apply success transitions to DoneStep and calls onboarding.complete', async () => {
    const wrapper = mountWizard()
    const settings = useSettingsStore()
    const onboarding = useOnboardingStore()
    const apply = useApplyStore()
    // Skip Welcome by triggering Continue first.
    await wrapper.find('[data-testid="welcome-continue"]').trigger('click')
    await flushPromises()
    // Now on PreviewStep; simulate apply success via store mutation.
    apply.phase = 'success'
    await flushPromises()
    expect(vi.mocked(onboarding.complete)).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="done-step"]').exists()).toBe(true)
    // settings.saveAndReanalyze was called once during Continue, not again.
    expect(vi.mocked(settings.saveAndReanalyze)).toHaveBeenCalledTimes(1)
  })

  it('Apply error does NOT call onboarding.complete and does NOT transition', async () => {
    const wrapper = mountWizard()
    const onboarding = useOnboardingStore()
    const apply = useApplyStore()
    await wrapper.find('[data-testid="welcome-continue"]').trigger('click')
    await flushPromises()
    apply.phase = 'error'
    apply.error = { error: 'apply_failed', message: 'HA push failed' }
    await flushPromises()
    expect(vi.mocked(onboarding.complete)).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="preview-step"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="done-step"]').exists()).toBe(false)
  })

  it('Skip from WelcomeStep when settings is dirty: calls saveAndReanalyze + complete', async () => {
    const wrapper = mountWizard()
    const settings = useSettingsStore()
    const onboarding = useOnboardingStore()
    const analyze = useAnalyzeStore()
    vi.mocked(settings.saveAndReanalyze).mockResolvedValue(undefined)
    settings.setLanguage('cs')
    await flushPromises()
    await wrapper.find('[data-testid="welcome-skip"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(settings.saveAndReanalyze)).toHaveBeenCalled()
    expect(vi.mocked(onboarding.complete)).toHaveBeenCalled()
    // analyze.analyze should NOT be called separately (saveAndReanalyze does it).
    expect(vi.mocked(analyze.analyze)).not.toHaveBeenCalled()
  })

  it('Skip from WelcomeStep when settings is NOT dirty: calls analyze + complete', async () => {
    const wrapper = mountWizard()
    const settings = useSettingsStore()
    const onboarding = useOnboardingStore()
    const analyze = useAnalyzeStore()
    // hasDirty defaults to false
    expect(settings.hasDirty).toBe(false)
    await wrapper.find('[data-testid="welcome-skip"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(analyze.analyze)).toHaveBeenCalled()
    expect(vi.mocked(onboarding.complete)).toHaveBeenCalled()
    expect(vi.mocked(settings.saveAndReanalyze)).not.toHaveBeenCalled()
  })
})
