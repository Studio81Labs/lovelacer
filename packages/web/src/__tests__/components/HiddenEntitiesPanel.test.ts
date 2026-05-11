import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import HiddenEntitiesPanel from '../../components/HiddenEntitiesPanel.vue'
import { useOverridesStore } from '../../stores/overrides.js'
import { createTestI18n } from '../test-utils.js'
import type { HiddenEntity } from '../../api/types.js'

function mountPanel(hiddenEntities: HiddenEntity[] = []) {
  return mount(HiddenEntitiesPanel, {
    props: { 'hidden-entities': hiddenEntities },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })
}

describe('HiddenEntitiesPanel', () => {
  it('does not render when no hidden overrides exist', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="hidden-entities-panel"]').exists()).toBe(false)
  })

  it('lists hidden overrides and stages unhide when clicked', async () => {
    const wrapper = mountPanel([
      {
        entityId: 'sensor.rssi',
        friendlyName: 'Kitchen RSSI',
        domain: 'sensor',
      },
    ])
    const overrides = useOverridesStore()
    overrides.setHidden('sensor.rssi', true)
    overrides.setHidden('button.restart', true)
    await wrapper.vm.$nextTick()

    const panel = wrapper.find('[data-testid="hidden-entities-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.element.tagName).toBe('DETAILS')
    expect(panel.find('summary').text()).toContain('Hidden from dashboard')
    expect(panel.text()).toContain('Hidden from dashboard')
    expect(panel.text()).toContain('Kitchen RSSI')
    expect(panel.text()).toContain('sensor.rssi')
    expect(panel.text()).toContain('button.restart')

    const unhideButtons = wrapper.findAll('[data-testid="hidden-entity-unhide"]')
    expect(unhideButtons).toHaveLength(2)
    await unhideButtons[0]!.trigger('click')

    expect(overrides.effective('sensor.rssi')).toEqual({ entityId: 'sensor.rssi', hidden: true })
    expect(overrides.effective('button.restart')).toBeNull()
  })
})
