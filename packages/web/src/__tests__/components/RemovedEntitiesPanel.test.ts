import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RemovedEntitiesPanel from '../../components/RemovedEntitiesPanel.vue'
import type { DiffResult } from '../../api/types.js'
import { createTestI18n } from '../test-utils.js'

function mountPanel(diff: DiffResult) {
  return mount(RemovedEntitiesPanel, {
    props: { diff },
    global: { plugins: [createTestI18n()] },
  })
}

describe('RemovedEntitiesPanel', () => {
  it('renders nothing when no removed entities', () => {
    const wrapper = mountPanel({
      entities: [],
      perRoom: {},
      totals: { added: 1, moved: 0, removed: 0 },
      appliedAt: 0,
    })
    expect(wrapper.find('[data-testid="removed-panel"]').exists()).toBe(false)
  })

  it('lists each removed entity with its previous room name', () => {
    const wrapper = mountPanel({
      entities: [
        { entityId: 'light.guest_lamp', kind: 'removed', previousRoomId: 'guest_room' },
        { entityId: 'sensor.gone', kind: 'removed', previousRoomId: 'kitchen' },
      ],
      perRoom: {},
      totals: { added: 0, moved: 0, removed: 2 },
      appliedAt: 0,
    })
    const panel = wrapper.find('[data-testid="removed-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('light.guest_lamp')
    expect(panel.text()).toContain('Guest Room')
    expect(panel.text()).toContain('sensor.gone')
    expect(panel.text()).toContain('Kitchen')
  })

  it('renders "Misc" when previousRoomId is null', () => {
    const wrapper = mountPanel({
      entities: [{ entityId: 'sensor.was_misc', kind: 'removed', previousRoomId: null }],
      perRoom: {},
      totals: { added: 0, moved: 0, removed: 1 },
      appliedAt: 0,
    })
    const panel = wrapper.find('[data-testid="removed-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('Misc')
  })

  it('only renders entities with kind=removed (ignores added/moved that may share the diff)', () => {
    const wrapper = mountPanel({
      entities: [
        { entityId: 'light.added', kind: 'added', currentRoomId: 'kitchen' },
        { entityId: 'light.gone', kind: 'removed', previousRoomId: 'office' },
      ],
      perRoom: {},
      totals: { added: 1, moved: 0, removed: 1 },
      appliedAt: 0,
    })
    const panel = wrapper.find('[data-testid="removed-panel"]')
    expect(panel.text()).toContain('light.gone')
    expect(panel.text()).not.toContain('light.added')
  })

  it('caps the removed entity list and lets users expand it', async () => {
    const removed = Array.from({ length: 12 }, (_, index) => ({
      entityId: `sensor.removed_${index + 1}`,
      kind: 'removed' as const,
      previousRoomId: 'office',
    }))
    const wrapper = mountPanel({
      entities: removed,
      perRoom: {},
      totals: { added: 0, moved: 0, removed: removed.length },
      appliedAt: 0,
    })

    expect(wrapper.findAll('[data-testid="removed-entity"]')).toHaveLength(10)
    expect(wrapper.text()).toContain('12 entities removed since last apply')
    expect(wrapper.text()).toContain('sensor.removed_10')
    expect(wrapper.text()).not.toContain('sensor.removed_11')

    const toggle = wrapper.get('[data-testid="removed-entities-toggle"]')
    expect(toggle.text()).toBe('Show 2 more')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')

    expect(wrapper.findAll('[data-testid="removed-entity"]')).toHaveLength(12)
    expect(wrapper.text()).toContain('sensor.removed_12')
    expect(toggle.text()).toBe('Show fewer')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('collapses the preview when a fresh diff arrives', async () => {
    const makeRemoved = (prefix: string) =>
      Array.from({ length: 12 }, (_, index) => ({
        entityId: `sensor.${prefix}_${index + 1}`,
        kind: 'removed' as const,
        previousRoomId: 'office',
      }))
    const wrapper = mountPanel({
      entities: makeRemoved('old'),
      perRoom: {},
      totals: { added: 0, moved: 0, removed: 12 },
      appliedAt: 0,
    })

    await wrapper.get('[data-testid="removed-entities-toggle"]').trigger('click')
    expect(wrapper.findAll('[data-testid="removed-entity"]')).toHaveLength(12)

    await wrapper.setProps({
      diff: {
        entities: makeRemoved('new'),
        perRoom: {},
        totals: { added: 0, moved: 0, removed: 12 },
        appliedAt: 1,
      },
    })

    expect(wrapper.findAll('[data-testid="removed-entity"]')).toHaveLength(10)
    expect(wrapper.text()).toContain('sensor.new_10')
    expect(wrapper.text()).not.toContain('sensor.new_11')
  })
})
