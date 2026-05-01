import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import MiscBucket from '../../components/MiscBucket.vue'
import type { MiscEntity } from '../../api/types.js'

function mountBucket(misc: MiscEntity[]) {
  return mount(MiscBucket, {
    props: { misc },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
    },
  })
}

describe('MiscBucket', () => {
  it('does not render when misc is empty', () => {
    const wrapper = mountBucket([])
    expect(wrapper.find('details').exists()).toBe(false)
  })

  it('renders summary count when misc is non-empty', () => {
    const wrapper = mountBucket([
      { entityId: 'a.b', friendlyName: 'A', domain: 'sensor' },
      { entityId: 'c.d', friendlyName: 'B', domain: 'sensor' },
    ])
    expect(wrapper.find('summary').text()).toContain('2')
  })

  it('renders one EntityRow per misc entity', () => {
    const wrapper = mountBucket([
      { entityId: 'a.b', friendlyName: 'Entity A', domain: 'sensor' },
      { entityId: 'c.d', friendlyName: 'Entity B', domain: 'sensor' },
    ])
    const rows = wrapper.findAll('[data-testid="entity-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('a.b')
    expect(rows[0]!.text()).toContain('Entity A')
    expect(rows[1]!.text()).toContain('c.d')
    expect(rows[1]!.text()).toContain('Entity B')
  })
})
