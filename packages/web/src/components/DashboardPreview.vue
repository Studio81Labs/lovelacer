<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LovelaceConfig, LovelaceView, RoomDisplayOverride } from '../api/types.js'

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    config: LovelaceConfig
    viewCandidates?: LovelaceView[]
    roomOverrides?: Record<string, RoomDisplayOverride>
    disabled?: boolean
    interactive?: boolean
  }>(),
  {
    viewCandidates: () => [],
    roomOverrides: () => ({}),
    disabled: false,
    interactive: false,
  },
)
const emit = defineEmits<{
  'toggle-room-view': [roomId: string]
}>()

const candidateViews = computed(() =>
  props.viewCandidates.length > 0 ? props.viewCandidates : props.config.views,
)
const activePaths = computed(() => new Set(props.config.views.map((view) => view.path)))
const totalCount = computed(() => candidateViews.value.length)
const activeCount = computed(() => props.config.views.length)

function isHomeView(view: LovelaceView): boolean {
  return view.path === 'home'
}

function isSelected(view: LovelaceView): boolean {
  if (isHomeView(view)) return true
  return (
    activePaths.value.has(view.path) && props.roomOverrides[view.path]?.hiddenFromDashboard !== true
  )
}

function chipLabel(view: LovelaceView): string {
  if (isHomeView(view) || !props.interactive) return view.title
  return t(isSelected(view) ? 'dashboardPreview.hideView' : 'dashboardPreview.showView', {
    title: view.title,
  })
}

function toggleRoomView(view: LovelaceView): void {
  if (isHomeView(view) || !props.interactive || props.disabled) return
  emit('toggle-room-view', view.path)
}
</script>

<template>
  <section v-if="candidateViews.length > 0">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-medium text-stone-700">
        <template v-if="activeCount === totalCount">
          {{ t('dashboardPreview.willCreate', { count: activeCount }, activeCount) }}
        </template>
        <template v-else>
          {{
            t(
              'dashboardPreview.willCreateSelected',
              { active: activeCount, total: totalCount },
              totalCount,
            )
          }}
        </template>
      </h3>
      <!--
        Document-relative URL (no leading slash) so the link resolves
        under the add-on's HA Supervisor ingress path
        `/api/hassio_ingress/<token>/`. An absolute `/api/...` would
        bypass the prefix and 404 in production. Matches the convention
        used by every fetch call in api/client.ts.
      -->
      <a
        href="api/export.yaml"
        download
        data-testid="export-yaml-link"
        class="ll-btn ll-btn-secondary ll-btn-compact"
      >
        {{ t('dashboardPreview.downloadYaml') }}
      </a>
    </div>
    <ul class="flex flex-wrap gap-2">
      <li v-for="view in candidateViews" :key="view.path">
        <button
          type="button"
          data-testid="view-chip"
          :disabled="disabled || isHomeView(view) || !interactive"
          :aria-pressed="isSelected(view) ? 'true' : 'false'"
          :aria-label="chipLabel(view)"
          :class="[
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
            isSelected(view)
              ? 'border-forest-200 bg-forest-50 text-forest-700'
              : 'border-stone-200 bg-white text-stone-500 opacity-60 line-through',
            disabled || isHomeView(view) || !interactive
              ? 'cursor-default'
              : 'cursor-pointer hover:border-forest-300 hover:bg-forest-50',
          ]"
          @click="toggleRoomView(view)"
        >
          <Icon :icon="view.icon" class="h-4 w-4" />
          <span>{{ view.title }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
