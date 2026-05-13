import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import App from '../App.vue'
import ApplyBar from '../components/ApplyBar.vue'
import RoomList from '../components/RoomList.vue'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useOverridesStore } from '../stores/overrides.js'
import { useInviteStore } from '../stores/invite.js'
import { useOnboardingStore } from '../stores/onboarding.js'
import { useSettingsStore } from '../stores/settings.js'
import { useI18nStore } from '../stores/i18n.js'
import { DEFAULT_SETTINGS } from '../api/types.js'
import type { PreviewOutput, Settings } from '../api/types.js'
import { createTestI18n } from './test-utils.js'
import enLocale from '../locales/en.json'
import csLocale from '../locales/cs.json'

vi.mock('../api/client.js', () => ({
  postPreview: vi.fn(),
  postApply: vi.fn(),
  getOverrides: vi.fn(),
  putOverrides: vi.fn(),
  getInvite: vi.fn(),
  postInvite: vi.fn(),
  getOnboarding: vi.fn(),
  postOnboardingComplete: vi.fn(),
  getSettings: vi.fn(),
  putSettings: vi.fn(),
}))

const {
  postPreview,
  getOverrides,
  putOverrides,
  getInvite,
  postInvite,
  getOnboarding,
  getSettings,
  putSettings,
} = await import('../api/client.js')

const mockPreview: PreviewOutput = {
  rooms: [
    {
      id: 'kitchen',
      haAreaId: 'kitchen',
      displayName: 'Kitchen',
      icon: 'mdi:silverware-fork-knife',
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
  suggestions: [],
}

// P2-9 — default Settings response for loadFromServer(). Tests that
// don't care about uiLanguage reconciliation get a quiet pass-through.
// `uiLanguage` is intentionally omitted (the field is OPTIONAL): a
// fresh install has no explicit user choice, so the watcher's truthy
// check on `next` filters out the load and the active i18n locale is
// preserved. Tests that need an explicit value mock getSettings
// individually to provide one.
const defaultSettings: Settings = {
  language: 'auto',
  cardPack: 'default',
  sections: {
    welcome: true,
    quickStats: true,
    people: true,
    roomsByFloor: true,
    activeRooms: true,
    scenes: true,
    cameras: true,
  },
}

describe('App integration', () => {
  beforeEach(() => {
    vi.mocked(postPreview).mockReset()
    vi.mocked(getOverrides).mockReset()
    vi.mocked(putOverrides).mockReset()
    vi.mocked(getInvite).mockReset()
    vi.mocked(postInvite).mockReset()
    vi.mocked(getOnboarding).mockReset()
    vi.mocked(getSettings).mockReset()
    vi.mocked(putSettings).mockReset()
    // Default: most existing tests assume the gate is already accepted
    // and onboarding already completed so the main view is visible.
    vi.mocked(getInvite).mockResolvedValue({ accepted: true })
    vi.mocked(getOnboarding).mockResolvedValue({ completedAt: 1700000000 })
    vi.mocked(getSettings).mockResolvedValue({ settings: defaultSettings })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, version: 'dev', ha: { connected: true } }),
    })
  })

  it('places health status and analyze action in the header toolbar', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await flushPromises()

    const header = wrapper.find('header')
    expect(header.classes()).toContain('flex')
    expect(header.classes()).toContain('justify-between')
    expect(header.classes()).toContain('sticky')
    expect(header.classes()).toContain('top-0')
    expect(header.text()).toContain('Version')
    expect(header.text()).toContain('dev')
    expect(header.text()).toContain('HA connected')
    expect(header.findComponent({ name: 'AnalyzeButton' }).exists()).toBe(true)

    expect(wrapper.find('[data-testid="header-health"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="header-top-row"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="header-top-row"]').text()).toContain('lovelacer')
    expect(wrapper.find('[data-testid="header-top-row"]').text()).toContain('HA connected')
    expect(wrapper.find('[data-testid="header-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="header-status"]').classes()).toContain('ml-auto')
    expect(wrapper.find('[data-testid="header-actions"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="header-actions"]').text()).toContain('Analyze')
    expect(wrapper.find('[data-testid="standalone-analyze"]').exists()).toBe(false)
  })

  it('shows a first-run prompt before analysis starts', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await flushPromises()

    const idleState = wrapper.find('[data-testid="idle-state"]')
    expect(idleState.exists()).toBe(true)
    expect(idleState.classes()).toContain('flex-1')
    expect(idleState.classes()).toContain('items-center')
    expect(idleState.text()).toContain('Ready to build your dashboard')
    expect(idleState.text()).toContain('Nothing will be changed until you click Apply.')
    expect(idleState.findComponent({ name: 'AnalyzeButton' }).exists()).toBe(true)

    const analyze = useAnalyzeStore()
    analyze.$patch({ phase: 'ready', preview: mockPreview })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="idle-state"]').exists()).toBe(false)
  })

  it('shows hidden entities near misc after analysis', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await flushPromises()

    const analyze = useAnalyzeStore()
    const overrides = useOverridesStore()
    analyze.$patch({ phase: 'ready', preview: mockPreview })
    overrides.setHidden('sensor.hidden_rssi', true)
    await wrapper.vm.$nextTick()

    const panel = wrapper.find('[data-testid="hidden-entities-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('sensor.hidden_rssi')
  })

  it('triggers loadFromServer when analyze.phase transitions to ready', async () => {
    vi.mocked(getOverrides).mockResolvedValueOnce({ overrides: [] })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
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
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
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
          icon: 'mdi:silverware-fork-knife',
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
      suggestions: [],
    }

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    // Allow getInvite + getOnboarding mocks to resolve so showMainView is true.
    await Promise.resolve()
    await wrapper.vm.$nextTick()
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
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    // Allow getInvite + getOnboarding mocks to resolve so showMainView is true.
    await Promise.resolve()
    await wrapper.vm.$nextTick()
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

  it('persists room order when RoomList emits a reorder event', async () => {
    const orderedPreview: PreviewOutput = {
      ...mockPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'bedroom',
          haAreaId: 'bedroom',
          displayName: 'Bedroom',
          icon: 'mdi:bed',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }
    const savedSettings: Settings = {
      ...defaultSettings,
      roomOrder: ['bedroom', 'kitchen'],
    }
    vi.mocked(putSettings).mockResolvedValueOnce({ settings: savedSettings })
    vi.mocked(postPreview).mockResolvedValueOnce(orderedPreview)

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    const analyze = useAnalyzeStore()
    analyze.$patch({ phase: 'ready', preview: orderedPreview })
    await wrapper.vm.$nextTick()

    wrapper.findComponent(RoomList).vm.$emit('reorder', ['bedroom', 'kitchen'])
    await flushPromises()

    expect(putSettings).toHaveBeenCalledWith({ settings: savedSettings })
    expect(postPreview).toHaveBeenCalled()
  })

  it('saves a room override and refreshes preview', async () => {
    const kitchenPreview: PreviewOutput = {
      ...mockPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 1,
          averageConfidence: 1,
          assignments: [],
        },
      ],
      summary: { entityCount: 1, roomCount: 1, miscCount: 0 },
    }
    const breakfastNookPreview: PreviewOutput = {
      ...kitchenPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Breakfast nook',
          icon: 'mdi:coffee',
          entityCount: 1,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }
    vi.mocked(getSettings).mockResolvedValue({ settings: DEFAULT_SETTINGS })
    vi.mocked(postPreview)
      .mockResolvedValueOnce(kitchenPreview)
      .mockResolvedValueOnce(breakfastNookPreview)
    vi.mocked(putSettings).mockResolvedValueOnce({
      settings: {
        ...DEFAULT_SETTINGS,
        roomOverrides: { kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' } },
      },
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    const analyze = useAnalyzeStore()
    await analyze.analyze()
    await flushPromises()

    await wrapper.find('[data-testid="room-edit-button"]').trigger('click')
    await wrapper.find('[data-testid="room-name-input"]').setValue('Breakfast nook')
    await wrapper.find('[data-testid="room-icon-input"]').setValue('mdi:coffee')
    await wrapper.find('[data-testid="room-save-button"]').trigger('click')
    await flushPromises()

    expect(putSettings).toHaveBeenCalledWith({
      settings: {
        ...DEFAULT_SETTINGS,
        roomOverrides: { kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' } },
      },
    })
    expect(postPreview).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="room-name"]').text()).toBe('Breakfast nook')
  })

  it('waits for server settings before saving room order', async () => {
    const orderedPreview: PreviewOutput = {
      ...mockPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'bedroom',
          haAreaId: 'bedroom',
          displayName: 'Bedroom',
          icon: 'mdi:bed',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }
    const serverSettings: Settings = {
      language: 'cs',
      cardPack: 'minimal',
      sections: {
        welcome: false,
        quickStats: true,
        people: false,
        roomsByFloor: true,
        activeRooms: false,
        scenes: true,
        cameras: false,
      },
      uiLanguage: 'de',
    }
    const savedSettings: Settings = {
      ...serverSettings,
      roomOrder: ['bedroom', 'kitchen'],
    }
    let resolveSettings: (value: { settings: Settings }) => void = () => {}
    vi.mocked(getSettings)
      .mockReset()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSettings = resolve
        }),
      )
    vi.mocked(putSettings).mockResolvedValueOnce({ settings: savedSettings })
    vi.mocked(postPreview).mockResolvedValueOnce(orderedPreview)

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    const analyze = useAnalyzeStore()
    analyze.$patch({ phase: 'ready', preview: orderedPreview })
    await wrapper.vm.$nextTick()
    vi.mocked(getSettings).mockClear()
    vi.mocked(putSettings).mockClear()

    wrapper.findComponent(RoomList).vm.$emit('reorder', ['bedroom', 'kitchen'])
    await Promise.resolve()

    expect(getSettings).not.toHaveBeenCalled()
    expect(putSettings).not.toHaveBeenCalled()

    resolveSettings({ settings: serverSettings })
    await flushPromises()

    expect(putSettings).toHaveBeenCalledWith({ settings: savedSettings })
    expect(postPreview).toHaveBeenCalled()
  })

  it('reverts optimistic room order when saving room order fails', async () => {
    const orderedPreview: PreviewOutput = {
      ...mockPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'bedroom',
          haAreaId: 'bedroom',
          displayName: 'Bedroom',
          icon: 'mdi:bed',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }
    const serverSettings: Settings = {
      ...defaultSettings,
      roomOrder: ['kitchen', 'bedroom'],
    }
    vi.mocked(getSettings).mockResolvedValueOnce({ settings: serverSettings })
    vi.mocked(putSettings).mockRejectedValueOnce({
      error: 'storage_error',
      message: 'disk full',
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    const analyze = useAnalyzeStore()
    const settings = useSettingsStore()
    analyze.$patch({ phase: 'ready', preview: orderedPreview })
    await wrapper.vm.$nextTick()

    wrapper.findComponent(RoomList).vm.$emit('reorder', ['bedroom', 'kitchen'])
    await flushPromises()

    expect(putSettings).toHaveBeenCalledWith({
      settings: { ...serverSettings, roomOrder: ['bedroom', 'kitchen'] },
    })
    expect(settings.effective.roomOrder).toEqual(['kitchen', 'bedroom'])
    expect(settings.dirtyState).toBeNull()
    expect(postPreview).not.toHaveBeenCalled()
  })

  it('serializes room order saves so the latest reorder wins', async () => {
    const orderedPreview: PreviewOutput = {
      ...mockPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'bedroom',
          haAreaId: 'bedroom',
          displayName: 'Bedroom',
          icon: 'mdi:bed',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'living_room',
          haAreaId: 'living_room',
          displayName: 'Living Room',
          icon: 'mdi:sofa',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }
    const firstSettings: Settings = {
      ...defaultSettings,
      roomOrder: ['bedroom', 'kitchen', 'living_room'],
    }
    const latestSettings: Settings = {
      ...defaultSettings,
      roomOrder: ['living_room', 'bedroom', 'kitchen'],
    }
    let resolveFirstSave: (value: { settings: Settings }) => void = () => {}
    vi.mocked(putSettings)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstSave = resolve
        }),
      )
      .mockResolvedValueOnce({ settings: latestSettings })
    vi.mocked(postPreview).mockResolvedValueOnce(orderedPreview)

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    const analyze = useAnalyzeStore()
    const settings = useSettingsStore()
    analyze.$patch({ phase: 'ready', preview: orderedPreview })
    await wrapper.vm.$nextTick()
    vi.mocked(putSettings).mockClear()
    vi.mocked(postPreview).mockClear()

    wrapper.findComponent(RoomList).vm.$emit('reorder', ['bedroom', 'kitchen', 'living_room'])
    await Promise.resolve()
    wrapper.findComponent(RoomList).vm.$emit('reorder', ['living_room', 'bedroom', 'kitchen'])
    await Promise.resolve()

    expect(putSettings).toHaveBeenCalledTimes(1)
    expect(putSettings).toHaveBeenNthCalledWith(1, { settings: firstSettings })

    resolveFirstSave({ settings: firstSettings })
    await flushPromises()

    expect(putSettings).toHaveBeenCalledTimes(2)
    expect(putSettings).toHaveBeenNthCalledWith(2, { settings: latestSettings })
    expect(settings.serverState?.roomOrder).toEqual(['living_room', 'bedroom', 'kitchen'])
    expect(postPreview).toHaveBeenCalledTimes(1)
  })

  it('refreshes the saved room order when a later queued save fails', async () => {
    const orderedPreview: PreviewOutput = {
      ...mockPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'bedroom',
          haAreaId: 'bedroom',
          displayName: 'Bedroom',
          icon: 'mdi:bed',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'living_room',
          haAreaId: 'living_room',
          displayName: 'Living Room',
          icon: 'mdi:sofa',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }
    const firstSettings: Settings = {
      ...defaultSettings,
      roomOrder: ['bedroom', 'kitchen', 'living_room'],
    }
    const latestSettings: Settings = {
      ...defaultSettings,
      roomOrder: ['living_room', 'bedroom', 'kitchen'],
    }
    let resolveFirstSave: (value: { settings: Settings }) => void = () => {}
    vi.mocked(putSettings)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstSave = resolve
        }),
      )
      .mockRejectedValueOnce({
        error: 'storage_error',
        message: 'disk full',
      })
    vi.mocked(postPreview).mockResolvedValueOnce(orderedPreview)

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    const analyze = useAnalyzeStore()
    const settings = useSettingsStore()
    analyze.$patch({ phase: 'ready', preview: orderedPreview })
    await wrapper.vm.$nextTick()
    vi.mocked(putSettings).mockClear()
    vi.mocked(postPreview).mockClear()

    wrapper.findComponent(RoomList).vm.$emit('reorder', ['bedroom', 'kitchen', 'living_room'])
    await Promise.resolve()
    wrapper.findComponent(RoomList).vm.$emit('reorder', ['living_room', 'bedroom', 'kitchen'])
    await Promise.resolve()

    resolveFirstSave({ settings: firstSettings })
    await flushPromises()

    expect(putSettings).toHaveBeenCalledTimes(2)
    expect(putSettings).toHaveBeenNthCalledWith(1, { settings: firstSettings })
    expect(putSettings).toHaveBeenNthCalledWith(2, { settings: latestSettings })
    expect(settings.effective.roomOrder).toEqual(['bedroom', 'kitchen', 'living_room'])
    expect(postPreview).toHaveBeenCalledTimes(1)
  })

  it('continues processing queued room order saves after preview refresh fails', async () => {
    const orderedPreview: PreviewOutput = {
      ...mockPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'bedroom',
          haAreaId: 'bedroom',
          displayName: 'Bedroom',
          icon: 'mdi:bed',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'living_room',
          haAreaId: 'living_room',
          displayName: 'Living Room',
          icon: 'mdi:sofa',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }
    const firstSettings: Settings = {
      ...defaultSettings,
      roomOrder: ['bedroom', 'kitchen', 'living_room'],
    }
    const latestSettings: Settings = {
      ...defaultSettings,
      roomOrder: ['living_room', 'bedroom', 'kitchen'],
    }
    let rejectFirstPreview: (reason: unknown) => void = () => {}
    vi.mocked(putSettings)
      .mockResolvedValueOnce({ settings: firstSettings })
      .mockResolvedValueOnce({ settings: latestSettings })
    vi.mocked(postPreview)
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectFirstPreview = reject
        }),
      )
      .mockResolvedValueOnce(orderedPreview)

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    const analyze = useAnalyzeStore()
    const settings = useSettingsStore()
    analyze.$patch({ phase: 'ready', preview: orderedPreview })
    await wrapper.vm.$nextTick()
    vi.mocked(putSettings).mockClear()
    vi.mocked(postPreview).mockClear()

    wrapper.findComponent(RoomList).vm.$emit('reorder', ['bedroom', 'kitchen', 'living_room'])
    await flushPromises()
    expect(postPreview).toHaveBeenCalledTimes(1)

    wrapper.findComponent(RoomList).vm.$emit('reorder', ['living_room', 'bedroom', 'kitchen'])
    await Promise.resolve()
    rejectFirstPreview({ error: 'preview_failed', message: 'refresh failed' })
    await flushPromises()

    expect(putSettings).toHaveBeenCalledTimes(2)
    expect(putSettings).toHaveBeenNthCalledWith(1, { settings: firstSettings })
    expect(putSettings).toHaveBeenNthCalledWith(2, { settings: latestSettings })
    expect(settings.serverState?.roomOrder).toEqual(['living_room', 'bedroom', 'kitchen'])
    expect(postPreview).toHaveBeenCalledTimes(2)
    expect(analyze.phase).toBe('ready')
  })

  it('keeps the ready room list visible while room-order preview refresh is in flight', async () => {
    const orderedPreview: PreviewOutput = {
      ...mockPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'bedroom',
          haAreaId: 'bedroom',
          displayName: 'Bedroom',
          icon: 'mdi:bed',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }
    const savedSettings: Settings = {
      ...defaultSettings,
      roomOrder: ['bedroom', 'kitchen'],
    }
    let resolveSave: (value: { settings: Settings }) => void = () => {}
    let resolvePreview: (preview: PreviewOutput) => void = () => {}
    vi.mocked(putSettings).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve
      }),
    )
    vi.mocked(postPreview).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePreview = resolve
      }),
    )

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    const analyze = useAnalyzeStore()
    analyze.$patch({ phase: 'ready', preview: orderedPreview })
    await wrapper.vm.$nextTick()

    wrapper.findComponent(RoomList).vm.$emit('reorder', ['bedroom', 'kitchen'])
    await Promise.resolve()

    expect(analyze.phase).toBe('ready')
    expect(analyze.isRefreshingPreview).toBe(false)
    expect(wrapper.findComponent(RoomList).exists()).toBe(true)
    expect(wrapper.findComponent(ApplyBar).exists()).toBe(false)
    expect(postPreview).not.toHaveBeenCalled()

    resolveSave({ settings: savedSettings })
    await flushPromises()

    expect(analyze.phase).toBe('ready')
    expect(analyze.isRefreshingPreview).toBe(true)
    expect(wrapper.findComponent(RoomList).exists()).toBe(true)
    expect(wrapper.findComponent(ApplyBar).exists()).toBe(false)

    resolvePreview(orderedPreview)
    await flushPromises()
    expect(postPreview).toHaveBeenCalled()
    expect(analyze.isRefreshingPreview).toBe(false)
    expect(wrapper.findComponent(ApplyBar).exists()).toBe(true)
  })

  it('reverts the visible room drag draft when settings cannot load before saving', async () => {
    const orderedPreview: PreviewOutput = {
      ...mockPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'bedroom',
          haAreaId: 'bedroom',
          displayName: 'Bedroom',
          icon: 'mdi:bed',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'living_room',
          haAreaId: 'living_room',
          displayName: 'Living Room',
          icon: 'mdi:sofa',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }
    vi.mocked(getSettings).mockRejectedValue({
      error: 'settings_unavailable',
      message: 'settings unavailable',
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    const analyze = useAnalyzeStore()
    analyze.$patch({ phase: 'ready', preview: orderedPreview })
    await wrapper.vm.$nextTick()
    vi.mocked(putSettings).mockClear()
    vi.mocked(postPreview).mockClear()

    const roomList = wrapper.findComponent(RoomList)
    const dragStore = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (key: string, value: string) => dragStore.set(key, value),
      getData: (key: string) => dragStore.get(key) ?? '',
      setDragImage: vi.fn(),
    }
    const targetRow = roomList.findAll('[data-testid="room-row"]')[0]!

    await roomList.findAll('[data-testid="room-drag-handle"]')[2]!.trigger('dragstart', {
      dataTransfer,
    })
    await targetRow.trigger('dragover', { dataTransfer })
    expect(roomList.findAll('[data-testid="room-name"]').map((row) => row.text())).toEqual([
      'Living Room',
      'Bedroom',
      'Kitchen',
    ])

    await targetRow.trigger('drop', { dataTransfer })
    await flushPromises()

    expect(putSettings).not.toHaveBeenCalled()
    expect(postPreview).not.toHaveBeenCalled()
    expect(roomList.findAll('[data-testid="room-name"]').map((row) => row.text())).toEqual([
      'Bedroom',
      'Kitchen',
      'Living Room',
    ])
  })

  it('prevents applying a stale preview when room-order preview refresh fails', async () => {
    const orderedPreview: PreviewOutput = {
      ...mockPreview,
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
        {
          id: 'bedroom',
          haAreaId: 'bedroom',
          displayName: 'Bedroom',
          icon: 'mdi:bed',
          entityCount: 0,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }
    const savedSettings: Settings = {
      ...defaultSettings,
      roomOrder: ['bedroom', 'kitchen'],
    }
    vi.mocked(putSettings).mockResolvedValueOnce({ settings: savedSettings })
    vi.mocked(postPreview).mockRejectedValueOnce({
      error: 'preview_failed',
      message: 'refresh failed',
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    const analyze = useAnalyzeStore()
    analyze.$patch({ phase: 'ready', preview: orderedPreview })
    await wrapper.vm.$nextTick()

    wrapper.findComponent(RoomList).vm.$emit('reorder', ['bedroom', 'kitchen'])
    await flushPromises()

    expect(analyze.phase).toBe('error')
    expect(analyze.preview).toEqual(orderedPreview)
    expect(wrapper.findComponent(ApplyBar).exists()).toBe(false)
  })

  it('bulk-assigns 3 misc entities and saves through OverridesBar', async () => {
    // Initial preview: 3 misc entities, no rooms.
    const initialPreview: PreviewOutput = {
      rooms: [],
      misc: [
        { entityId: 'sensor.a', friendlyName: 'A', domain: 'sensor' },
        { entityId: 'sensor.b', friendlyName: 'B', domain: 'sensor' },
        { entityId: 'sensor.c', friendlyName: 'C', domain: 'sensor' },
      ],
      summary: { entityCount: 3, roomCount: 0, miscCount: 3 },
      config: { title: 'x', views: [] },
      diff: null,
      suggestions: [],
    }

    // After bulk-assign + save, the misc list shrinks (server response stub
    // returned by the post-save re-analyze).
    const reanalyzedPreview: PreviewOutput = {
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 3,
          averageConfidence: 1,
          assignments: [
            {
              entityId: 'sensor.a',
              roomId: 'kitchen',
              confidence: 1,
              signals: [],
              manual: true,
            },
            {
              entityId: 'sensor.b',
              roomId: 'kitchen',
              confidence: 1,
              signals: [],
              manual: true,
            },
            {
              entityId: 'sensor.c',
              roomId: 'kitchen',
              confidence: 1,
              signals: [],
              manual: true,
            },
          ],
        },
      ],
      misc: [],
      summary: { entityCount: 3, roomCount: 1, miscCount: 0 },
      config: { title: 'x', views: [] },
      diff: null,
      suggestions: [],
    }

    vi.mocked(getOverrides).mockResolvedValueOnce({ overrides: [] })
    vi.mocked(putOverrides).mockResolvedValueOnce({
      overrides: [
        { entityId: 'sensor.a', roomId: 'kitchen' },
        { entityId: 'sensor.b', roomId: 'kitchen' },
        { entityId: 'sensor.c', roomId: 'kitchen' },
      ],
    })
    // Only the post-save re-analyze hits postPreview in this flow — the
    // initial preview is injected via $patch (matches the existing e2e
    // test pattern above).
    vi.mocked(postPreview).mockResolvedValueOnce(reanalyzedPreview)

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    // Allow getInvite + getOnboarding mocks to resolve so showMainView is true.
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    const analyze = useAnalyzeStore()
    const overrides = useOverridesStore()

    // Bring app to ready state with 3 misc entities.
    analyze.$patch({ phase: 'ready', preview: initialPreview })
    await wrapper.vm.$nextTick()

    // Expand the misc bucket. With rooms: [], the only <details> is misc.
    await wrapper.find('details').trigger('click')
    await wrapper.vm.$nextTick()

    // Check all 3 misc rows.
    const checkboxes = wrapper.findAll('[data-testid="misc-row-checkbox"]')
    expect(checkboxes).toHaveLength(3)
    for (const cb of checkboxes) await cb.setValue(true)

    // Pick Kitchen and click Assign.
    await wrapper.find('[data-testid="misc-bulk-room"]').setValue('kitchen')
    await wrapper.find('[data-testid="misc-bulk-assign"]').trigger('click')
    await wrapper.vm.$nextTick()

    // OverridesBar should now show 3 dirty changes.
    expect(overrides.dirtyCount).toBe(3)

    // Click Save on the OverridesBar.
    await wrapper.find('[data-testid="save-button"]').trigger('click')
    // saveAndReanalyze runs putOverrides → setServerState → analyze.analyze()
    // → postPreview → setPreview, all chained microtasks. The two
    // `Promise.resolve()` flushes microtask queues; the `setTimeout(0)`
    // adds a macrotask flush because the bulk variant also runs three
    // setRoomId calls before Save (each one a reactive Pinia mutation),
    // which lengthens the chain enough that microtask flushes alone don't
    // fully drain it. Don't strip the setTimeout without re-running this
    // test against a deeper Pinia chain.
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    // putOverrides was called once with the bulk batch — three entries,
    // all assigned to kitchen.
    expect(putOverrides).toHaveBeenCalledTimes(1)
    const putArgs = vi.mocked(putOverrides).mock.calls[0]![0] as {
      overrides: { entityId: string; roomId?: string }[]
    }
    expect(putArgs.overrides).toHaveLength(3)
    expect(putArgs.overrides.every((o) => o.roomId === 'kitchen')).toBe(true)

    // Re-analyze fired after save.
    expect(postPreview).toHaveBeenCalledTimes(1)
  })
})

describe('App invite gate', () => {
  beforeEach(() => {
    vi.mocked(getInvite).mockReset()
    vi.mocked(getSettings).mockReset().mockResolvedValue({ settings: defaultSettings })
  })

  it('calls invite.loadStatus on mount', async () => {
    vi.mocked(getInvite).mockResolvedValueOnce({ accepted: true })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await wrapper.vm.$nextTick()

    expect(getInvite).toHaveBeenCalledOnce()
  })

  it('renders InviteGate when accepted === false', async () => {
    vi.mocked(getInvite).mockResolvedValueOnce({ accepted: false })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
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
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
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
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
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
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
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
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
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

describe('App.vue — onboarding gating (P2-7)', () => {
  beforeEach(() => {
    // Reset both mocks each test — earlier tests in the file may have
    // installed `mockReturnValueOnce` queues that would leak in.
    vi.mocked(getInvite).mockReset().mockResolvedValue({ accepted: true })
    vi.mocked(getOnboarding).mockReset().mockResolvedValue({ completedAt: 1700000000 })
    vi.mocked(getSettings).mockReset().mockResolvedValue({ settings: defaultSettings })
  })

  it('initial render (both invite and onboarding loading): all three views hidden', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    // No call to loadStatus has resolved yet — accepted is null, completedAt undefined.
    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="onboarding-wizard"]').exists()).toBe(false)
    expect(wrapper.find('main').exists()).toBe(false)
  })

  it('invite accepted, onboarding pending → wizard visible, main hidden', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const invite = useInviteStore()
    const onboarding = useOnboardingStore()
    invite.accepted = true
    onboarding.completedAt = null
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="onboarding-wizard"]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
  })

  it('invite accepted, onboarding completed → main visible, wizard hidden', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const invite = useInviteStore()
    const onboarding = useOnboardingStore()
    invite.accepted = true
    onboarding.completedAt = 1700000000
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="onboarding-wizard"]').exists()).toBe(false)
    expect(wrapper.find('main').exists()).toBe(true)
  })

  it('invite not accepted → InviteGate visible, neither wizard nor main', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const invite = useInviteStore()
    invite.accepted = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="onboarding-wizard"]').exists()).toBe(false)
    expect(wrapper.find('main').exists()).toBe(false)
  })

  it('main view does not flash during invite acceptance after a stale onboarding 403 (regression: Bugbot #25 Medium flicker)', async () => {
    // Bug: on a fresh install, the initial onboarding.loadStatus 403'd
    // (gated), leaving phase='error' and isResolved=true. When invite
    // was accepted, the post-flush retry watch fired AFTER Vue's
    // render — so `showMainView` briefly evaluated true with the stale
    // resolved state, flashing the main view before the wizard mounted.
    //
    // Fix: drop the speculative onMounted load and gate loadStatus on
    // invite.accepted via a `flush: 'pre'` watch so the synchronous
    // `phase='loading'` mutation lands before the next render.
    let resolveSecondLoad: (v: { completedAt: number | null }) => void = () => {}
    const secondLoadPromise = new Promise<{ completedAt: number | null }>((r) => {
      resolveSecondLoad = r
    })
    vi.mocked(getOnboarding).mockReset().mockReturnValueOnce(secondLoadPromise)
    vi.mocked(getInvite).mockReset().mockResolvedValue({ accepted: false })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    await flushPromises()
    // Invite gate is up; onboarding.loadStatus has NOT yet fired (no
    // onMounted call), so the store is in its initial state.
    const onboarding = useOnboardingStore()
    expect(onboarding.phase).toBe('idle')
    expect(onboarding.completedAt).toBeUndefined()

    // Simulate invite acceptance.
    const invite = useInviteStore()
    invite.accepted = true
    // Pre-flush watch fires synchronously and queues loadStatus, which
    // synchronously sets phase='loading'. After nextTick, the render
    // should see isResolved=false and hide both views.
    await wrapper.vm.$nextTick()
    expect(onboarding.phase).toBe('loading')
    expect(onboarding.isResolved).toBe(false)
    expect(wrapper.find('main').exists()).toBe(false) // no flicker
    expect(wrapper.find('[data-testid="onboarding-wizard"]').exists()).toBe(false)

    // Now resolve the load — the wizard should mount.
    resolveSecondLoad({ completedAt: null })
    await flushPromises()
    expect(wrapper.find('[data-testid="onboarding-wizard"]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
  })

  it('invite accepted, onboarding load failed → main view visible, wizard hidden (regression: Bugbot #25 Medium blank screen)', async () => {
    // Regression: when GET /api/onboarding fails (network error), completedAt
    // stays undefined and shouldShowWizard stays false. Without an isResolved
    // fallback, `showMainView` would be false too — the user would see a
    // blank page with no recovery. The store's isResolved computed flips
    // true on phase==='error', so App.vue's gating fails open into main.
    //
    // Override the default mock so loadStatus rejects (the auto-resolve in
    // the file-level beforeEach would otherwise set completedAt to a
    // timestamp, masking the bug).
    vi.mocked(getOnboarding).mockReset().mockRejectedValue({
      error: 'network',
      message: 'connection lost',
    })
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const invite = useInviteStore()
    const onboarding = useOnboardingStore()
    invite.accepted = true
    // Wait for loadStatus to reject and store state to settle.
    await flushPromises()
    expect(onboarding.phase).toBe('error')
    expect(onboarding.completedAt).toBeUndefined()
    expect(onboarding.isResolved).toBe(true)
    expect(wrapper.find('main').exists()).toBe(true)
    expect(wrapper.find('[data-testid="onboarding-wizard"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(false)
  })

  it('wizard stays mounted after onboarding.completedAt flips to a number (until close emit) — P2-7 Bug 2 regression', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const invite = useInviteStore()
    const onboarding = useOnboardingStore()
    invite.accepted = true
    onboarding.completedAt = null
    await wrapper.vm.$nextTick()

    // Wizard should be mounted because wizardOpen was set true by the watch.
    expect(wrapper.find('[data-testid="onboarding-wizard"]').exists()).toBe(true)

    // Simulate the apply-success watch flipping completedAt to a number
    // (what onboarding.complete() does in the background).
    onboarding.completedAt = 1700000000
    await wrapper.vm.$nextTick()

    // Wizard should still be mounted — App.vue gates on wizardOpen (which
    // only flips false on the close emit), not on shouldShowWizard directly.
    expect(wrapper.find('[data-testid="onboarding-wizard"]').exists()).toBe(true)

    // Once the wizard emits close, the wizard should unmount and main appears.
    await wrapper.findComponent({ name: 'OnboardingWizard' }).vm.$emit('close')
    await flushPromises()
    expect(wrapper.find('[data-testid="onboarding-wizard"]').exists()).toBe(false)
    expect(wrapper.find('main').exists()).toBe(true)
  })
})

describe('App.vue — i18n cross-device reconciliation (P2-9)', () => {
  beforeEach(() => {
    vi.mocked(getInvite).mockReset().mockResolvedValue({ accepted: true })
    vi.mocked(getOnboarding).mockReset().mockResolvedValue({ completedAt: 1700000000 })
    vi.mocked(getSettings).mockReset().mockResolvedValue({ settings: defaultSettings })
    // Start each test with a clean localStorage. The new optional design
    // means the watcher distinguishes "user has explicitly picked a UI
    // language" (server returns uiLanguage as a string) from "no choice
    // yet" (server returns the field absent) — no localStorage heuristic
    // is involved. Tests opt back into a cached value where they need
    // one.
    localStorage.removeItem('lovelacer.uiLocale')
  })

  it('reconciles useI18nStore.locale to settings.serverState.uiLanguage after server load', async () => {
    // Spec §4: when loadFromServer() resolves and the server's uiLanguage
    // differs from the current locale (e.g. user opens Device B with
    // a stale localStorage 'en' cache; server has 'cs' from Device A),
    // the server value wins and the UI updates without manual re-pick.
    mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const settings = useSettingsStore()
    const i18n = useI18nStore()
    expect(i18n.locale).toBe('en')

    // Simulate loadFromServer() resolving with cs.
    const serverSettings: Settings = {
      language: 'auto',
      cardPack: 'default',
      sections: {
        welcome: true,
        quickStats: true,
        people: true,
        roomsByFloor: true,
        activeRooms: true,
        scenes: true,
        cameras: true,
      },
      uiLanguage: 'cs',
    }
    settings.serverState = serverSettings
    await flushPromises()

    expect(i18n.locale).toBe('cs')
  })

  it('reconciliation watcher does NOT override an explicit user locale change during loadFromServer race', async () => {
    // Spec §4: "if the user changes UI language before settings load
    // completes, the user's choice is preserved." Race: app mounts
    // (initialLocale = 'en') → user picks 'de' before server load
    // resolves → server returns 'cs' → guard prevents override.
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const settings = useSettingsStore()
    const i18n = useI18nStore()
    expect(i18n.locale).toBe('en') // initialLocale baseline

    // User explicitly picks German before server load resolves.
    i18n.locale = 'de'
    await flushPromises()
    expect(i18n.locale).toBe('de')

    // Server load now resolves with 'cs' — the guard sees that the
    // current locale ('de') no longer equals the captured initialLocale
    // ('en'), so it must NOT override.
    settings.serverState = {
      language: 'auto',
      cardPack: 'default',
      sections: {
        welcome: true,
        quickStats: true,
        people: true,
        roomsByFloor: true,
        activeRooms: true,
        scenes: true,
        cameras: true,
      },
      uiLanguage: 'cs',
    }
    await flushPromises()

    expect(i18n.locale).toBe('de') // user's explicit choice preserved
    void wrapper
  })

  it('does not flip the locale when serverState.uiLanguage matches the active locale', async () => {
    // Smoke test for the equality guard — without it, the watcher would
    // re-write localStorage on every server-state load even when nothing
    // changed.
    mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const settings = useSettingsStore()
    const i18n = useI18nStore()
    // Simulate a same-value reconcile: locale already 'en', server 'en'.
    expect(i18n.locale).toBe('en')
    settings.serverState = {
      language: 'auto',
      cardPack: 'default',
      sections: {
        welcome: true,
        quickStats: true,
        people: true,
        roomsByFloor: true,
        activeRooms: true,
        scenes: true,
        cameras: true,
      },
      uiLanguage: 'en',
    }
    await flushPromises()

    expect(i18n.locale).toBe('en')
  })

  it('reconciliation watcher does NOT override a browser-detected locale on a fresh install (regression: cursor[bot] medium)', async () => {
    // Scenario: empty localStorage + cs-CZ browser language →
    // detectInitialLocale returns 'cs' → vue-i18n bootstraps with
    // locale 'cs'. Server has never had the user pick a UI language,
    // so it returns Settings WITHOUT a `uiLanguage` field. The watcher
    // sees `next === undefined`, the truthy check filters it out, and
    // the browser-detected 'cs' is preserved.
    //
    // This is the proper P2-9 contract: the absence of `uiLanguage`
    // means "no explicit user choice" — it does NOT mean "default to
    // 'en'." Substituting a default would make every fresh install on
    // a non-EN browser flash from the browser language to 'en' on first
    // settings load.

    // Build a vue-i18n instance pre-set to 'cs' (mirrors what
    // detectInitialLocale + createI18n do in production when the
    // browser language is cs-CZ and localStorage is empty).
    const csI18n = createI18n({
      legacy: false,
      locale: 'cs',
      fallbackLocale: 'en',
      flatJson: true,
      messages: { en: enLocale, cs: csLocale },
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), csI18n],
      },
    })
    const settings = useSettingsStore()
    const i18n = useI18nStore()
    expect(i18n.locale).toBe('cs') // browser-detected baseline

    // Server load resolves WITHOUT uiLanguage — the user has never
    // explicitly picked a UI language, so the field is absent. The
    // watcher's truthy-check on `next` filters this out and the
    // browser-detected 'cs' wins.
    settings.serverState = {
      language: 'auto',
      cardPack: 'default',
      sections: {
        welcome: true,
        quickStats: true,
        people: true,
        roomsByFloor: true,
        activeRooms: true,
        scenes: true,
        cameras: true,
      },
      // uiLanguage intentionally omitted (optional field)
    }
    await flushPromises()

    expect(i18n.locale).toBe('cs') // browser-detected locale preserved
    void wrapper
  })

  it('reconciles to server uiLanguage on a fresh device with empty localStorage (cross-device sync)', async () => {
    // Scenario the previous `hadCachedLocale` guard broke: the user has
    // explicitly picked 'cs' on Device A. They open the app on Device B
    // where localStorage is empty and browser language is en-US, so
    // detectInitialLocale returns 'en' and vue-i18n bootstraps with 'en'.
    // The server returns `uiLanguage: 'cs'` (a real explicit choice).
    // The watcher MUST sync to 'cs' so the user sees their saved choice
    // without re-picking on every device.
    //
    // Per spec §4: cross-device sync is the whole point of persisting
    // `uiLanguage` server-side.
    expect(localStorage.getItem('lovelacer.uiLocale')).toBeNull()

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const settings = useSettingsStore()
    const i18n = useI18nStore()
    expect(i18n.locale).toBe('en') // browser-detected baseline (en-US default)

    // Server returns the user's explicit choice from another device.
    settings.serverState = {
      language: 'auto',
      cardPack: 'default',
      sections: {
        welcome: true,
        quickStats: true,
        people: true,
        roomsByFloor: true,
        activeRooms: true,
        scenes: true,
        cameras: true,
      },
      uiLanguage: 'cs',
    }
    await flushPromises()

    expect(i18n.locale).toBe('cs') // synced to user's saved choice
    void wrapper
  })
})
