import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OnboardingWizard from '../../components/OnboardingWizard.vue'
import { useAnalyzeStore } from '../../stores/analyze.js'
import { useApplyStore } from '../../stores/apply.js'
import { useOnboardingStore } from '../../stores/onboarding.js'
import { useSettingsStore } from '../../stores/settings.js'
import type * as ApiTypes from '../../api/types.js'
import { createTestI18n } from '../test-utils.js'

vi.mock('../../api/client.js', async () => {
  const { DEFAULT_SETTINGS } = await vi.importActual<typeof ApiTypes>('../../api/types.js')
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
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
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

  it('Continue from WelcomeStep when settings is dirty: calls saveAndReanalyze and transitions to PreviewStep', async () => {
    const wrapper = mountWizard()
    const settings = useSettingsStore()
    const analyze = useAnalyzeStore()
    vi.mocked(settings.saveAndReanalyze).mockResolvedValue(undefined)
    settings.setLanguage('cs')
    await flushPromises()
    await wrapper.find('[data-testid="welcome-continue"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(settings.saveAndReanalyze)).toHaveBeenCalled()
    // analyze.analyze should NOT be called separately — saveAndReanalyze does it.
    expect(vi.mocked(analyze.analyze)).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="preview-step"]').exists()).toBe(true)
  })

  it('Continue from WelcomeStep when settings is NOT dirty: calls analyze + transitions to PreviewStep (regression: Bugbot #25)', async () => {
    // Regression for the bug where saveAndReanalyze early-returns on a clean
    // dirty state, so a user who Continues without changing the language
    // would land on PreviewStep with phase='idle' and no template branch
    // matching. The fix mirrors onSkip's hasDirty branching.
    const wrapper = mountWizard()
    const settings = useSettingsStore()
    const analyze = useAnalyzeStore()
    // Stub analyze.analyze so the non-dirty branch's fire-and-forget call
    // doesn't reject (postAnalyze isn't fully mocked) and pollute later tests
    // with unhandled rejections.
    vi.mocked(analyze.analyze).mockResolvedValue(undefined)
    expect(settings.hasDirty).toBe(false)
    await wrapper.find('[data-testid="welcome-continue"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(analyze.analyze)).toHaveBeenCalled()
    expect(vi.mocked(settings.saveAndReanalyze)).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="preview-step"]').exists()).toBe(true)
  })

  it('Apply success transitions to DoneStep and calls onboarding.complete', async () => {
    const wrapper = mountWizard()
    const settings = useSettingsStore()
    const onboarding = useOnboardingStore()
    const apply = useApplyStore()
    // Dirty the settings + stub saveAndReanalyze so Continue goes through
    // the awaited dirty-branch (same as the original test's behavior before
    // onContinueFromWelcome got its hasDirty guard added).
    vi.mocked(settings.saveAndReanalyze).mockResolvedValue(undefined)
    settings.setLanguage('cs')
    await flushPromises()
    await wrapper.find('[data-testid="welcome-continue"]').trigger('click')
    await flushPromises()
    // Now on PreviewStep; simulate apply success via store mutation.
    apply.phase = 'success'
    await flushPromises()
    expect(vi.mocked(onboarding.complete)).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="done-step"]').exists()).toBe(true)
  })

  it('Apply error does NOT call onboarding.complete and does NOT transition', async () => {
    const wrapper = mountWizard()
    const analyze = useAnalyzeStore()
    const onboarding = useOnboardingStore()
    const apply = useApplyStore()
    // Stub the non-dirty Continue branch's fire-and-forget analyze call.
    vi.mocked(analyze.analyze).mockResolvedValue(undefined)
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

  it('Continue when saveAndReanalyze throws: falls back to analyze and still transitions to PreviewStep (regression: Bugbot #25 Medium)', async () => {
    // Regression: saveAndReanalyze re-throws on PUT failure (intentional —
    // settings modal needs to know). Without try/catch in the wizard, the
    // throw would prevent currentStep transition and freeze the wizard
    // with no feedback.
    const wrapper = mountWizard()
    const settings = useSettingsStore()
    const analyze = useAnalyzeStore()
    vi.mocked(settings.saveAndReanalyze).mockRejectedValue(
      Object.assign(new Error('boom'), { error: 'network', message: 'boom' }),
    )
    vi.mocked(analyze.analyze).mockResolvedValue(undefined)
    settings.setLanguage('cs')
    await flushPromises()
    await wrapper.find('[data-testid="welcome-continue"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(settings.saveAndReanalyze)).toHaveBeenCalled()
    expect(vi.mocked(analyze.analyze)).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="preview-step"]').exists()).toBe(true)
  })

  it('Skip when saveAndReanalyze throws: falls back to analyze, still calls complete + emits close (regression: Bugbot #25 Medium)', async () => {
    const wrapper = mountWizard()
    const settings = useSettingsStore()
    const analyze = useAnalyzeStore()
    const onboarding = useOnboardingStore()
    vi.mocked(settings.saveAndReanalyze).mockRejectedValue(
      Object.assign(new Error('boom'), { error: 'network', message: 'boom' }),
    )
    vi.mocked(analyze.analyze).mockResolvedValue(undefined)
    settings.setLanguage('cs')
    await flushPromises()
    await wrapper.find('[data-testid="welcome-skip"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(settings.saveAndReanalyze)).toHaveBeenCalled()
    expect(vi.mocked(analyze.analyze)).toHaveBeenCalled()
    expect(vi.mocked(onboarding.complete)).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
