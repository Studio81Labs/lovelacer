<script setup lang="ts">
import { computed } from 'vue'
import type { DiffResult } from '../api/types.js'

const props = defineProps<{ diff: DiffResult | null }>()

const isZero = computed(
  () =>
    props.diff !== null &&
    props.diff.totals.added === 0 &&
    props.diff.totals.moved === 0 &&
    props.diff.totals.removed === 0,
)

/**
 * Format the snapshot's appliedAt as "today", "yesterday", or an absolute
 * date. Compares CALENDAR DAYS (not 24-hour periods) so an apply at
 * 11pm Mon viewed at 10pm Tue (23h elapsed) reads "yesterday", not
 * "today". `Math.round` defends against DST transitions where a "day"
 * is 23 or 25 hours.
 */
function formatApplied(unixSeconds: number): string {
  const applied = new Date(unixSeconds * 1000)
  const now = new Date()
  const appliedMidnight = new Date(
    applied.getFullYear(),
    applied.getMonth(),
    applied.getDate(),
  ).getTime()
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diffDays = Math.round((nowMidnight - appliedMidnight) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  return applied.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <section
    v-if="diff !== null"
    data-testid="diff-banner"
    class="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-5 py-2 text-sm"
  >
    <div v-if="isZero" class="text-stone-600">
      No changes since last apply {{ formatApplied(diff.appliedAt) }}.
    </div>
    <div v-else class="flex items-center gap-2">
      <span class="text-stone-600">Since last apply:</span>
      <span
        v-if="diff.totals.added > 0"
        data-testid="diff-banner-added"
        class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
        >+{{ diff.totals.added }} added</span
      >
      <span
        v-if="diff.totals.moved > 0"
        data-testid="diff-banner-moved"
        class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
        >↻ {{ diff.totals.moved }} moved</span
      >
      <span
        v-if="diff.totals.removed > 0"
        data-testid="diff-banner-removed"
        class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
        >✗ {{ diff.totals.removed }} removed</span
      >
    </div>
    <span v-if="!isZero" class="text-xs text-stone-500">{{ formatApplied(diff.appliedAt) }}</span>
  </section>
</template>
