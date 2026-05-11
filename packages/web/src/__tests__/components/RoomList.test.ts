import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import RoomList from '../../components/RoomList.vue'
import type { AnalyzedRoom } from '../../api/types.js'
import { createTestI18n } from '../test-utils.js'

function room(overrides: Partial<AnalyzedRoom> = {}): AnalyzedRoom {
  return {
    id: 'kitchen',
    haAreaId: 'kitchen',
    displayName: 'Kitchen',
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
