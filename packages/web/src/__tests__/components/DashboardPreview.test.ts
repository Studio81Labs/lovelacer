import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Icon } from '@iconify/vue'
import DashboardPreview from '../../components/DashboardPreview.vue'
import type { LovelaceConfig } from '../../api/types.js'
import { createTestI18n } from '../test-utils.js'

function mountPreview(config: LovelaceConfig) {
  return mount(DashboardPreview, {
    props: { config },
    global: { plugins: [createTestI18n()] },
  })
}

const config: LovelaceConfig = {
  title: 'Lovelacer — Home',
  views: [
    { type: 'sections', title: 'Home', path: 'home', icon: 'mdi:home-variant' },
    { type: 'sections', title: 'Kitchen', path: 'kitchen', icon: 'mdi:silverware-fork-knife' },
    { type: 'sections', title: 'Bedroom', path: 'bedroom', icon: 'mdi:bed' },
  ],
}

describe('DashboardPreview', () => {
  it('renders one pill per view in input order', () => {
    const wrapper = mountPreview(config)
    const pills = wrapper.findAll('[data-testid="view-pill"]')
    expect(pills).toHaveLength(3)
    expect(pills[0]!.text()).toContain('Home')
    expect(pills[1]!.text()).toContain('Kitchen')
    expect(pills[2]!.text()).toContain('Bedroom')
  })

  it('passes the view.icon string to the Iconify component', () => {
    const wrapper = mountPreview(config)
    const icons = wrapper.findAllComponents(Icon)
    expect(icons.length).toBeGreaterThanOrEqual(3)
    // @iconify/vue's Icon uses inheritAttrs: false and reads `icon` from $attrs,
    // so it surfaces there rather than in declared props().
    expect(icons[0]!.vm.$attrs['icon']).toBe('mdi:home-variant')
    expect(icons[1]!.vm.$attrs['icon']).toBe('mdi:silverware-fork-knife')
    expect(icons[2]!.vm.$attrs['icon']).toBe('mdi:bed')
  })

  it('renders nothing when views array is empty', () => {
    const empty: LovelaceConfig = { title: 'x', views: [] }
    const wrapper = mountPreview(empty)
    const pills = wrapper.findAll('[data-testid="view-pill"]')
    expect(pills).toHaveLength(0)
  })

  it('renders a document-relative Download YAML link when views are present', () => {
    // The href must be document-relative (no leading slash) so it
    // resolves under the HA Supervisor ingress path. Absolute /api/...
    // would 404 in production. Locks the contract.
    const wrapper = mountPreview(config)
    const link = wrapper.find('[data-testid="export-yaml-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('api/export.yaml')
    expect(link.attributes('href')).not.toMatch(/^\//)
    expect(link.attributes('download')).toBeDefined()
    expect(link.text()).toContain('Download YAML')
  })

  it('does not render the Download YAML link when views are empty', () => {
    const empty: LovelaceConfig = { title: 'x', views: [] }
    const wrapper = mountPreview(empty)
    expect(wrapper.find('[data-testid="export-yaml-link"]').exists()).toBe(false)
  })
})
