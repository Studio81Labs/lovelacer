import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import AdministrativeEntitiesPanel from '../../components/AdministrativeEntitiesPanel.vue'
import { useOverridesStore } from '../../stores/overrides.js'
import { createTestI18n } from '../test-utils.js'
import type { AdministrativeEntity } from '../../api/types.js'

function mountPanel(administrative: AdministrativeEntity[]) {
  return mount(AdministrativeEntitiesPanel, {
    props: { administrative },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })
}

describe('AdministrativeEntitiesPanel', () => {
  it('does not render when no administrative entities exist', () => {
    const wrapper = mountPanel([])
    expect(wrapper.find('[data-testid="administrative-entities-panel"]').exists()).toBe(false)
  })

  it('lists soft-hidden administrative entities with their detected room', () => {
    const wrapper = mountPanel([
      {
        entityId: 'sensor.kitchen_voltage',
        friendlyName: 'Kitchen Voltage',
        domain: 'sensor',
        roomId: 'kitchen',
      },
    ])

    const panel = wrapper.find('[data-testid="administrative-entities-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.find('summary').text()).toContain('1 administrative entity')
    expect(panel.text()).toContain('Kitchen Voltage')
    expect(panel.text()).toContain('sensor.kitchen_voltage')
    expect(panel.text()).toContain('Detected room: Kitchen')
  })

  it('stages a room override when the user assigns an administrative entity', async () => {
    const wrapper = mountPanel([
      {
        entityId: 'sensor.kitchen_voltage',
        friendlyName: 'Kitchen Voltage',
        domain: 'sensor',
        roomId: 'kitchen',
      },
    ])
    const overrides = useOverridesStore()

    await wrapper.find('[data-testid="room-select"]').setValue('kitchen')

    expect(overrides.effective('sensor.kitchen_voltage')).toEqual({
      entityId: 'sensor.kitchen_voltage',
      roomId: 'kitchen',
    })
  })
})
