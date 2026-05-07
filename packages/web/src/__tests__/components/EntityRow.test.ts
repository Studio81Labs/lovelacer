import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import EntityRow from '../../components/EntityRow.vue'
import { useOverridesStore } from '../../stores/overrides.js'
import { createTestI18n } from '../test-utils.js'

interface RowProps {
  entityId: string
  friendlyName: string
  roomId: string
  manual?: boolean
}

function makeProps(overrides: Partial<RowProps> = {}): RowProps {
  return {
    entityId: 'light.kitchen_ceiling',
    friendlyName: 'Kitchen Ceiling Light',
    roomId: 'kitchen',
    ...overrides,
  }
}

function mountRow(props: RowProps) {
  return mount(EntityRow, {
    props,
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })
}

describe('EntityRow', () => {
  beforeEach(() => {
    // Each test gets a fresh pinia via createTestingPinia
  })

  it('renders entityId and friendlyName', () => {
    const wrapper = mountRow(makeProps())
    expect(wrapper.text()).toContain('light.kitchen_ceiling')
    expect(wrapper.text()).toContain('Kitchen Ceiling Light')
  })

  it('dropdown reflects detector roomId when no override is set', () => {
    const wrapper = mountRow(makeProps())
    const select = wrapper.find('[data-testid="room-select"]')
    expect((select.element as HTMLSelectElement).value).toBe('kitchen')
  })

  it('dropdown reflects effective.roomId when an override is set', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.setRoomId('light.kitchen_ceiling', 'living_room')

    await wrapper.vm.$nextTick()
    const select = wrapper.find('[data-testid="room-select"]')
    expect((select.element as HTMLSelectElement).value).toBe('living_room')
  })

  it('hide toggle reflects effective.hidden when set', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.setHidden('light.kitchen_ceiling', true)

    await wrapper.vm.$nextTick()
    const toggle = wrapper.find('[data-testid="hide-toggle"]')
    expect((toggle.element as HTMLInputElement).checked).toBe(true)
  })

  it('applies override-row treatment when effective is non-null', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.setRoomId('light.kitchen_ceiling', 'bedroom')

    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).toContain('border-l-2')
    expect(wrapper.classes()).toContain('border-amber-400')
  })

  it('applies override-row treatment when assignment.manual is true', () => {
    const wrapper = mountRow(makeProps({ manual: true }))
    expect(wrapper.classes()).toContain('border-l-2')
    expect(wrapper.classes()).toContain('border-amber-400')
  })

  it('dropdown change calls setRoomId with the new value', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()

    await wrapper.find('[data-testid="room-select"]').setValue('bedroom')

    expect(store.effective('light.kitchen_ceiling')).toEqual({
      entityId: 'light.kitchen_ceiling',
      roomId: 'bedroom',
    })
  })

  it('dropdown change to "" (let detector decide) calls setRoomId(null)', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.setRoomId('light.kitchen_ceiling', 'bedroom') // set up dirty state

    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="room-select"]').setValue('')

    // null roomId, no hidden → effective is null (no entry)
    expect(store.effective('light.kitchen_ceiling')).toBeNull()
  })

  it('hide toggle change calls setHidden', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()

    await wrapper.find('[data-testid="hide-toggle"]').setValue(true)

    expect(store.effective('light.kitchen_ceiling')).toEqual({
      entityId: 'light.kitchen_ceiling',
      hidden: true,
    })
  })

  it('controls are disabled when phase is saving', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.$patch({ phase: 'saving' })

    await wrapper.vm.$nextTick()
    const select = wrapper.find('[data-testid="room-select"]')
    const toggle = wrapper.find('[data-testid="hide-toggle"]')
    expect((select.element as HTMLSelectElement).disabled).toBe(true)
    expect((toggle.element as HTMLInputElement).disabled).toBe(true)
  })

  it('hidden entities show "(hidden)" suffix and reduced opacity', async () => {
    const wrapper = mountRow(makeProps())
    const store = useOverridesStore()
    store.setHidden('light.kitchen_ceiling', true)

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('(hidden)')
    expect(wrapper.classes()).toContain('opacity-60')
  })

  it('with readOnly: true, hides the room dropdown and the hide checkbox', () => {
    const wrapper = mount(EntityRow, {
      props: {
        entityId: 'sensor.foo',
        friendlyName: 'Sensor Foo',
        roomId: 'kitchen',
        readOnly: true,
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    expect(wrapper.find('[data-testid="room-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="hide-toggle"]').exists()).toBe(false)
  })
})

describe('EntityRow diff tag', () => {
  it('renders no tag when diff prop is undefined', () => {
    const wrapper = mount(EntityRow, {
      props: {
        entityId: 'light.kitchen_ceiling',
        friendlyName: 'Kitchen Ceiling',
        roomId: 'kitchen',
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    expect(wrapper.find('[data-testid="entity-diff-tag"]').exists()).toBe(false)
  })

  it('renders "New" pill when diff.kind is added', () => {
    const wrapper = mount(EntityRow, {
      props: {
        entityId: 'light.new_lamp',
        friendlyName: 'New Lamp',
        roomId: 'kitchen',
        diff: {
          entityId: 'light.new_lamp',
          kind: 'added' as const,
          currentRoomId: 'kitchen',
        },
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const tag = wrapper.find('[data-testid="entity-diff-tag"]')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toBe('New')
  })

  it('renders "Moved from {previous}" when diff.kind is moved', () => {
    const wrapper = mount(EntityRow, {
      props: {
        entityId: 'light.lamp',
        friendlyName: 'Lamp',
        roomId: 'bedroom',
        diff: {
          entityId: 'light.lamp',
          kind: 'moved' as const,
          previousRoomId: 'living_room',
          currentRoomId: 'bedroom',
        },
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const tag = wrapper.find('[data-testid="entity-diff-tag"]')
    expect(tag.text()).toContain('Moved from')
    expect(tag.text()).toContain('Living Room')
  })

  it('renders "Moved from Misc" when previousRoomId is null', () => {
    const wrapper = mount(EntityRow, {
      props: {
        entityId: 'light.was_misc',
        friendlyName: 'Was Misc',
        roomId: 'kitchen',
        diff: {
          entityId: 'light.was_misc',
          kind: 'moved' as const,
          previousRoomId: null,
          currentRoomId: 'kitchen',
        },
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    expect(wrapper.find('[data-testid="entity-diff-tag"]').text()).toContain('Misc')
  })
})
