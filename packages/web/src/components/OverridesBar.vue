<script setup lang="ts">
import { computed } from 'vue'
import { useOverridesStore } from '../stores/overrides.js'

const overrides = useOverridesStore()

const countLabel = computed(() => {
  const n = overrides.dirtyCount
  return `${n} pending change${n === 1 ? '' : 's'}`
})

const isSaving = computed(() => overrides.phase === 'saving')
const isError = computed(() => overrides.phase === 'error' && overrides.error !== null)

function onDiscard() {
  overrides.discardChanges()
}

function onSave() {
  void overrides.saveAndReanalyze()
}
</script>

<template>
  <section
    v-if="overrides.hasDirty"
    data-testid="overrides-bar"
    aria-label="Pending overrides"
    class="flex flex-col gap-3 rounded-lg border px-5 py-3 text-sm"
    :class="
      isError ? 'bg-danger-50 text-danger-700' : 'border-amber-200 bg-amber-50 text-amber-900'
    "
  >
    <div class="flex items-center justify-between gap-3">
      <span class="font-medium">
        {{ isSaving ? 'Saving…' : countLabel }}
      </span>

      <div class="flex gap-2">
        <button
          data-testid="discard-button"
          type="button"
          class="rounded bg-stone-600 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isSaving"
          @click="onDiscard"
        >
          Discard
        </button>
        <button
          v-if="!isError"
          data-testid="save-button"
          type="button"
          class="rounded bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isSaving"
          @click="onSave"
        >
          {{ isSaving ? 'Saving…' : 'Save & re-analyze' }}
        </button>
      </div>
    </div>

    <div v-if="isError" class="flex items-center justify-between gap-3">
      <span>{{ overrides.error?.message }}</span>
      <button
        data-testid="retry-button"
        type="button"
        class="rounded bg-danger-700 px-3 py-1 text-xs font-medium text-white hover:bg-danger-700"
        @click="onSave"
      >
        Retry
      </button>
    </div>
  </section>
</template>
