<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../stores/settings.js'
import type { SettingsLanguage } from '../../api/types.js'

defineEmits<{ continue: []; skip: [] }>()

const { t } = useI18n()
const settings = useSettingsStore()

// Ingress-relative — see App.vue's markUrl for the full rationale.
const markUrl = `${import.meta.env.BASE_URL}brand/lovelacer-mark.svg`
</script>

<template>
  <div data-testid="welcome-step" class="rounded-lg bg-white p-8 shadow-sm">
    <header class="flex items-center gap-3">
      <img :src="markUrl" alt="" class="h-10 w-10" aria-hidden="true" />
      <div>
        <h1 class="lovelacer-wordmark text-3xl leading-none">lovelace<i>r</i></h1>
        <p class="mt-1 text-sm text-stone-500">
          {{ t('app.tagline') }}
        </p>
      </div>
    </header>
    <p class="mt-6 text-stone-600">{{ t('welcomeStep.intro') }}</p>

    <label for="welcome-language" class="mt-6 block text-sm font-medium text-stone-700">
      {{ t('detectionLanguage.label') }}
    </label>
    <select
      id="welcome-language"
      data-testid="welcome-language"
      class="mt-1 w-full rounded border border-stone-300 px-2 py-1.5"
      :value="settings.effective.language"
      @change="settings.setLanguage(($event.target as HTMLSelectElement).value as SettingsLanguage)"
    >
      <option value="auto">{{ t('detectionLanguage.option.auto') }}</option>
      <option value="en">{{ t('detectionLanguage.option.en') }}</option>
      <option value="cs">{{ t('detectionLanguage.option.cs') }}</option>
    </select>

    <button
      type="button"
      data-testid="welcome-continue"
      class="mt-6 w-full rounded bg-amber-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
      @click="$emit('continue')"
    >
      {{ t('common.continue') }}
    </button>

    <button
      type="button"
      data-testid="welcome-skip"
      class="mt-3 w-full text-sm text-stone-500 hover:text-stone-700"
      @click="$emit('skip')"
    >
      {{ t('common.skipOnboarding') }}
    </button>
  </div>
</template>
