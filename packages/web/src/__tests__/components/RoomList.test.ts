import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { Icon } from '@iconify/vue'
import RoomList from '../../components/RoomList.vue'
import type { AnalyzedRoom } from '../../api/types.js'
import { createTestI18n } from '../test-utils.js'

function room(overrides: Partial<AnalyzedRoom> = {}): AnalyzedRoom {
  return {
    id: 'kitchen',
    haAreaId: 'kitchen',
    displayName: 'Kitchen',
    icon: 'mdi:silverware-fork-knife',
    entityCount: 12,
    averageConfidence: 0.92,
    assignments: [],
    ...overrides,
  }
}

describe('RoomList', () => {
  it('renders one row per room', () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
      room({ id: 'living_room', displayName: 'Living Room' }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const rows = wrapper.findAll('[data-testid="room-row"]')
    expect(rows).toHaveLength(3)
  })

  it('renders the API-provided room icon', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ id: 'kitchen', icon: 'mdi:coffee' })] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    const iconNames = wrapper.findAllComponents(Icon).map((icon) => icon.vm.$attrs['icon'])
    expect(iconNames).toContain('mdi:coffee')
    expect(iconNames).not.toContain('mdi:silverware-fork-knife')
  })

  it('opens inline room metadata editing prefilled from the room', async () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ displayName: 'Kitchen', icon: 'mdi:silverware-fork-knife' })] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await wrapper.find('[data-testid="room-edit-button"]').trigger('click')

    expect(
      (wrapper.find('[data-testid="room-name-input"]').element as HTMLInputElement).value,
    ).toBe('Kitchen')
    expect(
      (wrapper.find('[data-testid="room-icon-input"]').element as HTMLInputElement).value,
    ).toBe('mdi:silverware-fork-knife')
    expect(
      (wrapper.find('[data-testid="room-show-name-toggle"]').element as HTMLInputElement).checked,
    ).toBe(true)
  })

  it('opens the room details row when inline room metadata editing starts', async () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room()] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const details = wrapper.find('details')
    expect((details.element as HTMLDetailsElement).open).toBe(false)

    await wrapper.find('[data-testid="room-edit-button"]').trigger('click')

    expect((details.element as HTMLDetailsElement).open).toBe(true)
    expect(wrapper.find('[data-testid="room-name-input"]').exists()).toBe(true)
  })

  it('emits save-room when inline room metadata is saved', async () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [room({ id: 'kitchen', displayName: 'Kitchen', icon: 'mdi:silverware-fork-knife' })],
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await wrapper.find('[data-testid="room-edit-button"]').trigger('click')
    await wrapper.find('[data-testid="room-name-input"]').setValue('Breakfast nook')
    await wrapper.find('[data-testid="room-icon-input"]').setValue('mdi:coffee')
    await wrapper.find('[data-testid="room-show-name-toggle"]').setValue(false)
    await wrapper.find('[data-testid="room-save-button"]').trigger('click')

    expect(wrapper.emitted('save-room')?.[0]).toEqual([
      'kitchen',
      { name: 'Breakfast nook', icon: 'mdi:coffee', showNameOnCard: false },
    ])
  })

  it('prefills and preserves a false show-name-on-card room override', async () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [room({ id: 'kitchen', displayName: 'Kitchen', icon: 'mdi:silverware-fork-knife' })],
        roomOverrides: { kitchen: { showNameOnCard: false } },
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await wrapper.find('[data-testid="room-edit-button"]').trigger('click')

    expect(
      (wrapper.find('[data-testid="room-show-name-toggle"]').element as HTMLInputElement).checked,
    ).toBe(false)

    await wrapper.find('[data-testid="room-save-button"]').trigger('click')

    expect(wrapper.emitted('save-room')?.[0]).toEqual([
      'kitchen',
      { name: 'Kitchen', icon: 'mdi:silverware-fork-knife', showNameOnCard: false },
    ])
  })

  it('emits save-room with empty values when reset is clicked', async () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [room({ id: 'kitchen', displayName: 'Breakfast nook', icon: 'mdi:coffee' })],
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await wrapper.find('[data-testid="room-edit-button"]').trigger('click')
    await wrapper.find('[data-testid="room-reset-button"]').trigger('click')

    expect(wrapper.emitted('save-room')?.[0]).toEqual([
      'kitchen',
      { name: '', icon: '', showNameOnCard: true },
    ])
  })

  it('does not render room edit controls in read-only mode', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room()], readOnly: true },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    expect(wrapper.find('[data-testid="room-edit-button"]').exists()).toBe(false)
  })

  it('orders rooms by the saved roomOrder preference', () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
      room({ id: 'living_room', displayName: 'Living Room' }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms, roomOrder: ['living_room', 'kitchen'] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    expect(wrapper.findAll('[data-testid="room-name"]').map((row) => row.text())).toEqual([
      'Living Room',
      'Kitchen',
      'Bedroom',
    ])
  })

  it('appends rooms missing from roomOrder alphabetically by display name', () => {
    const rooms = [
      room({ id: 'garage', displayName: 'Garage' }),
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms, roomOrder: ['kitchen'] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    expect(wrapper.findAll('[data-testid="room-name"]').map((row) => row.text())).toEqual([
      'Kitchen',
      'Bedroom',
      'Garage',
    ])
  })

  it('emits the reordered room ids when a room is dropped on another room', async () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
      room({ id: 'living_room', displayName: 'Living Room' }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms, roomOrder: ['kitchen', 'bedroom', 'living_room'] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const dragStore = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (key: string, value: string) => dragStore.set(key, value),
      getData: (key: string) => dragStore.get(key) ?? '',
      setDragImage: vi.fn(),
    }

    await wrapper.findAll('[data-testid="room-drag-handle"]')[2]!.trigger('dragstart', {
      dataTransfer,
    })
    await wrapper.findAll('[data-testid="room-row"]')[0]!.trigger('drop', { dataTransfer })

    expect(wrapper.emitted('reorder')?.[0]).toEqual([['living_room', 'kitchen', 'bedroom']])
  })

  it('uses the full room row as the drag preview when the handle drag starts', async () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
    ]
    const wrapper = mount(RoomList, {
      attachTo: document.body,
      props: { rooms },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const dataTransfer = {
      effectAllowed: '',
      setData: vi.fn(),
      setDragImage: vi.fn(),
    }
    const row = wrapper.find('[data-testid="room-row"]').element as HTMLElement
    row.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 4,
        right: 310,
        bottom: 44,
        width: 300,
        height: 40,
        x: 10,
        y: 4,
        toJSON: () => ({}),
      }) as DOMRect

    await wrapper.find('[data-testid="room-drag-handle"]').trigger('dragstart', {
      clientX: 34,
      clientY: 18,
      dataTransfer,
    })

    expect(dataTransfer.setDragImage).toHaveBeenCalledWith(row, 24, 14)
    wrapper.unmount()
  })

  it('moves the row while dragging over another row before drop', async () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
      room({ id: 'living_room', displayName: 'Living Room' }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms, roomOrder: ['kitchen', 'bedroom', 'living_room'] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const dragStore = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (key: string, value: string) => dragStore.set(key, value),
      getData: (key: string) => dragStore.get(key) ?? '',
      setDragImage: vi.fn(),
    }

    await wrapper.findAll('[data-testid="room-drag-handle"]')[2]!.trigger('dragstart', {
      dataTransfer,
    })
    await wrapper.findAll('[data-testid="room-row"]')[0]!.trigger('dragover', { dataTransfer })

    expect(wrapper.findAll('[data-testid="room-name"]').map((row) => row.text())).toEqual([
      'Living Room',
      'Kitchen',
      'Bedroom',
    ])
    expect(wrapper.emitted('reorder')).toBeUndefined()
  })

  it('moves a room to the end when dragging over the lower half of the last row', async () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
      room({ id: 'living_room', displayName: 'Living Room' }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms, roomOrder: ['kitchen', 'bedroom', 'living_room'] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const dragStore = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (key: string, value: string) => dragStore.set(key, value),
      getData: (key: string) => dragStore.get(key) ?? '',
      setDragImage: vi.fn(),
    }
    const lastRow = wrapper.findAll('[data-testid="room-row"]')[2]!
    ;(lastRow.element as HTMLElement).getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 300,
        bottom: 40,
        width: 300,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    await wrapper.findAll('[data-testid="room-drag-handle"]')[0]!.trigger('dragstart', {
      dataTransfer,
    })
    await lastRow.trigger('dragover', { clientY: 30, dataTransfer })
    await lastRow.trigger('drop', { clientY: 30, dataTransfer })

    expect(wrapper.emitted('reorder')?.[0]).toEqual([['bedroom', 'living_room', 'kitchen']])
  })

  it('clears the draft order when dropping back on the source row', async () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
      room({ id: 'living_room', displayName: 'Living Room' }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms, roomOrder: ['kitchen', 'bedroom', 'living_room'] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const dragStore = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (key: string, value: string) => dragStore.set(key, value),
      getData: (key: string) => dragStore.get(key) ?? '',
      setDragImage: vi.fn(),
    }
    const sourceHandle = wrapper.findAll('[data-testid="room-drag-handle"]')[2]!

    await sourceHandle.trigger('dragstart', { dataTransfer })
    await wrapper.findAll('[data-testid="room-row"]')[0]!.trigger('dragover', { dataTransfer })

    expect(wrapper.findAll('[data-testid="room-name"]').map((row) => row.text())).toEqual([
      'Living Room',
      'Kitchen',
      'Bedroom',
    ])

    await wrapper.findAll('[data-testid="room-row"]')[0]!.trigger('drop', { dataTransfer })

    expect(wrapper.emitted('reorder')).toBeUndefined()
    expect(wrapper.findAll('[data-testid="room-name"]').map((row) => row.text())).toEqual([
      'Kitchen',
      'Bedroom',
      'Living Room',
    ])
  })

  it('clears the draft order when dragging is cancelled before drop', async () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
      room({ id: 'living_room', displayName: 'Living Room' }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms, roomOrder: ['kitchen', 'bedroom', 'living_room'] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const dragStore = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (key: string, value: string) => dragStore.set(key, value),
      getData: (key: string) => dragStore.get(key) ?? '',
      setDragImage: vi.fn(),
    }
    const handle = wrapper.findAll('[data-testid="room-drag-handle"]')[2]!

    await handle.trigger('dragstart', { dataTransfer })
    await wrapper.findAll('[data-testid="room-row"]')[0]!.trigger('dragover', { dataTransfer })
    await handle.trigger('dragend')

    expect(wrapper.findAll('[data-testid="room-name"]').map((row) => row.text())).toEqual([
      'Kitchen',
      'Bedroom',
      'Living Room',
    ])
    expect(wrapper.emitted('reorder')).toBeUndefined()
  })

  it('emits the draft order when the dragged row has moved under the drop target', async () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
      room({ id: 'living_room', displayName: 'Living Room' }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms, roomOrder: ['kitchen', 'bedroom', 'living_room'] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const dragStore = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (key: string, value: string) => dragStore.set(key, value),
      getData: (key: string) => dragStore.get(key) ?? '',
      setDragImage: vi.fn(),
    }

    await wrapper.findAll('[data-testid="room-drag-handle"]')[2]!.trigger('dragstart', {
      dataTransfer,
    })
    await wrapper.findAll('[data-testid="room-row"]')[0]!.trigger('dragover', { dataTransfer })
    await wrapper.findAll('[data-testid="room-row"]')[1]!.trigger('drop', { dataTransfer })

    expect(wrapper.emitted('reorder')?.[0]).toEqual([['living_room', 'kitchen', 'bedroom']])
  })

  it('emits the draft order when dropping on the list after a live move', async () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
      room({ id: 'living_room', displayName: 'Living Room' }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms, roomOrder: ['kitchen', 'bedroom', 'living_room'] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const dragStore = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (key: string, value: string) => dragStore.set(key, value),
      getData: (key: string) => dragStore.get(key) ?? '',
      setDragImage: vi.fn(),
    }

    await wrapper.findAll('[data-testid="room-drag-handle"]')[2]!.trigger('dragstart', {
      dataTransfer,
    })
    await wrapper.findAll('[data-testid="room-row"]')[0]!.trigger('dragover', { dataTransfer })
    await wrapper.find('[data-testid="room-list"]').trigger('drop', { dataTransfer })

    expect(wrapper.emitted('reorder')?.[0]).toEqual([['living_room', 'kitchen', 'bedroom']])
  })

  it('prevents default browser handling for drops anywhere in the room list', async () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [
          room({ id: 'kitchen', displayName: 'Kitchen' }),
          room({ id: 'bedroom', displayName: 'Bedroom' }),
        ],
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    const drop = new Event('drop', { bubbles: true, cancelable: true })
    wrapper.find('[data-testid="room-list"]').element.dispatchEvent(drop)

    expect(drop.defaultPrevented).toBe(true)
    expect(wrapper.emitted('reorder')).toBeUndefined()
  })

  it('disables drag ordering while room search is active', async () => {
    const rooms = [
      room({
        id: 'kitchen',
        displayName: 'Kitchen',
        icon: 'mdi:silverware-fork-knife',
        assignments: [
          { entityId: 'light.kitchen_ceiling', roomId: 'kitchen', confidence: 0.9, signals: [] },
        ],
      }),
      room({
        id: 'bedroom',
        displayName: 'Bedroom',
        assignments: [
          { entityId: 'sensor.bedroom_temp', roomId: 'bedroom', confidence: 0.8, signals: [] },
        ],
      }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms, roomOrder: ['bedroom', 'kitchen'] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await wrapper.find('[data-testid="section-search"]').setValue('kitchen')

    const handle = wrapper.find('[data-testid="room-drag-handle"]')
    expect(handle.attributes('disabled')).toBeDefined()
    await handle.trigger('dragstart')
    expect(wrapper.emitted('reorder')).toBeUndefined()
  })

  it('disables drag ordering in read-only mode', () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [
          room({ id: 'kitchen', displayName: 'Kitchen' }),
          room({ id: 'bedroom', displayName: 'Bedroom' }),
        ],
        readOnly: true,
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    expect(wrapper.find('[data-testid="room-drag-handle"]').attributes('disabled')).toBeDefined()
  })

  it('shows entityCount as "N entities"', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ entityCount: 22 })] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    expect(wrapper.text()).toContain('22 entities')
  })

  it('uses green pill for confidence >= 0.8', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.92 })] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-forest-50')
    expect(pill.classes()).toContain('text-forest-700')
  })

  it('uses amber pill for confidence between 0.5 and 0.8', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.65 })] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-amber-100')
    expect(pill.classes()).toContain('text-amber-700')
  })

  it('uses red pill for confidence < 0.5', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.3 })] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-danger-50')
    expect(pill.classes()).toContain('text-danger-700')
  })

  it('renders empty-state placeholder when rooms array is empty', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    expect(wrapper.text()).toContain('No rooms detected')
  })

  it('expands to show one EntityRow per assignment', () => {
    const testRoom: AnalyzedRoom = {
      id: 'kitchen',
      haAreaId: 'kitchen',
      displayName: 'Kitchen',
      icon: 'mdi:silverware-fork-knife',
      entityCount: 2,
      averageConfidence: 0.9,
      assignments: [
        { entityId: 'light.a', roomId: 'kitchen', confidence: 0.9, signals: [] },
        { entityId: 'sensor.b', roomId: 'kitchen', confidence: 0.85, signals: [] },
      ],
    }
    const wrapper = mount(RoomList, {
      props: { rooms: [testRoom] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    // <details> exists with the room as summary
    expect(wrapper.find('details').exists()).toBe(true)
    // Two EntityRows inside
    const rows = wrapper.findAll('[data-testid="entity-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('light.a')
    expect(rows[1]!.text()).toContain('sensor.b')
  })

  it('filters rooms by matching entity id', async () => {
    const rooms = [
      room({
        id: 'kitchen',
        displayName: 'Kitchen',
        icon: 'mdi:silverware-fork-knife',
        assignments: [
          { entityId: 'light.kitchen_ceiling', roomId: 'kitchen', confidence: 0.9, signals: [] },
        ],
      }),
      room({
        id: 'bedroom',
        displayName: 'Bedroom',
        assignments: [
          { entityId: 'sensor.bedroom_temp', roomId: 'bedroom', confidence: 0.8, signals: [] },
        ],
      }),
    ]
    const wrapper = mount(RoomList, {
      props: { rooms },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await wrapper.find('[data-testid="section-search"]').setValue('bedroom_temp')

    expect(wrapper.findAll('[data-testid="room-row"]')).toHaveLength(1)
    const rowText = wrapper.find('[data-testid="room-row"]').text()
    expect(rowText).toContain('Bedroom')
    expect(rowText).toContain('sensor.bedroom_temp')
    expect(rowText).not.toContain('light.kitchen_ceiling')
  })

  it('filters rooms by fallback friendly name', async () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [
          room({
            id: 'kitchen',
            displayName: 'Kitchen',
            icon: 'mdi:silverware-fork-knife',
            assignments: [
              {
                entityId: 'light.kitchen_ceiling',
                roomId: 'kitchen',
                confidence: 0.9,
                signals: [],
              },
              {
                entityId: 'sensor.kitchen_freezer_temperature',
                roomId: 'kitchen',
                confidence: 0.8,
                signals: [],
              },
            ],
          }),
        ],
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await wrapper.find('[data-testid="section-search"]').setValue('Freezer Temperature')

    const rows = wrapper.findAll('[data-testid="entity-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('sensor.kitchen_freezer_temperature')
    expect(rows[0]!.text()).not.toContain('light.kitchen_ceiling')
  })

  it('shows an empty search state when no room entity matches', async () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [
          room({
            assignments: [
              {
                entityId: 'light.kitchen_ceiling',
                roomId: 'kitchen',
                confidence: 0.9,
                signals: [],
              },
            ],
          }),
        ],
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })

    await wrapper.find('[data-testid="section-search"]').setValue('not-here')

    expect(wrapper.findAll('[data-testid="room-row"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No matching entities')
  })
})

describe('RoomList diff badges', () => {
  const baseRoom: AnalyzedRoom = {
    id: 'kitchen',
    haAreaId: 'kitchen',
    displayName: 'Kitchen',
    icon: 'mdi:silverware-fork-knife',
    entityCount: 1,
    averageConfidence: 0.9,
    assignments: [
      { entityId: 'light.kitchen_ceiling', roomId: 'kitchen', confidence: 0.9, signals: [] },
    ],
  }

  it('renders no badges when diffByRoom prop is empty', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [baseRoom], diffByRoom: {} },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    expect(wrapper.find('[data-testid="room-diff-added"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="room-diff-moved-out"]').exists()).toBe(false)
  })

  it('renders +N new pill when room has additions', () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [baseRoom],
        diffByRoom: { kitchen: { added: 3, movedIn: 1, movedOut: 0 } },
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    expect(wrapper.find('[data-testid="room-diff-added"]').text()).toContain('3')
  })

  it('renders moved-out badge when entities left the room', () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [baseRoom],
        diffByRoom: { kitchen: { added: 0, movedIn: 0, movedOut: 2 } },
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    expect(wrapper.find('[data-testid="room-diff-moved-out"]').text()).toContain('2')
  })

  it('with readOnly: true, hides override dropdowns on every entity', async () => {
    const wrapper = mount(RoomList, {
      props: {
        rooms: [
          {
            id: 'kitchen',
            haAreaId: null,
            displayName: 'Kitchen',
            icon: 'mdi:silverware-fork-knife',
            entityCount: 1,
            averageConfidence: 0.8,
            assignments: [
              {
                entityId: 'sensor.kitchen',
                roomId: 'kitchen',
                confidence: 0.8,
                signals: [],
              },
            ],
          },
        ],
        readOnly: true,
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    // Expand the room to render its EntityRow children.
    const summary = wrapper.find('summary')
    await summary.trigger('click')
    expect(wrapper.findAll('[data-testid="room-select"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="hide-toggle"]')).toHaveLength(0)
  })
})
