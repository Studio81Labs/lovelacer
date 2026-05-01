<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { LovelaceConfig } from '../api/types.js'

defineProps<{ config: LovelaceConfig }>()
</script>

<template>
  <section v-if="config.views.length > 0">
    <h3 class="mb-3 text-sm font-medium text-stone-700">
      Will create {{ config.views.length }} dashboard
      {{ config.views.length === 1 ? 'view' : 'views' }}
    </h3>
    <ul class="flex flex-wrap gap-2">
      <li
        v-for="view in config.views"
        :key="view.path"
        data-testid="view-pill"
        class="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700"
      >
        <Icon :icon="view.icon" class="h-4 w-4" />
        <span>{{ view.title }}</span>
      </li>
    </ul>
  </section>
</template>
