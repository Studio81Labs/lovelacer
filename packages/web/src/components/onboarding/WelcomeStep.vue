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
      class="ll-control mt-1"
      :value="settings.effective.language"
      @change="settings.setLanguage(($event.target as HTMLSelectElement).value as SettingsLanguage)"
    >
      <option value="auto">{{ t('detectionLanguage.option.auto') }}</option>
      <option value="en">{{ t('detectionLanguage.option.en') }}</option>
      <option value="cs">{{ t('detectionLanguage.option.cs') }}</option>
      <option value="de">{{ t('detectionLanguage.option.de') }}</option>
      <option value="es">{{ t('detectionLanguage.option.es') }}</option>
      <option value="fr">{{ t('detectionLanguage.option.fr') }}</option>
      <option value="it">{{ t('detectionLanguage.option.it') }}</option>
      <option value="nl">{{ t('detectionLanguage.option.nl') }}</option>
      <option value="pl">{{ t('detectionLanguage.option.pl') }}</option>
    </select>

    <button
      type="button"
      data-testid="welcome-continue"
      class="ll-btn ll-btn-primary ll-btn-full mt-6"
      @click="$emit('continue')"
    >
      {{ t('common.continue') }}
    </button>

    <button
      type="button"
      data-testid="welcome-skip"
      class="ll-btn ll-btn-ghost ll-btn-full mt-3"
      @click="$emit('skip')"
    >
      {{ t('common.skipOnboarding') }}
    </button>
  </div>
</template>
