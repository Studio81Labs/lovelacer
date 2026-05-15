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

    const listRows = wrapper.findAll('[data-testid="hidden-entity-list-row"]')
    expect(listRows[0]!.classes()).toEqual(
      expect.arrayContaining([
        'odd:bg-white',
        'even:bg-stone-50/25',
        'hover:bg-amber-50/10',
        'transition-colors',
      ]),
    )

    const unhideButtons = wrapper.findAll('[data-testid="hidden-entity-unhide"]')
    expect(unhideButtons).toHaveLength(2)
    await unhideButtons[0]!.trigger('click')

    expect(overrides.effective('sensor.rssi')).toEqual({ entityId: 'sensor.rssi', hidden: true })
    expect(overrides.effective('button.restart')).toBeNull()
  })

  it('filters hidden entities by metadata and fallback entity id', async () => {
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

    await wrapper.find('[data-testid="section-search"]').setValue('kitchen')

    expect(wrapper.text()).toContain('Kitchen RSSI')
    expect(wrapper.text()).toContain('sensor.rssi')
    expect(wrapper.text()).not.toContain('button.restart')

    await wrapper.find('[data-testid="section-search"]').setValue('button.restart')

    expect(wrapper.text()).toContain('button.restart')
    expect(wrapper.text()).not.toContain('Kitchen RSSI')
  })

  it('shows an empty search state when no hidden entity matches', async () => {
    const wrapper = mountPanel([
      {
        entityId: 'sensor.rssi',
        friendlyName: 'Kitchen RSSI',
        domain: 'sensor',
      },
    ])
    const overrides = useOverridesStore()
    overrides.setHidden('sensor.rssi', true)
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="section-search"]').setValue('missing')

    expect(wrapper.findAll('[data-testid="hidden-entity-unhide"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No matching entities')
  })
})
