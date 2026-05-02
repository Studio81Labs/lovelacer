import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RemovedEntitiesPanel from '../../components/RemovedEntitiesPanel.vue'
import type { DiffResult } from '../../api/types.js'

function mountPanel(diff: DiffResult) {
  return mount(RemovedEntitiesPanel, { props: { diff } })
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
})
