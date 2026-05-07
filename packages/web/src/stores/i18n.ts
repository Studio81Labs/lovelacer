import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiLocale } from '../i18n/index.js'

/**
 * P2-9 — Pinia layer wrapping vue-i18n's reactive locale ref.
 *
 * Setter mirrors writes to localStorage so the next first paint reads
 * the user's last choice (instant — no async fetch). Server-side
 * persistence happens via Settings.uiLanguage's normal save flow;
 * a watcher in the settings store reconciles after server load.
 */
export const useI18nStore = defineStore('i18n', () => {
  const i18n = useI18n()
  const locale = computed<UiLocale>({
    get: () => i18n.locale.value as UiLocale,
    set: (next) => {
      i18n.locale.value = next
      try {
        localStorage.setItem('lovelacer.uiLocale', next)
      } catch {
        // localStorage unavailable — server persistence is the fallback.
      }
    },
  })
  return { locale }
})
