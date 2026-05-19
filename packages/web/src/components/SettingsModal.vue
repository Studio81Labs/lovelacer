<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getHealth } from '../api/client.js'
import { useSettingsStore } from '../stores/settings.js'
import { useI18nStore } from '../stores/i18n.js'
import { applyThemeToDocument } from '../theme.js'
import type { SettingsLanguage, SettingsSections, SettingsTheme, UiLanguage } from '../api/types.js'

const emit = defineEmits<{ close: [] }>()

const store = useSettingsStore()
const { t } = useI18n()
const i18nStore = useI18nStore()
const buildVersion = ref<string | null>(null)
const closeSaveInFlight = ref(false)
const settingsActionDisabled = computed(() => store.phase === 'saving' || closeSaveInFlight.value)
const settingsControlsDisabled = computed(() => closeSaveInFlight.value)

/**
 * P2-9 — capture the active locale at modal open time so we can restore
 * it on Discard without reading localStorage. `useI18nStore.locale`'s
 * setter mirrors every in-modal selection to localStorage for instant
 * feedback; that means by the time the user clicks Discard,
 * `detectInitialLocale()` would read back whichever locale they just
 * picked. The modal owns this session boundary because only it knows
 * what was active before the user started editing.
 */
const preEditLocale = ref(i18nStore.locale)

function onUiLanguageChange(event: Event): void {
  if (settingsControlsDisabled.value) return

  const lang = (event.target as HTMLSelectElement).value as UiLanguage
  store.setUiLanguage(lang)
  i18nStore.locale = lang
}

function onThemeChange(theme: SettingsTheme): void {
  if (settingsControlsDisabled.value) return

  store.setTheme(theme)
  applyThemeToDocument(theme)
}

function onDetectionLanguageChange(event: Event): void {
  if (settingsControlsDisabled.value) return

  store.setLanguage((event.target as HTMLSelectElement).value as SettingsLanguage)
}

function onSectionChange(key: keyof SettingsSections, event: Event): void {
  if (settingsControlsDisabled.value) return

  store.setSection(key, (event.target as HTMLInputElement).checked)
}

function onDiscard(): void {
  if (settingsActionDisabled.value) return

  // Revert the active locale to the pre-edit snapshot, then clear the
  // store's dirtyState. The store no longer reaches into i18n — that
  // separation matters because the store doesn't have a clean session
  // boundary, but the modal does (component setup runs once when the
  // modal opens).
  i18nStore.locale = preEditLocale.value
  store.discardChanges()
  applyThemeToDocument(store.effective.theme)
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

const THEME_OPTIONS: ReadonlyArray<{ value: SettingsTheme; labelKey: string }> = [
  { value: 'system', labelKey: 'settings.theme.option.system' },
  { value: 'light', labelKey: 'settings.theme.option.light' },
  { value: 'dark', labelKey: 'settings.theme.option.dark' },
]

const closeTitle = computed(() =>
  store.hasDashboardAffectingDirty
    ? t('settings.close.titleDirty')
    : t('settings.close.titleClean'),
)

async function requestClose(): Promise<void> {
  // Dirty guard: don't lose edits silently — applies to ALL close gestures
  // (backdrop click, × button, future ESC handler). Dashboard-affecting
  // edits still need the explicit Save/Re-analyze path, while UI-only
  // edits such as theme can persist and close directly.
  if (store.hasDashboardAffectingDirty || closeSaveInFlight.value) return
  if (store.hasDirty) {
    closeSaveInFlight.value = true
    try {
      await store.saveOnly()
    } catch {
      return
    } finally {
      closeSaveInFlight.value = false
    }
    if (store.hasDirty) return
  }
  emit('close')
}

async function onSave(): Promise<void> {
  try {
    if (store.hasDashboardAffectingDirty) {
      await store.saveAndReanalyze()
    } else {
      await store.saveOnly()
    }
    if (!store.hasDirty) {
      emit('close')
    }
  } catch {
    // Store already set phase=error and stashed the ApiError. Modal
    // stays open with dirty state preserved for retry.
  }
}

onMounted(async () => {
  try {
    buildVersion.value = (await getHealth()).version
  } catch {
    buildVersion.value = null
  }
})
</script>

<template>
  <div
    data-testid="settings-modal-backdrop"
    class="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4"
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
          class="ll-btn ll-btn-ghost h-8 w-8 px-0"
          :disabled="store.hasDashboardAffectingDirty || settingsActionDisabled"
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
            class="ll-control mt-1"
            :value="displayUiLanguage"
            :disabled="settingsControlsDisabled"
            @change="onUiLanguageChange"
          >
            <option value="en">{{ t('settings.uiLanguage.option.en') }}</option>
            <option value="cs">{{ t('settings.uiLanguage.option.cs') }}</option>
            <option value="de">{{ t('settings.uiLanguage.option.de') }}</option>
            <option value="es">{{ t('settings.uiLanguage.option.es') }}</option>
            <option value="fr">{{ t('settings.uiLanguage.option.fr') }}</option>
            <option value="it">{{ t('settings.uiLanguage.option.it') }}</option>
            <option value="nl">{{ t('settings.uiLanguage.option.nl') }}</option>
            <option value="pl">{{ t('settings.uiLanguage.option.pl') }}</option>
          </select>
        </div>

        <!-- Theme -->
        <div>
          <p id="settings-theme-label" class="block font-medium text-stone-700">
            {{ t('settings.theme.label') }}
          </p>
          <div
            class="mt-1 grid grid-cols-3 overflow-hidden rounded-[var(--radius-control)] border border-warm-border bg-stone-25 p-1 ll-shadow-control"
            role="radiogroup"
            aria-labelledby="settings-theme-label"
          >
            <button
              v-for="option in THEME_OPTIONS"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="store.effective.theme === option.value"
              :data-testid="`settings-theme-${option.value}`"
              class="h-8 rounded-md px-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-100"
              :disabled="settingsControlsDisabled"
              :class="
                store.effective.theme === option.value
                  ? 'bg-amber-500 text-amber-50 shadow-sm'
                  : 'text-stone-700 hover:bg-warm-surface-hover'
              "
              @click="onThemeChange(option.value)"
            >
              {{ t(option.labelKey) }}
            </button>
          </div>
        </div>

        <!-- Language -->
        <div>
          <label for="settings-language" class="block font-medium text-stone-700">
            {{ t('detectionLanguage.label') }}
          </label>
          <select
            id="settings-language"
            data-testid="settings-language"
            class="ll-control mt-1"
            :value="store.effective.language"
            :disabled="settingsControlsDisabled"
            @change="onDetectionLanguageChange"
          >
            <option value="auto">{{ t('detectionLanguage.option.auto') }}</option>
            <option value="en">{{ t('detectionLanguage.option.en') }}</option>
            <option value="cs">{{ t('detectionLanguage.option.cs') }}</option>
            <option value="de">{{ t('detectionLanguage.option.de') }}</option>
            <option value="es">{{ t('detectionLanguage.option.es') }}</option>
            <option value="fr">{{ t('detectionLanguage.option.fr') }}</option>
            <option value="it">{{ t('detectionLanguage.option.it') }}</option>
            <option value="nl">{{ t('detectionLanguage.option.nl') }}</option>
            <option value="pl">{{ t('detectionLanguage.option.pl') }}</option>
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
            class="ll-control mt-1"
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
        <fieldset :disabled="settingsControlsDisabled">
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
                :disabled="settingsControlsDisabled"
                @change="onSectionChange(key, $event)"
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
          class="ll-btn ll-btn-secondary ll-btn-compact"
          :disabled="settingsActionDisabled"
          @click="onDiscard"
        >
          {{ t('settings.discardChanges') }}
        </button>
        <button
          type="button"
          data-testid="settings-save"
          class="ll-btn ll-btn-primary ll-btn-compact"
          :disabled="!store.hasDirty || settingsActionDisabled"
          @click="onSave"
        >
          {{ t('settings.saveAndReanalyze') }}
        </button>
      </footer>
      <p
        v-if="buildVersion !== null"
        data-testid="settings-build-info"
        class="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-500"
      >
        {{ t('settings.buildInfo', { version: buildVersion }) }}
      </p>
    </div>
  </div>
</template>
