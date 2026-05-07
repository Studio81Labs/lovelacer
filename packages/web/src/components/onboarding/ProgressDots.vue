<script setup lang="ts">
defineProps<{
  current: string
  steps: ReadonlyArray<string>
}>()
</script>

<template>
  <div data-testid="progress-dots" class="flex items-center justify-center gap-3 pb-6">
    <template v-for="(step, idx) in steps" :key="step">
      <div
        :data-testid="`progress-dot-${step}`"
        class="h-2 w-2 rounded-full"
        :class="step === current ? 'bg-amber-500' : 'bg-stone-300'"
      />
      <div v-if="idx < steps.length - 1" class="h-px w-8 bg-stone-200" aria-hidden="true" />
    </template>
  </div>
</template>
