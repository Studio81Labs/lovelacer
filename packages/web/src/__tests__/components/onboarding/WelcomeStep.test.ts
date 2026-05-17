import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WelcomeStep from '../../../components/onboarding/WelcomeStep.vue'
import { useSettingsStore } from '../../../stores/settings.js'
import type * as ApiTypes from '../../../api/types.js'
import { createTestI18n } from '../../test-utils.js'

vi.mock('../../../api/client.js', async () => {
  const { DEFAULT_SETTINGS } = await vi.importActual<typeof ApiTypes>('../../../api/types.js')
  return {
    getSettings: vi.fn().mockResolvedValue({ settings: DEFAULT_SETTINGS }),
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
  }
})

function mountWelcome() {
  return mount(WelcomeStep, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })
}

describe('WelcomeStep', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders heading and every detection-language option', () => {
    const wrapper = mountWelcome()
    expect(wrapper.find('[data-testid="welcome-step"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('lovelacer')
    expect(wrapper.text()).toContain('Home Assistant dashboards that organize themselves')

    const select = wrapper.find('[data-testid="welcome-language"]')
    expect(select.exists()).toBe(true)
    const opts = select.findAll('option').map((o) => o.attributes('value'))
    expect(opts).toEqual(['auto', 'en', 'cs', 'de', 'es', 'fr', 'it', 'nl', 'pl'])
  })

  it('language dropdown is pre-selected from settings.effective.language', () => {
    const wrapper = mountWelcome()
    const select = wrapper.find('[data-testid="welcome-language"]')
    expect((select.element as HTMLSelectElement).value).toBe('auto')
  })

  it('changing language calls settings.setLanguage', async () => {
    const wrapper = mountWelcome()
    const store = useSettingsStore()
    const select = wrapper.find('[data-testid="welcome-language"]')
    await select.setValue('cs')
    expect(vi.mocked(store.setLanguage)).toHaveBeenCalledWith('cs')
  })

  it('Continue button click emits "continue"', async () => {
    const wrapper = mountWelcome()
    await wrapper.find('[data-testid="welcome-continue"]').trigger('click')
    expect(wrapper.emitted('continue')).toBeTruthy()
  })

  it('Skip link click emits "skip"', async () => {
    const wrapper = mountWelcome()
    await wrapper.find('[data-testid="welcome-skip"]').trigger('click')
    expect(wrapper.emitted('skip')).toBeTruthy()
  })
})
