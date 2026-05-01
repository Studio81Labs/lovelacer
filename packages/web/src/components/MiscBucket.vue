<script setup lang="ts">
import type { MiscEntity } from '../api/types.js'

defineProps<{ misc: MiscEntity[] }>()
</script>

<template>
  <details v-if="misc.length > 0" class="rounded-lg border border-stone-200 bg-white px-5 py-3">
    <summary class="cursor-pointer text-sm font-medium text-stone-700">
      {{ misc.length }} entities not assigned to any room
    </summary>
    <ul class="mt-3 space-y-1 text-xs text-stone-600">
      <li v-for="entity in misc" :key="entity.entityId" class="flex items-center justify-between">
        <span class="font-mono">{{ entity.entityId }}</span>
        <span class="text-stone-500">{{ entity.friendlyName }}</span>
      </li>
    </ul>
  </details>
</template>
