<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import type { LovelaceConfig } from '../api/types.js'

const { t } = useI18n()
defineProps<{ config: LovelaceConfig }>()
</script>

<template>
  <section v-if="config.views.length > 0">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-medium text-stone-700">
        {{ t('dashboardPreview.willCreate', { count: config.views.length }, config.views.length) }}
      </h3>
      <!--
        Document-relative URL (no leading slash) so the link resolves
        under the add-on's HA Supervisor ingress path
        `/api/hassio_ingress/<token>/`. An absolute `/api/...` would
        bypass the prefix and 404 in production. Matches the convention
        used by every fetch call in api/client.ts.
      -->
      <a
        href="api/export.yaml"
        download
        data-testid="export-yaml-link"
        class="rounded border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
      >
        {{ t('dashboardPreview.downloadYaml') }}
      </a>
    </div>
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
