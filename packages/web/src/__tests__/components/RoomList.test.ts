import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import RoomList from '../../components/RoomList.vue'
import type { AnalyzedRoom } from '../../api/types.js'

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
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    const rows = wrapper.findAll('[data-testid="room-row"]')
    expect(rows).toHaveLength(3)
  })

  it('shows entityCount as "N entities"', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ entityCount: 22 })] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    expect(wrapper.text()).toContain('22 entities')
  })

  it('uses green pill for confidence >= 0.8', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.92 })] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-green-100')
    expect(pill.classes()).toContain('text-green-800')
  })

  it('uses amber pill for confidence between 0.5 and 0.8', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.65 })] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-amber-100')
    expect(pill.classes()).toContain('text-amber-800')
  })

  it('uses red pill for confidence < 0.5', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.3 })] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-red-100')
    expect(pill.classes()).toContain('text-red-800')
  })

  it('renders empty-state placeholder when rooms array is empty', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [] },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
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
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
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
})
