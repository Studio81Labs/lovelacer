<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOverridesStore } from '../stores/overrides.js'
import { useSuggestionsStore } from '../stores/suggestions.js'
import { roomIdToDisplay } from '../rooms.js'
import type { Suggestion } from '../api/types.js'

const { t } = useI18n()
const props = defineProps<{ suggestions: Suggestion[] }>()
const overrides = useOverridesStore()
const suggestionsStore = useSuggestionsStore()
const showAll = ref(false)
const locallyResolved = ref<Set<string>>(new Set())

const VISIBLE_LIMIT = 20

const visible = computed(() =>
  props.suggestions.filter(
    (s) =>
      !suggestionsStore.isDismissed(s.entityId, s.type) &&
      !locallyResolved.value.has(suggestionKey(s)),
  ),
)
const displayed = computed(() =>
  showAll.value ? visible.value : visible.value.slice(0, VISIBLE_LIMIT),
)
const isTruncated = computed(() => displayed.value.length < visible.value.length)

function suggestionKey(s: Suggestion): string {
  return `${s.entityId}|${s.type}`
}

function resolveLocally(s: Suggestion): void {
  const next = new Set(locallyResolved.value)
  next.add(suggestionKey(s))
  locallyResolved.value = next
}

function accept(s: Suggestion): void {
  if (s.type === 'set_area_id') {
    // Host-rooted absolute path: navigates to HA's entity settings even
    // when the SPA is served under add-on ingress at
    // /api/hassio_ingress/<token>/. Opens in a new tab so the user
    // can return to the analyze view.
    window.open(`/config/entities?entity_id=${encodeURIComponent(s.entityId)}`, '_blank')
    return
  }
  if (s.type === 'move_room' && s.suggestedRoomId !== undefined) {
    overrides.setRoomId(s.entityId, s.suggestedRoomId)
    resolveLocally(s)
    return
  }
  if (s.type === 'hide_diagnostic') {
    overrides.setHidden(s.entityId, true)
    resolveLocally(s)
    return
  }
}

async function dismiss(s: Suggestion): Promise<void> {
  try {
    await suggestionsStore.dismiss(s.entityId, s.type)
  } catch {
    // Store already set phase=error and stashed the ApiError. The
    // suggestion stays visible because the optimistic key wasn't added.
    // Lite version: no toast — user can retry by clicking Dismiss again.
  }
}

function suggestedLabel(s: Suggestion): string {
  if (s.type === 'move_room' && s.suggestedRoomId !== undefined) {
    return roomIdToDisplay(s.suggestedRoomId)
  }
  if (s.type === 'set_area_id' && s.matchedRoomId !== undefined) {
    return roomIdToDisplay(s.matchedRoomId)
  }
  return ''
}

function acceptLabel(s: Suggestion): string {
  if (s.type === 'set_area_id') return t('suggestionsPanel.openHaSettings')
  if (s.type === 'move_room') return t('suggestionsPanel.moveTo', { room: suggestedLabel(s) })
  return t('suggestionsPanel.hide')
}
</script>

<template>
  <section
    v-if="visible.length > 0"
    data-testid="suggestions-panel"
    class="rounded-lg border border-stone-200 bg-white px-5 py-3 text-sm"
  >
    <h3 class="mb-3 text-sm font-medium text-stone-700">
      {{ t('suggestionsPanel.heading', { count: visible.length }, visible.length) }}
    </h3>
    <ul class="space-y-2">
      <li
        v-for="s in displayed"
        :key="`${s.entityId}|${s.type}`"
        data-testid="suggestion-card"
        class="flex items-center gap-3 rounded border border-stone-100 bg-stone-50/50 px-3 py-2 text-xs"
      >
        <div class="min-w-0 flex-1">
          <span class="font-mono text-stone-700">{{ s.entityId }}</span>
          <p class="mt-0.5 text-stone-600">{{ s.message }}</p>
        </div>
        <button
          type="button"
          data-testid="suggestion-accept"
          class="ll-btn ll-btn-primary ll-btn-compact"
          :disabled="suggestionsStore.phase === 'dismissing'"
          @click="accept(s)"
        >
          {{ acceptLabel(s) }}
        </button>
        <button
          type="button"
          data-testid="suggestion-dismiss"
          class="ll-btn ll-btn-secondary ll-btn-compact"
          :disabled="suggestionsStore.phase === 'dismissing'"
          @click="dismiss(s)"
        >
          {{ t('suggestionsPanel.dismiss') }}
        </button>
      </li>
    </ul>
    <div
      v-if="isTruncated || showAll"
      data-testid="suggestions-truncated"
      class="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500"
    >
      <span>{{
        t('suggestionsPanel.showingSubset', { shown: displayed.length, total: visible.length })
      }}</span>
      <button
        type="button"
        data-testid="suggestions-show-all"
        class="ll-btn ll-btn-ghost ll-btn-compact"
        @click="showAll = !showAll"
      >
        {{ showAll ? t('suggestionsPanel.showLess') : t('suggestionsPanel.showAll') }}
      </button>
    </div>
  </section>
</template>
