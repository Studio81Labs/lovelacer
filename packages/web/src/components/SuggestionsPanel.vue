<script setup lang="ts">
import { computed } from 'vue'
import { useOverridesStore } from '../stores/overrides.js'
import { useSuggestionsStore } from '../stores/suggestions.js'
import { roomIdToDisplay } from '../rooms.js'
import type { Suggestion } from '../api/types.js'

const props = defineProps<{ suggestions: Suggestion[] }>()
const overrides = useOverridesStore()
const suggestionsStore = useSuggestionsStore()

const visible = computed(() =>
  props.suggestions.filter((s) => !suggestionsStore.isDismissed(s.entityId, s.type)),
)

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
    return
  }
  if (s.type === 'hide_diagnostic') {
    overrides.setHidden(s.entityId, true)
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
  if (s.type === 'set_area_id') return 'Open HA settings'
  if (s.type === 'move_room') return `Move to ${suggestedLabel(s)}`
  return 'Hide'
}
</script>

<template>
  <section
    v-if="visible.length > 0"
    data-testid="suggestions-panel"
    class="rounded-lg border border-stone-200 bg-white px-5 py-3 text-sm"
  >
    <h3 class="mb-3 text-sm font-medium text-stone-700">
      {{ visible.length }} suggestion{{ visible.length === 1 ? '' : 's' }}
    </h3>
    <ul class="space-y-2">
      <li
        v-for="s in visible"
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
          class="rounded bg-brand-600 px-3 py-1 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="suggestionsStore.phase === 'dismissing'"
          @click="accept(s)"
        >
          {{ acceptLabel(s) }}
        </button>
        <button
          type="button"
          data-testid="suggestion-dismiss"
          class="rounded border border-stone-300 bg-white px-3 py-1 font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="suggestionsStore.phase === 'dismissing'"
          @click="dismiss(s)"
        >
          Dismiss
        </button>
      </li>
    </ul>
  </section>
</template>
