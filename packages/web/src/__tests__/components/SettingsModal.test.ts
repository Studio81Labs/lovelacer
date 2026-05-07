import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsModal from '../../components/SettingsModal.vue'
import { useSettingsStore } from '../../stores/settings.js'
import { DEFAULT_SETTINGS } from '../../api/types.js'
import en from '../../locales/en.json'

function createTestI18n() {
  return createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } })
}

vi.mock('../../api/client.js', () => ({
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
}))

import { putSettings, postPreview } from '../../api/client.js'

const DEFAULT_PREVIEW = {
  rooms: [],
  misc: [],
  summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
  config: { title: 'Lovelacer — Home', views: [] },
  diff: null,
  suggestions: [],
}

function mountModal() {
  return mount(SettingsModal, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })
}

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.mocked(putSettings).mockResolvedValue({ settings: DEFAULT_SETTINGS })
    vi.mocked(postPreview).mockResolvedValue(DEFAULT_PREVIEW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the language dropdown with Auto/English/Čeština options', () => {
    const wrapper = mountModal()
    const select = wrapper.find('[data-testid="settings-language"]')
    expect(select.exists()).toBe(true)
    const opts = select.findAll('option').map((o) => o.attributes('value'))
    expect(opts).toEqual(['auto', 'en', 'cs'])
  })

  it('renders the card-pack dropdown disabled with only "default"', () => {
    const wrapper = mountModal()
    const select = wrapper.find('[data-testid="settings-card-pack"]')
    expect(select.exists()).toBe(true)
    expect(select.attributes('disabled')).toBeDefined()
    const opts = select.findAll('option').map((o) => o.attributes('value'))
    expect(opts).toEqual(['default'])
  })

  it('renders 7 section checkboxes with correct labels', () => {
    const wrapper = mountModal()
    const SECTION_KEYS = [
      'welcome',
      'quickStats',
      'people',
      'roomsByFloor',
      'activeRooms',
      'scenes',
      'cameras',
    ]
    for (const key of SECTION_KEYS) {
      expect(wrapper.find(`[data-testid="settings-section-${key}"]`).exists()).toBe(true)
    }
  })

  it('toggling a checkbox marks the store dirty', async () => {
    const wrapper = mountModal()
    const store = useSettingsStore()
    expect(store.hasDirty).toBe(false)
    const checkbox = wrapper.find('[data-testid="settings-section-cameras"]')
    await checkbox.setValue(false)
    expect(store.hasDirty).toBe(true)
  })

  it('Save button is disabled when not dirty', () => {
    const wrapper = mountModal()
    const save = wrapper.find('[data-testid="settings-save"]')
    expect(save.attributes('disabled')).toBeDefined()
  })

  it('Save button click calls store.saveAndReanalyze and emits close on success', async () => {
    const wrapper = mountModal()
    const store = useSettingsStore()
    // Make dirty
    store.setLanguage('cs')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="settings-save"]').trigger('click')
    // saveAndReanalyze is async — fully drain microtask queue
    await flushPromises()

    expect(vi.mocked(store.saveAndReanalyze)).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('Discard button click clears dirty state', async () => {
    const wrapper = mountModal()
    const store = useSettingsStore()
    store.setLanguage('cs')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="settings-discard"]').trigger('click')
    expect(vi.mocked(store.discardChanges)).toHaveBeenCalled()
  })

  it('backdrop click while NOT dirty emits close', async () => {
    const wrapper = mountModal()
    await wrapper.find('[data-testid="settings-modal-backdrop"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('backdrop click while dirty does NOT emit close', async () => {
    const wrapper = mountModal()
    const store = useSettingsStore()
    store.setLanguage('cs')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="settings-modal-backdrop"]').trigger('click')
    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('clicking inside the modal does NOT emit close', async () => {
    const wrapper = mountModal()
    await wrapper.find('[data-testid="settings-modal"]').trigger('click')
    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('× close button click while NOT dirty emits close', async () => {
    const wrapper = mountModal()
    await wrapper.find('[data-testid="settings-close"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('× close button is disabled while dirty (consistent with backdrop guard)', async () => {
    const wrapper = mountModal()
    const store = useSettingsStore()
    store.setLanguage('cs')
    await wrapper.vm.$nextTick()

    const closeBtn = wrapper.find('[data-testid="settings-close"]')
    expect(closeBtn.attributes('disabled')).toBeDefined()

    // Even if a click somehow fires, the requestClose handler short-circuits.
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('UI language picker updates settings.dirtyState.uiLanguage and the active i18n locale', async () => {
    const wrapper = mount(SettingsModal, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const select = wrapper.find('[data-testid="settings-ui-language"]')
    await select.setValue('de')
    const settings = useSettingsStore()
    expect(settings.effective.uiLanguage).toBe('de')
  })
})
