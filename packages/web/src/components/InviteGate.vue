<script setup lang="ts">
import { ref, computed } from 'vue'
import { useInviteStore } from '../stores/invite.js'

const invite = useInviteStore()
const code = ref('')

const isSubmitting = computed(() => invite.phase === 'submitting')

const errorMessage = computed(() => {
  if (invite.phase !== 'error' || invite.error === null) return ''
  if (invite.error.error === 'invalid_code') {
    return "That invite code wasn't recognized. Double-check the code or contact the project owner."
  }
  if (invite.error.error === 'invalid_body') return 'Please enter your invite code.'
  if (invite.error.error === 'network') return 'Could not reach the server. Try again in a moment.'
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
      <h2 class="text-xl font-semibold text-stone-900">Welcome to Lovelacer</h2>
      <p class="mt-2 text-sm text-stone-600">
        Lovelacer is in closed beta. Enter your invite code to continue.
      </p>

      <label for="invite-code" class="mt-5 block text-xs font-medium text-stone-700">
        Invite code
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
        class="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
        placeholder="BETA-2026-XXXX"
      />

      <p v-if="errorMessage !== ''" data-testid="invite-error" class="mt-2 text-xs text-danger-700">
        {{ errorMessage }}
      </p>

      <button
        data-testid="invite-submit"
        type="submit"
        class="mt-5 w-full rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isSubmitting || code.length === 0"
      >
        {{ isSubmitting ? 'Checking…' : 'Continue' }}
      </button>
    </form>
  </div>
</template>
