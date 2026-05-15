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

    const listRow = wrapper.find('[data-testid="administrative-entity-list-row"]')
    expect(listRow.classes()).toEqual(
      expect.arrayContaining([
        'odd:bg-white',
        'even:bg-stone-50/25',
        'hover:bg-amber-50/10',
        'transition-colors',
      ]),
    )
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

  it('filters administrative entities by entity id and friendly name', async () => {
    const wrapper = mountPanel([
      {
        entityId: 'sensor.kitchen_voltage',
        friendlyName: 'Kitchen Voltage',
        domain: 'sensor',
        roomId: 'kitchen',
      },
      {
        entityId: 'button.router_restart',
        friendlyName: 'Router Restart',
        domain: 'button',
      },
    ])

    await wrapper.find('[data-testid="section-search"]').setValue('router')

    expect(wrapper.findAll('[data-testid="entity-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('button.router_restart')
    expect(wrapper.text()).toContain('Router Restart')
    expect(wrapper.text()).not.toContain('sensor.kitchen_voltage')

    await wrapper.find('[data-testid="section-search"]').setValue('voltage')

    expect(wrapper.findAll('[data-testid="entity-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('sensor.kitchen_voltage')
    expect(wrapper.text()).not.toContain('button.router_restart')
  })

  it('shows an empty search state when no administrative entity matches', async () => {
    const wrapper = mountPanel([
      {
        entityId: 'sensor.kitchen_voltage',
        friendlyName: 'Kitchen Voltage',
        domain: 'sensor',
      },
    ])

    await wrapper.find('[data-testid="section-search"]').setValue('missing')

    expect(wrapper.findAll('[data-testid="entity-row"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No matching entities')
  })
})
