import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import InviteGate from '../../components/InviteGate.vue'
import { useInviteStore } from '../../stores/invite.js'
import type { ApiError } from '../../api/types.js'

function mountGate() {
  return mount(InviteGate, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
    },
  })
}

describe('InviteGate', () => {
  it('renders the form with input and submit button', () => {
    const wrapper = mountGate()
    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="invite-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="invite-submit"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Welcome to Lovelacer')
  })

  it('submit button is disabled when input is empty', () => {
    const wrapper = mountGate()
    const btn = wrapper.find('[data-testid="invite-submit"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('submit button is enabled when input has a value', async () => {
    const wrapper = mountGate()
    await wrapper.find('[data-testid="invite-input"]').setValue('BETA-2026-ALPHA')
    const btn = wrapper.find('[data-testid="invite-submit"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('submit button is disabled while phase=submitting', async () => {
    const wrapper = mountGate()
    const store = useInviteStore()
    await wrapper.find('[data-testid="invite-input"]').setValue('BETA-2026-ALPHA')
    store.$patch({ phase: 'submitting' })
    await wrapper.vm.$nextTick()
    const btn = wrapper.find('[data-testid="invite-submit"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('Checking…')
  })

  it('submit calls invite.submit with the typed code', async () => {
    const wrapper = mountGate()
    const store = useInviteStore()
    const submitSpy = vi.spyOn(store, 'submit').mockResolvedValueOnce(undefined)

    await wrapper.find('[data-testid="invite-input"]').setValue('BETA-2026-ALPHA')
    await wrapper.find('form').trigger('submit')

    expect(submitSpy).toHaveBeenCalledWith('BETA-2026-ALPHA')
  })

  it('shows error message on phase=error with invalid_code', async () => {
    const wrapper = mountGate()
    const store = useInviteStore()
    const apiError: ApiError = {
      error: 'invalid_code',
      message: 'Invite code not recognized.',
    }
    store.$patch({ phase: 'error', error: apiError })

    await wrapper.vm.$nextTick()
    const errorEl = wrapper.find('[data-testid="invite-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain("That invite code wasn't recognized")
  })

  it('shows network error message on phase=error with network error', async () => {
    const wrapper = mountGate()
    const store = useInviteStore()
    const apiError: ApiError = { error: 'network', message: 'offline' }
    store.$patch({ phase: 'error', error: apiError })

    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-error"]').text()).toContain(
      'Could not reach the server',
    )
  })

  it('preserves typed code after a wrong-code submission', async () => {
    const wrapper = mountGate()
    const store = useInviteStore()
    vi.spyOn(store, 'submit').mockImplementationOnce(async () => {
      store.$patch({
        phase: 'error',
        error: { error: 'invalid_code', message: 'nope' },
      })
    })

    await wrapper.find('[data-testid="invite-input"]').setValue('TYPO-CODE')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    const input = wrapper.find('[data-testid="invite-input"]')
    expect((input.element as HTMLInputElement).value).toBe('TYPO-CODE')
  })
})
