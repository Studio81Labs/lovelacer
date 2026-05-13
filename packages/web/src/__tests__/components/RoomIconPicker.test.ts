import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { Icon } from '@iconify/vue'
import RoomIconPicker from '../../components/RoomIconPicker.vue'
import { createTestI18n } from '../test-utils.js'

describe('RoomIconPicker', () => {
  it('searches the MDI collection and emits the selected mdi icon', async () => {
    const wrapper = mount(RoomIconPicker, {
      props: { modelValue: 'mdi:silverware-fork-knife' },
      global: { plugins: [createTestI18n()] },
    })

    await wrapper.find('[data-testid="room-icon-picker-button"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="room-icon-search"]').setValue('coffee')

    let coffee = wrapper
      .findAll('[data-testid="room-icon-option"]')
      .find((option) => option.text().includes('mdi:coffee'))
    await vi.waitFor(() => {
      coffee = wrapper
        .findAll('[data-testid="room-icon-option"]')
        .find((option) => option.text().includes('mdi:coffee'))
      expect(coffee).toBeDefined()
    })
    expect(coffee!.findComponent(Icon).vm.$attrs['icon']).toBe('mdi:coffee')

    await coffee!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['mdi:coffee'])
  })

  it('keeps the current icon visible in the trigger', () => {
    const wrapper = mount(RoomIconPicker, {
      props: { modelValue: 'mdi:sofa' },
      global: { plugins: [createTestI18n()] },
    })

    expect(wrapper.find('[data-testid="room-icon-selected"]').text()).toContain('mdi:sofa')
    expect(wrapper.findComponent(Icon).vm.$attrs['icon']).toBe('mdi:sofa')
  })

  it('shows the current icon as the first option when opened', async () => {
    const wrapper = mount(RoomIconPicker, {
      props: { modelValue: 'mdi:garage-variant' },
      global: { plugins: [createTestI18n()] },
    })

    await wrapper.find('[data-testid="room-icon-picker-button"]').trigger('click')
    await flushPromises()

    const firstOption = wrapper.find('[data-testid="room-icon-option"]')
    expect(firstOption.text()).toContain('mdi:garage-variant')
    expect(firstOption.attributes('aria-selected')).toBe('true')
  })

  it('falls back to a default icon when the model value is missing', () => {
    const wrapper = mount(RoomIconPicker, {
      props: { modelValue: undefined },
      global: { plugins: [createTestI18n()] },
    })

    expect(wrapper.find('[data-testid="room-icon-selected"]').text()).toContain('mdi:home-outline')
    expect(wrapper.findComponent(Icon).vm.$attrs['icon']).toBe('mdi:home-outline')
  })

  it('closes the options list when clicking outside or pressing escape', async () => {
    const wrapper = mount(RoomIconPicker, {
      props: { modelValue: 'mdi:sofa' },
      attachTo: document.body,
      global: { plugins: [createTestI18n()] },
    })

    await wrapper.find('[data-testid="room-icon-picker-button"]').trigger('click')
    expect(wrapper.find('[data-testid="room-icon-search"]').exists()).toBe(true)

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="room-icon-search"]').exists()).toBe(false)

    await wrapper.find('[data-testid="room-icon-picker-button"]').trigger('click')
    expect(wrapper.find('[data-testid="room-icon-search"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="room-icon-search"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
