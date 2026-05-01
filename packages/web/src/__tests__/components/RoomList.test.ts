import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
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
    const wrapper = mount(RoomList, { props: { rooms } })
    const rows = wrapper.findAll('[data-testid="room-row"]')
    expect(rows).toHaveLength(3)
  })

  it('shows entityCount as "N entities"', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ entityCount: 22 })] },
    })
    expect(wrapper.text()).toContain('22 entities')
  })

  it('uses green pill for confidence >= 0.8', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.92 })] },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-green-100')
    expect(pill.classes()).toContain('text-green-800')
  })

  it('uses amber pill for confidence between 0.5 and 0.8', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.65 })] },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-amber-100')
    expect(pill.classes()).toContain('text-amber-800')
  })

  it('uses red pill for confidence < 0.5', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.3 })] },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-red-100')
    expect(pill.classes()).toContain('text-red-800')
  })

  it('renders empty-state placeholder when rooms array is empty', () => {
    const wrapper = mount(RoomList, { props: { rooms: [] } })
    expect(wrapper.text()).toContain('No rooms detected')
  })
})
