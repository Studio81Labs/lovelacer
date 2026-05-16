<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOverridesStore } from '../stores/overrides.js'

const { t } = useI18n()
const overrides = useOverridesStore()

const countLabel = computed(() =>
  t('overridesBar.pendingChanges', { count: overrides.dirtyCount }, overrides.dirtyCount),
)

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
    :aria-label="t('overridesBar.ariaLabel')"
    class="flex flex-col gap-3 rounded-lg border px-5 py-3 text-sm"
    :class="
      isError
        ? 'border-danger-700/30 bg-danger-50 text-danger-700'
        : 'border-amber-200 bg-amber-50 text-amber-900'
    "
  >
    <div class="flex items-center justify-between gap-3">
      <span class="font-medium">
        {{ isSaving ? t('overridesBar.saving') : countLabel }}
      </span>

      <div class="flex gap-2">
        <button
          data-testid="discard-button"
          type="button"
          class="ll-btn ll-btn-secondary ll-btn-compact"
          :disabled="isSaving"
          @click="onDiscard"
        >
          {{ t('overridesBar.discard') }}
        </button>
        <button
          v-if="!isError"
          data-testid="save-button"
          type="button"
          class="ll-btn ll-btn-primary ll-btn-compact"
          :disabled="isSaving"
          @click="onSave"
        >
          {{ isSaving ? t('overridesBar.saving') : t('overridesBar.saveAndReanalyze') }}
        </button>
      </div>
    </div>

    <div v-if="isError" class="flex items-center justify-between gap-3">
      <span>{{ overrides.error?.message }}</span>
      <button
        data-testid="retry-button"
        type="button"
        class="ll-btn ll-btn-danger ll-btn-compact"
        @click="onSave"
      >
        {{ t('common.retry') }}
      </button>
    </div>
  </section>
</template>
