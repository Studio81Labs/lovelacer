<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInviteStore } from '../stores/invite.js'

const { t } = useI18n()
const invite = useInviteStore()
const code = ref('')

const isSubmitting = computed(() => invite.phase === 'submitting')

const errorMessage = computed(() => {
  if (invite.phase !== 'error' || invite.error === null) return ''
  if (invite.error.error === 'invalid_code') {
    return t('inviteGate.error.invalidCode')
  }
  if (invite.error.error === 'invalid_body') return t('inviteGate.error.invalidBody')
  if (invite.error.error === 'network') return t('inviteGate.error.network')
  return invite.error.message
})

async function onSubmit(e: Event) {
  e.preventDefault()
  await invite.submit(code.value)
}
</script>

<template>
  <div
    data-testid="invite-gate"
    class="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm"
  >
    <form
      class="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-xl"
      @submit="onSubmit"
    >
      <h2 class="text-xl font-semibold text-stone-900">{{ t('inviteGate.heading') }}</h2>
      <p class="mt-2 text-sm text-stone-600">
        {{ t('inviteGate.description') }}
      </p>

      <label for="invite-code" class="mt-5 block text-xs font-medium text-stone-700">
        {{ t('inviteGate.label') }}
      </label>
      <input
        id="invite-code"
        v-model="code"
        data-testid="invite-input"
        type="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :disabled="isSubmitting"
        class="ll-control mt-1 font-mono"
        placeholder="BETA-2026-XXXX"
      />

      <p v-if="errorMessage !== ''" data-testid="invite-error" class="mt-2 text-xs text-danger-700">
        {{ errorMessage }}
      </p>

      <button
        data-testid="invite-submit"
        type="submit"
        class="ll-btn ll-btn-primary ll-btn-full mt-5"
        :disabled="isSubmitting || code.length === 0"
      >
        {{ isSubmitting ? t('inviteGate.checking') : t('common.continue') }}
      </button>
    </form>
  </div>
</template>
