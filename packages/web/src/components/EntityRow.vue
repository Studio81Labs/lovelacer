<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOverridesStore } from '../stores/overrides.js'
import { ASSIGNABLE_ROOMS, roomIdToDisplay } from '../rooms.js'
import type { EntityDiff } from '../api/types.js'

const { t } = useI18n()

interface Props {
  entityId: string
  friendlyName: string
  roomId: string
  manual?: boolean
  diff?: EntityDiff
  /**
   * P2-7 — when true, the room override dropdown and hide checkbox are
   * hidden. Used by the onboarding wizard's PreviewStep, which renders a
   * non-editable preview of the upcoming dashboard.
   */
  readOnly?: boolean
}

const props = defineProps<Props>()
const overrides = useOverridesStore()

const eff = computed(() => overrides.effective(props.entityId))

/** Dropdown's current value: override's roomId, or detector's, or '' for misc. */
const selectedRoom = computed(() => {
  const override = eff.value
  if (override?.roomId !== undefined) return override.roomId
  // Detector's roomId. Misc maps to '' so the dropdown shows "let detector decide".
  return props.roomId === 'misc' ? '' : props.roomId
})

const isHidden = computed(() => eff.value?.hidden === true)

const isOverridden = computed(() => eff.value !== null || props.manual === true)

const isSaving = computed(() => overrides.phase === 'saving')

function onRoomChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  overrides.setRoomId(props.entityId, value === '' ? null : value)
}

function onHideChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  overrides.setHidden(props.entityId, checked)
}

const rowClass = computed(() => {
  const classes: string[] = ['flex', 'items-center', 'justify-between', 'gap-3', 'px-5', 'py-2']
  if (isOverridden.value) {
    classes.push('border-l-2', 'border-amber-400', 'bg-amber-50/40')
  }
  if (isHidden.value) {
    classes.push('opacity-60')
  }
  return classes
})

const diffTagText = computed<string | null>(() => {
  if (props.diff === undefined) return null
  if (props.diff.kind === 'added') return t('entityRow.diffNew')
  if (props.diff.kind === 'moved') {
    const prev = props.diff.previousRoomId
    const label = prev === null || prev === undefined ? t('entityRow.misc') : roomIdToDisplay(prev)
    return t('entityRow.diffMovedFrom', { room: label })
  }
  return null
})

const diffTagClass = computed<string>(() => {
  if (props.diff?.kind === 'added') return 'bg-forest-50 text-forest-700'
  if (props.diff?.kind === 'moved') return 'bg-stone-200 text-stone-700'
  return ''
})
</script>

<template>
  <div :class="rowClass" data-testid="entity-row">
    <div class="flex min-w-0 flex-col">
      <span class="truncate font-mono text-xs text-stone-700">
        {{ entityId }}<span v-if="isHidden"> {{ t('entityRow.hiddenSuffix') }}</span>
      </span>
      <span class="flex items-center truncate text-xs text-stone-500">
        {{ friendlyName }}
        <span
          v-if="diffTagText !== null"
          data-testid="entity-diff-tag"
          class="ml-2 rounded px-2 py-0.5 text-xs font-medium"
          :class="diffTagClass"
          >{{ diffTagText }}</span
        >
      </span>
    </div>

    <div v-if="!readOnly" class="flex items-center gap-3">
      <select
        data-testid="room-select"
        :aria-label="t('entityRow.assignRoom')"
        class="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
        :value="selectedRoom"
        :disabled="isSaving"
        @change="onRoomChange"
      >
        <option value="">{{ t('entityRow.letDetectorDecide') }}</option>
        <option v-for="rid in ASSIGNABLE_ROOMS" :key="rid" :value="rid">
          {{ roomIdToDisplay(rid) }}
        </option>
      </select>

      <label class="flex items-center gap-1 text-xs text-stone-700">
        <input
          data-testid="hide-toggle"
          type="checkbox"
          class="h-4 w-4 rounded border-stone-300 disabled:cursor-not-allowed disabled:opacity-50"
          :checked="isHidden"
          :disabled="isSaving"
          @change="onHideChange"
        />
        {{ t('entityRow.hide') }}
      </label>
    </div>
  </div>
</template>
