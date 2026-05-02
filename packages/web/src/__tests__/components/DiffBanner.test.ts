import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DiffBanner from '../../components/DiffBanner.vue'
import type { DiffResult } from '../../api/types.js'

function mountBanner(diff: DiffResult | null) {
  return mount(DiffBanner, { props: { diff } })
}

describe('DiffBanner', () => {
  it('does not render anything when diff is null (first-run case)', () => {
    const wrapper = mountBanner(null)
    expect(wrapper.find('[data-testid="diff-banner"]').exists()).toBe(false)
  })

  it('renders the muted "no changes" line when totals are all zero', () => {
    const diff: DiffResult = {
      entities: [],
      perRoom: {},
      totals: { added: 0, moved: 0, removed: 0 },
      appliedAt: Math.floor(Date.now() / 1000),
    }
    const wrapper = mountBanner(diff)
    const banner = wrapper.find('[data-testid="diff-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('No changes since last apply')
  })

  it('renders pill counts when totals are non-zero', () => {
    const diff: DiffResult = {
      entities: [],
      perRoom: {},
      totals: { added: 5, moved: 2, removed: 1 },
      appliedAt: Math.floor(Date.now() / 1000),
    }
    const wrapper = mountBanner(diff)
    const banner = wrapper.find('[data-testid="diff-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.find('[data-testid="diff-banner-added"]').text()).toContain('5')
    expect(banner.find('[data-testid="diff-banner-moved"]').text()).toContain('2')
    expect(banner.find('[data-testid="diff-banner-removed"]').text()).toContain('1')
  })

  it('omits zero-count pills', () => {
    const diff: DiffResult = {
      entities: [],
      perRoom: {},
      totals: { added: 3, moved: 0, removed: 0 },
      appliedAt: Math.floor(Date.now() / 1000),
    }
    const wrapper = mountBanner(diff)
    expect(wrapper.find('[data-testid="diff-banner-added"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diff-banner-moved"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="diff-banner-removed"]').exists()).toBe(false)
  })
})
