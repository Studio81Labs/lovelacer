import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import MiscBucket from '../../components/MiscBucket.vue'
import type { MiscEntity } from '../../api/types.js'
import { useOverridesStore } from '../../stores/overrides.js'
import { createTestI18n } from '../test-utils.js'

function mountBucket(misc: MiscEntity[]) {
  return mount(MiscBucket, {
    props: { misc },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
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

describe('MiscBucket bulk select', () => {
  const sample: MiscEntity[] = [
    { entityId: 'sensor.a', friendlyName: 'Sensor A', domain: 'sensor' },
    { entityId: 'sensor.b', friendlyName: 'Sensor B', domain: 'sensor' },
    { entityId: 'sensor.c', friendlyName: 'Sensor C', domain: 'sensor' },
  ]

  it('does not render the bulk bar when no entities are selected', () => {
    const wrapper = mountBucket(sample)
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('shows the bulk bar with "1 selected" when one checkbox is checked', async () => {
    const wrapper = mountBucket(sample)
    const checkbox = wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!
    await checkbox.setValue(true)
    const bar = wrapper.find('[data-testid="misc-bulk-bar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('1 selected')
  })

  it('updates the count as more checkboxes are checked', async () => {
    const wrapper = mountBucket(sample)
    const checkboxes = wrapper.findAll('[data-testid="misc-row-checkbox"]')
    await checkboxes[0]!.setValue(true)
    await checkboxes[1]!.setValue(true)
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').text()).toContain('2 selected')
  })

  it('hides the bulk bar when the count returns to zero', async () => {
    const wrapper = mountBucket(sample)
    const checkbox = wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!
    await checkbox.setValue(true)
    await checkbox.setValue(false)
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('selects all rows when "Select all" is clicked', async () => {
    const wrapper = mountBucket(sample)
    // Need at least one selected first to make the bulk bar visible.
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    const selectAllBtn = wrapper.findAll('button').find((b) => b.text() === 'Select all')!
    await selectAllBtn.trigger('click')
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').text()).toContain('3 selected')
    const checkboxes = wrapper.findAll('[data-testid="misc-row-checkbox"]')
    for (const cb of checkboxes) {
      expect((cb.element as HTMLInputElement).checked).toBe(true)
    }
  })

  it('clears selection when "Select none" is clicked (after Select all)', async () => {
    const wrapper = mountBucket(sample)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Select all')!
      .trigger('click')
    // Now all are selected; the toggle button should read "Select none".
    const noneBtn = wrapper.findAll('button').find((b) => b.text() === 'Select none')!
    await noneBtn.trigger('click')
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('clears selection when "Clear" is clicked', async () => {
    const wrapper = mountBucket(sample)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[1]!.setValue(true)
    const clearBtn = wrapper.findAll('button').find((b) => b.text() === 'Clear')!
    await clearBtn.trigger('click')
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('disables Assign until a target room is picked', async () => {
    const wrapper = mountBucket(sample)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    const assignBtn = wrapper.find('[data-testid="misc-bulk-assign"]')
    expect(assignBtn.attributes('disabled')).toBeDefined()
  })

  it('enables Assign once a target room is picked', async () => {
    const wrapper = mountBucket(sample)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.find('[data-testid="misc-bulk-room"]').setValue('kitchen')
    const assignBtn = wrapper.find('[data-testid="misc-bulk-assign"]')
    expect(assignBtn.attributes('disabled')).toBeUndefined()
  })

  it('does NOT clear room overrides when Assign somehow fires with no room picked (defense-in-depth)', async () => {
    // The Assign button is disabled when bulkRoom is empty, but if a
    // future trigger path (keyboard shortcut, programmatic call) skips
    // that gate, applyAssign must NOT silently call setRoomId(id, null)
    // and wipe room overrides for the selection.
    const wrapper = mountBucket(sample)
    const overrides = useOverridesStore()
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[1]!.setValue(true)
    // bulkRoom remains '' — bypass the disabled attribute by clicking
    // anyway via the DOM (simulates a hostile or accidental trigger).
    const assignBtn = wrapper.find('[data-testid="misc-bulk-assign"]')
    await assignBtn.trigger('click')
    // No overrides should have been staged.
    expect(overrides.dirtyCount).toBe(0)
    // Selection should remain (the no-op exit returns before the clear).
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').text()).toContain('2 selected')
  })

  it('bulk-assigns selected entities and stages them in the override store', async () => {
    const wrapper = mountBucket(sample)
    const overrides = useOverridesStore()
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[1]!.setValue(true)
    await wrapper.find('[data-testid="misc-bulk-room"]').setValue('kitchen')
    await wrapper.find('[data-testid="misc-bulk-assign"]').trigger('click')

    // Two entities now have a pending kitchen override.
    expect(overrides.dirtyCount).toBe(2)
    expect(overrides.effective('sensor.a')?.roomId).toBe('kitchen')
    expect(overrides.effective('sensor.b')?.roomId).toBe('kitchen')
    // Selection cleared after applying.
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('bulk-hides selected entities and stages them in the override store', async () => {
    const wrapper = mountBucket(sample)
    const overrides = useOverridesStore()
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[1]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[2]!.setValue(true)
    await wrapper.find('[data-testid="misc-bulk-hide"]').trigger('click')

    expect(overrides.dirtyCount).toBe(3)
    expect(overrides.effective('sensor.a')?.hidden).toBe(true)
    expect(overrides.effective('sensor.b')?.hidden).toBe(true)
    expect(overrides.effective('sensor.c')?.hidden).toBe(true)
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('clears selection when props.misc changes (regression: stale selection after re-analyze)', async () => {
    const wrapper = mountBucket(sample)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[1]!.setValue(true)
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').text()).toContain('2 selected')
    // Simulate a re-analyze handing in a fresh, shorter misc list.
    await wrapper.setProps({
      misc: [{ entityId: 'sensor.different', friendlyName: 'Diff', domain: 'sensor' }],
    })
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('disables bulk controls while overrides.phase is "saving"', async () => {
    const wrapper = mountBucket(sample)
    const overrides = useOverridesStore()
    // Select to surface the bulk bar.
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    // Move into saving phase via $patch (testing-pinia).
    overrides.$patch({ phase: 'saving' })
    await wrapper.vm.$nextTick()

    const assignBtn = wrapper.find('[data-testid="misc-bulk-assign"]')
    const hideBtn = wrapper.find('[data-testid="misc-bulk-hide"]')
    const roomSelect = wrapper.find('[data-testid="misc-bulk-room"]')
    const toggleAllBtn = wrapper.find('[data-testid="misc-bulk-toggle-all"]')
    const clearBtn = wrapper.find('[data-testid="misc-bulk-clear"]')
    const checkbox = wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!

    expect(assignBtn.attributes('disabled')).toBeDefined()
    expect(hideBtn.attributes('disabled')).toBeDefined()
    expect(roomSelect.attributes('disabled')).toBeDefined()
    // Bugbot caught: toggle-all and Clear were initially un-gated, which
    // would let the user inflate or zero the selection mid-save. If the
    // save then failed (phase → 'error', no re-analyze fires the
    // watch-clear), the manipulated selection would persist. Lock the
    // contract that ALL selection-mutating controls disable during save.
    expect(toggleAllBtn.attributes('disabled')).toBeDefined()
    expect(clearBtn.attributes('disabled')).toBeDefined()
    expect((checkbox.element as HTMLInputElement).disabled).toBe(true)
  })

  it('preserves per-entity EntityRow controls (regression: bulk UI did not break the existing dropdown)', async () => {
    const wrapper = mountBucket(sample)
    const overrides = useOverridesStore()
    // Don't touch the bulk checkboxes. Use the per-row dropdown directly.
    const rowSelect = wrapper.findAll('[data-testid="room-select"]')[0]!
    await rowSelect.setValue('living_room')
    expect(overrides.effective('sensor.a')?.roomId).toBe('living_room')
  })

  it('with readOnly: true, hides bulk-row checkboxes and the per-row hide toggle', async () => {
    const wrapper = mount(MiscBucket, {
      props: {
        misc: [
          { entityId: 'sensor.a', friendlyName: 'A', domain: 'sensor' },
          { entityId: 'sensor.b', friendlyName: 'B', domain: 'sensor' },
        ],
        readOnly: true,
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
      },
    })
    expect(wrapper.findAll('[data-testid="misc-row-checkbox"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="hide-toggle"]')).toHaveLength(0)
    // Expand to ensure rows still render (read-only mode doesn't break the listing).
    const summary = wrapper.find('summary')
    await summary.trigger('click')
    expect(wrapper.findAll('[data-testid="entity-row"]')).toHaveLength(2)
  })
})
