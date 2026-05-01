import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import OverridesBar from '../../components/OverridesBar.vue'
import { useOverridesStore } from '../../stores/overrides.js'
import type { ApiError } from '../../api/types.js'

function mountBar() {
  return mount(OverridesBar, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
    },
  })
}

describe('OverridesBar', () => {
  it('does not render when hasDirty is false', () => {
    const wrapper = mountBar()
    expect(wrapper.find('[data-testid="overrides-bar"]').exists()).toBe(false)
  })

  it('renders dirty count when hasDirty is true', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')
    store.setRoomId('c.d', 'bedroom')

    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="overrides-bar"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('2 pending changes')
  })

  it('renders "1 pending change" (singular) for a single edit', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('1 pending change')
    expect(wrapper.text()).not.toContain('1 pending changes')
  })

  it('Discard button calls discardChanges', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')

    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="discard-button"]').trigger('click')

    expect(store.hasDirty).toBe(false)
  })

  it('Save button calls saveAndReanalyze', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    const saveSpy = vi.spyOn(store, 'saveAndReanalyze').mockResolvedValueOnce(undefined)
    store.setRoomId('a.b', 'kitchen')

    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(saveSpy).toHaveBeenCalledOnce()
  })

  it('shows "Saving…" and disables both buttons during phase=saving', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')
    store.$patch({ phase: 'saving' })

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Saving…')
    const saveBtn = wrapper.find('[data-testid="save-button"]')
    const discardBtn = wrapper.find('[data-testid="discard-button"]')
    expect((saveBtn.element as HTMLButtonElement).disabled).toBe(true)
    expect((discardBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows error message and Retry button on phase=error', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')
    const apiError: ApiError = { error: 'storage_error', message: 'disk full' }
    store.$patch({ phase: 'error', error: apiError })

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('disk full')
    expect(wrapper.find('[data-testid="retry-button"]').exists()).toBe(true)
  })

  it('Discard button stays accessible in error state', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    store.setRoomId('a.b', 'kitchen')
    const apiError: ApiError = { error: 'storage_error', message: 'disk full' }
    store.$patch({ phase: 'error', error: apiError })

    await wrapper.vm.$nextTick()
    const discardBtn = wrapper.find('[data-testid="discard-button"]')
    expect(discardBtn.exists()).toBe(true)
    expect((discardBtn.element as HTMLButtonElement).disabled).toBe(false)

    // Save button is hidden in error state (replaced by Retry).
    expect(wrapper.find('[data-testid="save-button"]').exists()).toBe(false)
  })

  it('Retry button calls saveAndReanalyze', async () => {
    const wrapper = mountBar()
    const store = useOverridesStore()
    const saveSpy = vi.spyOn(store, 'saveAndReanalyze').mockResolvedValueOnce(undefined)
    store.setRoomId('a.b', 'kitchen')
    store.$patch({ phase: 'error', error: { error: 'storage_error', message: 'oops' } })

    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="retry-button"]').trigger('click')

    expect(saveSpy).toHaveBeenCalledOnce()
  })
})
