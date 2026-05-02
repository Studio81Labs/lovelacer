import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DiffBanner from '../../components/DiffBanner.vue'
import type { DiffResult } from '../../api/types.js'

function mountBanner(diff: DiffResult | null) {
  return mount(DiffBanner, { props: { diff } })
}

function makeZeroDiff(appliedAt: number): DiffResult {
  return {
    entities: [],
    perRoom: {},
    totals: { added: 0, moved: 0, removed: 0 },
    appliedAt,
  }
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

  describe('formatApplied — calendar-day boundary', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('reads "today" when applied earlier the same calendar day', () => {
      // Now: 2026-05-02 10:00:00 local. Applied: 2026-05-02 09:00:00 local.
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 4, 2, 10, 0, 0))
      const appliedAt = Math.floor(new Date(2026, 4, 2, 9, 0, 0).getTime() / 1000)
      const wrapper = mountBanner(makeZeroDiff(appliedAt))
      expect(wrapper.find('[data-testid="diff-banner"]').text()).toContain('today')
    })

    it('reads "yesterday" when applied late on the previous calendar day (regression: was "today" with 24h-period math)', () => {
      // Now: 2026-05-02 22:00:00 local. Applied: 2026-05-01 23:00:00 local
      // (23h elapsed). The buggy 24h-period check would say "today";
      // the calendar-day check correctly says "yesterday".
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 4, 2, 22, 0, 0))
      const appliedAt = Math.floor(new Date(2026, 4, 1, 23, 0, 0).getTime() / 1000)
      const wrapper = mountBanner(makeZeroDiff(appliedAt))
      expect(wrapper.find('[data-testid="diff-banner"]').text()).toContain('yesterday')
    })

    it('reads an absolute date when applied two or more calendar days ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 4, 5, 12, 0, 0))
      const appliedAt = Math.floor(new Date(2026, 4, 1, 12, 0, 0).getTime() / 1000)
      const wrapper = mountBanner(makeZeroDiff(appliedAt))
      const text = wrapper.find('[data-testid="diff-banner"]').text()
      // Locale-dependent format ("May 1" / "1 May"), so just assert NOT
      // "today"/"yesterday" and that some absolute-date marker is present.
      expect(text).not.toContain('today')
      expect(text).not.toContain('yesterday')
      expect(text).toMatch(/May|5\/1|1\/5/)
    })
  })
})
