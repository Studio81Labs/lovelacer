import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Icon } from '@iconify/vue'
import DashboardPreview from '../../components/DashboardPreview.vue'
import type { LovelaceConfig, LovelaceView, RoomDisplayOverride } from '../../api/types.js'
import { createTestI18n } from '../test-utils.js'

function mountPreview(
  config: LovelaceConfig,
  props: {
    viewCandidates?: LovelaceView[]
    roomOverrides?: Record<string, RoomDisplayOverride>
    disabled?: boolean
  } = {},
) {
  return mount(DashboardPreview, {
    props: { config, ...props },
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
  it('renders one toggle chip per view in input order', () => {
    const wrapper = mountPreview(config)
    const chips = wrapper.findAll('[data-testid="view-chip"]')
    expect(chips).toHaveLength(3)
    expect(chips[0]!.text()).toContain('Home')
    expect(chips[1]!.text()).toContain('Kitchen')
    expect(chips[2]!.text()).toContain('Bedroom')
  })

  it('renders the Home chip as selected and disabled', () => {
    const wrapper = mountPreview(config)
    const home = wrapper.findAll('[data-testid="view-chip"]')[0]!
    expect(home.attributes('aria-pressed')).toBe('true')
    expect(home.attributes('disabled')).toBeDefined()
  })

  it('emits the room id when a room chip is clicked', async () => {
    const wrapper = mountPreview(config)

    await wrapper.findAll('[data-testid="view-chip"]')[1]!.trigger('click')

    expect(wrapper.emitted('toggle-room-view')).toEqual([['kitchen']])
  })

  it('renders hidden candidate room chips as inactive and toggleable', () => {
    const wrapper = mountPreview(
      {
        title: config.title,
        views: [
          { type: 'sections', title: 'Home', path: 'home', icon: 'mdi:home-variant' },
          {
            type: 'sections',
            title: 'Kitchen',
            path: 'kitchen',
            icon: 'mdi:silverware-fork-knife',
          },
        ],
      },
      {
        viewCandidates: config.views,
        roomOverrides: { bedroom: { hiddenFromDashboard: true } },
      },
    )
    const bedroom = wrapper.findAll('[data-testid="view-chip"]')[2]!

    expect(bedroom.text()).toContain('Bedroom')
    expect(bedroom.attributes('aria-pressed')).toBe('false')
    expect(bedroom.attributes('aria-label')).toBe('Show Bedroom dashboard view')
    expect(bedroom.classes()).toContain('opacity-60')
  })

  it('shows active and total view counts when some room chips are hidden', () => {
    const wrapper = mountPreview(
      {
        title: config.title,
        views: [
          { type: 'sections', title: 'Home', path: 'home', icon: 'mdi:home-variant' },
          {
            type: 'sections',
            title: 'Kitchen',
            path: 'kitchen',
            icon: 'mdi:silverware-fork-knife',
          },
        ],
      },
      {
        viewCandidates: config.views,
        roomOverrides: { bedroom: { hiddenFromDashboard: true } },
      },
    )

    expect(wrapper.text()).toContain('Will create 2 of 3 dashboard views')
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
    const chips = wrapper.findAll('[data-testid="view-chip"]')
    expect(chips).toHaveLength(0)
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
