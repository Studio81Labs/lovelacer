<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings.js'
import { useI18nStore } from '../stores/i18n.js'
import type { SettingsLanguage, SettingsSections, UiLanguage } from '../api/types.js'

const emit = defineEmits<{ close: [] }>()

const store = useSettingsStore()
const { t } = useI18n()
const i18nStore = useI18nStore()

function onUiLanguageChange(event: Event): void {
  const lang = (event.target as HTMLSelectElement).value as UiLanguage
  store.setUiLanguage(lang)
  i18nStore.locale = lang
}

/**
 * P2-9 — `Settings.uiLanguage` is OPTIONAL on the wire: when the user has
 * never explicitly chosen a UI language, the field is undefined. The
 * <select> needs a defined value or the option dropdown shows nothing
 * selected. Fall back to the active i18n locale (which `detectInitialLocale`
 * picked from browser language / cache) so the picker reflects what the
 * user is actually seeing right now.
 */
const displayUiLanguage = computed<UiLanguage>(() => store.effective.uiLanguage ?? i18nStore.locale)

const SECTION_KEYS: ReadonlyArray<keyof SettingsSections> = [
  'welcome',
  'quickStats',
  'people',
  'roomsByFloor',
  'activeRooms',
  'scenes',
  'cameras',
]

const SECTION_LABEL_KEYS: Record<keyof SettingsSections, string> = {
  welcome: 'settings.sections.welcome',
  quickStats: 'settings.sections.quickStats',
  people: 'settings.sections.people',
  roomsByFloor: 'settings.sections.roomsByFloor',
  activeRooms: 'settings.sections.activeRooms',
  scenes: 'settings.sections.scenes',
  cameras: 'settings.sections.cameras',
}

const closeTitle = computed(() =>
  store.hasDirty ? t('settings.close.titleDirty') : t('settings.close.titleClean'),
)

function requestClose(): void {
  // Dirty guard: don't lose edits silently — applies to ALL close gestures
  // (backdrop click, × button, future ESC handler). User must Discard or
  // Save before any close path emits.
  if (store.hasDirty) return
  emit('close')
}

async function onSave(): Promise<void> {
  try {
    await store.saveAndReanalyze()
    emit('close')
  } catch {
    // Store already set phase=error and stashed the ApiError. Modal
    // stays open with dirty state preserved for retry.
  }
}
</script>

<template>
  <div
    data-testid="settings-modal-backdrop"
    class="fixed inset-0 z-40 flex items-start justify-center bg-stone-900/40 p-4"
    @click="requestClose"
  >
    <div
      data-testid="settings-modal"
      class="mt-20 w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
      @click.stop
    >
      <header class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-medium text-stone-900">{{ t('settings.heading') }}</h2>
        <button
          data-testid="settings-close"
          :aria-label="t('settings.close.aria')"
          class="text-stone-500 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="store.hasDirty"
          :title="closeTitle"
          @click="requestClose"
        >
          ×
        </button>
      </header>

      <section class="space-y-5 text-sm">
        <!-- UI display language -->
        <div>
          <label for="settings-ui-language" class="block text-sm font-medium text-stone-700">
            {{ t('settings.uiLanguage.label') }}
          </label>
          <select
            id="settings-ui-language"
            data-testid="settings-ui-language"
            class="mt-1 w-full rounded border border-stone-300 px-2 py-1.5"
            :value="displayUiLanguage"
            @change="onUiLanguageChange"
          >
            <option value="en">{{ t('settings.uiLanguage.option.en') }}</option>
            <option value="cs">{{ t('settings.uiLanguage.option.cs') }}</option>
            <option value="de">{{ t('settings.uiLanguage.option.de') }}</option>
          </select>
        </div>

        <!-- Language -->
        <div>
          <label for="settings-language" class="block font-medium text-stone-700">
            {{ t('detectionLanguage.label') }}
          </label>
          <select
            id="settings-language"
            data-testid="settings-language"
            class="mt-1 w-full rounded border border-stone-300 px-2 py-1.5"
            :value="store.effective.language"
            @change="
              store.setLanguage(($event.target as HTMLSelectElement).value as SettingsLanguage)
            "
          >
            <option value="auto">{{ t('detectionLanguage.option.auto') }}</option>
            <option value="en">{{ t('detectionLanguage.option.en') }}</option>
            <option value="cs">{{ t('detectionLanguage.option.cs') }}</option>
          </select>
          <p class="mt-1 text-xs text-stone-500">
            {{ t('settings.detectionLanguage.help') }}
          </p>
        </div>

        <!-- Card pack -->
        <div>
          <label for="settings-card-pack" class="block font-medium text-stone-700">
            {{ t('settings.cardPack.label') }}
          </label>
          <select
            id="settings-card-pack"
            data-testid="settings-card-pack"
            class="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 disabled:opacity-50"
            :value="store.effective.cardPack"
            disabled
          >
            <option value="default">{{ t('settings.cardPack.option.default') }}</option>
          </select>
          <p class="mt-1 text-xs text-stone-500">
            {{ t('settings.cardPack.morePacksComingSoon') }}
          </p>
        </div>

        <!-- Sections -->
        <fieldset>
          <legend class="font-medium text-stone-700">{{ t('settings.sections.label') }}</legend>
          <div class="mt-1 space-y-1.5">
            <label
              v-for="key in SECTION_KEYS"
              :key="key"
              class="flex items-center gap-2 text-stone-700"
            >
              <input
                type="checkbox"
                :data-testid="`settings-section-${key}`"
                :checked="store.effective.sections[key]"
                @change="store.setSection(key, ($event.target as HTMLInputElement).checked)"
              />
              <span>{{ t(SECTION_LABEL_KEYS[key]) }}</span>
            </label>
          </div>
        </fieldset>

        <!-- Error banner -->
        <p
          v-if="store.phase === 'error' && store.error !== null"
          data-testid="settings-error"
          class="rounded bg-danger-50 px-3 py-2 text-xs text-danger-700"
        >
          {{ store.error.message }}
        </p>
      </section>

      <footer class="mt-5 flex justify-end gap-2">
        <button
          v-if="store.hasDirty"
          type="button"
          data-testid="settings-discard"
          class="rounded border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-50"
          @click="store.discardChanges"
        >
          {{ t('settings.discardChanges') }}
        </button>
        <button
          type="button"
          data-testid="settings-save"
          class="rounded bg-amber-500 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!store.hasDirty || store.phase === 'saving'"
          @click="onSave"
        >
          {{ t('settings.saveAndReanalyze') }}
        </button>
      </footer>
    </div>
  </div>
</template>
