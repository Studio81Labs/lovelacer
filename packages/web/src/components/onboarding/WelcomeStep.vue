<script setup lang="ts">
import { useSettingsStore } from '../../stores/settings.js'
import type { SettingsLanguage } from '../../api/types.js'

defineEmits<{ continue: []; skip: [] }>()

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
          Home Assistant dashboards that organize themselves
        </p>
      </div>
    </header>
    <p class="mt-6 text-stone-600">Pick your detection language, then we'll show you a preview.</p>

    <label for="welcome-language" class="mt-6 block text-sm font-medium text-stone-700">
      Detection language
    </label>
    <select
      id="welcome-language"
      data-testid="welcome-language"
      class="mt-1 w-full rounded border border-stone-300 px-2 py-1.5"
      :value="settings.effective.language"
      @change="settings.setLanguage(($event.target as HTMLSelectElement).value as SettingsLanguage)"
    >
      <option value="auto">Auto (match all)</option>
      <option value="en">English</option>
      <option value="cs">Čeština</option>
    </select>

    <button
      type="button"
      data-testid="welcome-continue"
      class="mt-6 w-full rounded bg-amber-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
      @click="$emit('continue')"
    >
      Continue
    </button>

    <button
      type="button"
      data-testid="welcome-skip"
      class="mt-3 w-full text-sm text-stone-500 hover:text-stone-700"
      @click="$emit('skip')"
    >
      Skip onboarding
    </button>
  </div>
</template>
