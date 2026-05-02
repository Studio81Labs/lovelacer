<script setup lang="ts">
import EntityRow from './EntityRow.vue'
import type { MiscEntity } from '../api/types.js'

defineProps<{ misc: MiscEntity[] }>()
</script>

<template>
  <details v-if="misc.length > 0" class="rounded-lg border border-stone-200 bg-white">
    <summary class="cursor-pointer px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
      {{ misc.length }} entities not assigned to any room
    </summary>
    <ul class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
      <li v-for="entity in misc" :key="entity.entityId">
        <EntityRow
          :entity-id="entity.entityId"
          :friendly-name="entity.friendlyName"
          room-id="misc"
        />
      </li>
    </ul>
  </details>
</template>
