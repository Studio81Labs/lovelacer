import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SuggestionsPanel from '../../components/SuggestionsPanel.vue'
import type { Suggestion } from '../../api/types.js'
import { useOverridesStore } from '../../stores/overrides.js'
import { useSuggestionsStore } from '../../stores/suggestions.js'
import { createTestI18n } from '../test-utils.js'

vi.mock('../../api/client.js', () => ({
  postDismissSuggestion: vi.fn().mockResolvedValue(undefined),
  // overrides store may import these — keep the surface complete:
  getOverrides: vi.fn(),
  putOverrides: vi.fn(),
  postPreview: vi.fn(),
  postAnalyze: vi.fn(),
  postApply: vi.fn(),
  getInvite: vi.fn(),
  postInvite: vi.fn(),
}))

function mountPanel(suggestions: Suggestion[]) {
  return mount(SuggestionsPanel, {
    props: { suggestions },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })
}

const setAreaSuggestion: Suggestion = {
  entityId: 'sensor.lamp',
  type: 'set_area_id',
  message: 'No area in HA. Go set it.',
  matchedRoomId: 'living_room',
}

const moveRoomSuggestion: Suggestion = {
  entityId: 'sensor.fan',
  type: 'move_room',
  message: 'Low confidence. Try kitchen?',
  suggestedRoomId: 'kitchen',
}

const hideDiagSuggestion: Suggestion = {
  entityId: 'sensor.batt',
  type: 'hide_diagnostic',
  message: 'Diagnostic. Hide?',
}

describe('SuggestionsPanel', () => {
  beforeEach(() => {
    // Mock window.open — used by the set_area_id Accept verb.
    vi.stubGlobal('open', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when suggestions is empty', () => {
    const wrapper = mountPanel([])
    expect(wrapper.find('[data-testid="suggestions-panel"]').exists()).toBe(false)
  })

  it('renders one card per suggestion with the right Accept label', () => {
    const wrapper = mountPanel([setAreaSuggestion, moveRoomSuggestion, hideDiagSuggestion])
    const cards = wrapper.findAll('[data-testid="suggestion-card"]')
    expect(cards).toHaveLength(3)

    const acceptButtons = wrapper.findAll('[data-testid="suggestion-accept"]')
    expect(acceptButtons[0]!.text()).toBe('Open HA settings')
    expect(acceptButtons[1]!.text()).toContain('Move to Kitchen')
    expect(acceptButtons[2]!.text()).toBe('Hide')
  })

  it('Accept on set_area_id calls window.open with the deep-link URL', async () => {
    const wrapper = mountPanel([setAreaSuggestion])
    await wrapper.find('[data-testid="suggestion-accept"]').trigger('click')
    expect(window.open).toHaveBeenCalledWith('/config/entities?entity_id=sensor.lamp', '_blank')
  })

  it('Accept on move_room calls overrides.setRoomId(entityId, suggestedRoomId)', async () => {
    const wrapper = mountPanel([moveRoomSuggestion])
    const overrides = useOverridesStore()
    await wrapper.find('[data-testid="suggestion-accept"]').trigger('click')
    expect(overrides.setRoomId).toHaveBeenCalledWith('sensor.fan', 'kitchen')
  })

  it('Accept on hide_diagnostic calls overrides.setHidden(entityId, true)', async () => {
    const wrapper = mountPanel([hideDiagSuggestion])
    const overrides = useOverridesStore()
    await wrapper.find('[data-testid="suggestion-accept"]').trigger('click')
    expect(overrides.setHidden).toHaveBeenCalledWith('sensor.batt', true)
  })

  it('Accept on hide_diagnostic removes the card immediately', async () => {
    const wrapper = mountPanel([hideDiagSuggestion])
    await wrapper.find('[data-testid="suggestion-accept"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="suggestion-card"]').exists()).toBe(false)
  })

  it('Dismiss calls suggestionsStore.dismiss(entityId, type)', async () => {
    const wrapper = mountPanel([setAreaSuggestion])
    const suggestions = useSuggestionsStore()
    await wrapper.find('[data-testid="suggestion-dismiss"]').trigger('click')
    expect(suggestions.dismiss).toHaveBeenCalledWith('sensor.lamp', 'set_area_id')
  })

  it('hides a card whose key is in the optimistic-dismissed set', async () => {
    const wrapper = mountPanel([setAreaSuggestion, moveRoomSuggestion])
    const suggestions = useSuggestionsStore()
    expect(wrapper.findAll('[data-testid="suggestion-card"]')).toHaveLength(2)

    // Mutate the optimistic set directly to model the post-dismiss state.
    suggestions.optimisticallyDismissed = new Set([
      `${setAreaSuggestion.entityId}|${setAreaSuggestion.type}`,
    ])
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('[data-testid="suggestion-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0]!.text()).toContain('sensor.fan')
  })

  it('disables both Accept and Dismiss buttons while phase is dismissing', async () => {
    const wrapper = mountPanel([setAreaSuggestion])
    const suggestions = useSuggestionsStore()
    suggestions.phase = 'dismissing'
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="suggestion-accept"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="suggestion-dismiss"]').attributes('disabled')).toBeDefined()
  })

  it('renders only the first page of a large suggestion list until Show all is clicked', async () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
      ...hideDiagSuggestion,
      entityId: `sensor.diag_${index}`,
    }))
    const wrapper = mountPanel(many)

    expect(wrapper.findAll('[data-testid="suggestion-card"]')).toHaveLength(20)
    expect(wrapper.find('[data-testid="suggestions-truncated"]').text()).toContain(
      'Showing 20 of 25',
    )

    await wrapper.find('[data-testid="suggestions-show-all"]').trigger('click')
    expect(wrapper.findAll('[data-testid="suggestion-card"]')).toHaveLength(25)
  })
})
