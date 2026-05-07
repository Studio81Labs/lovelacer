<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import HealthBar from './components/HealthBar.vue'
import AnalyzeButton from './components/AnalyzeButton.vue'
import RoomList from './components/RoomList.vue'
import MiscBucket from './components/MiscBucket.vue'
import OverridesBar from './components/OverridesBar.vue'
import DashboardPreview from './components/DashboardPreview.vue'
import ApplyBar from './components/ApplyBar.vue'
import InviteGate from './components/InviteGate.vue'
import OnboardingWizard from './components/OnboardingWizard.vue'
import DiffBanner from './components/DiffBanner.vue'
import RemovedEntitiesPanel from './components/RemovedEntitiesPanel.vue'
import SuggestionsPanel from './components/SuggestionsPanel.vue'
import SettingsModal from './components/SettingsModal.vue'
import { useAnalyzeStore } from './stores/analyze.js'
import { useOverridesStore } from './stores/overrides.js'
import { useInviteStore } from './stores/invite.js'
import { useSuggestionsStore } from './stores/suggestions.js'
import { useSettingsStore } from './stores/settings.js'
import { useOnboardingStore } from './stores/onboarding.js'
import { useI18nStore } from './stores/i18n.js'
import type { EntityDiff, RoomDiffSummary } from './api/types.js'

const { t } = useI18n()
const analyze = useAnalyzeStore()
const overrides = useOverridesStore()
const invite = useInviteStore()
const suggestions = useSuggestionsStore()
const settings = useSettingsStore()
const onboarding = useOnboardingStore()
const i18n = useI18nStore()
const settingsOpen = ref(false)

// P2-9 — post-load reconciliation watcher. When the settings store
// resolves `loadFromServer()`, sync `settings.serverState.uiLanguage`
// into the active i18n locale — but ONLY if the user has not explicitly
// changed the locale during the load window (current === initialLocale).
//
// `Settings.uiLanguage` is OPTIONAL on the wire: it's only set when the
// user has explicitly picked a UI language via the Settings modal. On
// fresh installs the field is undefined, so `next` is undefined and the
// watcher skips — whatever locale `detectInitialLocale()` picked
// (browser language → 'en' fallback) wins. When set, it represents a
// real user choice from another device and gets synced (cross-device
// sync via single device tap on Device A → Device B).
//
// Per spec §4: "if the user changes UI language before settings load
// completes, the user's choice is preserved." The `i18n.locale === initialLocale`
// guard implements that contract — once the user clicks the picker
// during the loadFromServer in-flight window, the watcher refuses to
// overwrite their pick.
//
// The setter on `useI18nStore.locale` mirrors writes to localStorage
// too, so the next first paint reads the synced value with no flash.
const initialLocale = i18n.locale

watch(
  () => settings.serverState?.uiLanguage,
  (next) => {
    if (next && next !== i18n.locale && i18n.locale === initialLocale) {
      i18n.locale = next
    }
  },
)

// Brand asset URL — ingress-relative via Vite's BASE_URL so the path
// resolves under HA Supervisor's `/api/hassio_ingress/<token>/` mount
// (an absolute `/brand/...` would resolve against the HA host root and
// 404). Same pattern as the API client's document-relative endpoints.
const markUrl = `${import.meta.env.BASE_URL}brand/lovelacer-mark.svg`

// Local wizard-mount state, decoupled from onboarding.completedAt so
// the wizard's DoneStep stays visible after apply success (which flips
// completedAt to a number) until the user clicks Continue/Skip.
const wizardOpen = ref(false)

// Open the wizard when we know we should: invite accepted + onboarding
// not yet completed. Once opened, wizardOpen stays true until the
// wizard emits close.
watch(
  [() => invite.accepted, () => onboarding.shouldShowWizard],
  ([accepted, shouldShow]) => {
    if (accepted === true && shouldShow && !wizardOpen.value) {
      wizardOpen.value = true
    }
  },
  { immediate: true },
)

// Single source of truth for when onboarding status loads: only after
// invite is accepted (so /api/onboarding doesn't 403 against the gate).
// `immediate: true` handles the existing-install case where invite is
// already accepted at mount; the conditional skips the no-op pre-mount
// firing where `accepted === undefined`.
//
// `flush: 'pre'` is critical for the fresh-install path: when invite
// flips from false to true, the loadStatus call must land its
// synchronous `phase = 'loading'` mutation BEFORE the next render —
// otherwise `onboarding.isResolved` could still be true from a stale
// state and `showMainView` would briefly evaluate true between
// invite acceptance and wizard mount, flashing the main view.
watch(
  () => invite.accepted,
  (accepted) => {
    if (accepted === true && onboarding.completedAt === undefined) {
      void onboarding.loadStatus()
    }
  },
  { immediate: true, flush: 'pre' },
)

async function openSettings(): Promise<void> {
  // Await the load BEFORE opening so the user can't edit dirtyState mid-fetch
  // and have their edits silently wiped when loadFromServer's `dirtyState = null`
  // line resolves. The GET is sub-second; the brief delay is acceptable UX.
  await settings.loadFromServer()
  settingsOpen.value = true
}

const diffByRoom = computed<Record<string, RoomDiffSummary>>(
  () => analyze.preview?.diff?.perRoom ?? {},
)

const diffByEntityId = computed<Map<string, EntityDiff>>(() => {
  const map = new Map<string, EntityDiff>()
  const entities = analyze.preview?.diff?.entities ?? []
  for (const e of entities) map.set(e.entityId, e)
  return map
})

const showWizard = computed(() => invite.accepted === true && wizardOpen.value)
// `onboarding.isResolved` flips true on successful load OR error — failing
// open into the main view if the status endpoint errors. The pre-resolution
// `false` state continues to suppress the first-paint flash.
const showMainView = computed(
  () => invite.accepted === true && !wizardOpen.value && onboarding.isResolved,
)

onMounted(() => {
  void invite.loadStatus()
  // P2-9 — kick off settings load so the cross-device reconciliation
  // watcher above has a serverState.uiLanguage to react to. Previously
  // this fired only inside openSettings() (Settings modal open), so a
  // fresh device with empty localStorage would never pick up the choice
  // the user made on a different device until they opened Settings.
  void settings.loadFromServer()
  // Onboarding status loads via the watch on `invite.accepted` below
  // (single source of truth) — firing it here would race the invite
  // load and 403 on a fresh install.
})

let loadedOnce = false
watch(
  () => analyze.phase,
  (phase) => {
    if (phase === 'ready' && !loadedOnce) {
      loadedOnce = true
      void overrides.loadFromServer()
    }
  },
)

// On every fresh preview, clear the optimistic-dismissed set so the
// authoritative server response in `analyze.preview.suggestions[]`
// drives what's visible. Dismissed-on-server keys are filtered there;
// if the user cleared a dismissal out-of-band, it'll re-appear.
watch(
  () => analyze.preview,
  () => {
    suggestions.reset()
  },
)
</script>

<template>
  <main v-if="showMainView" class="mx-auto max-w-3xl space-y-6 p-8">
    <header class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <img :src="markUrl" alt="" class="h-10 w-10" aria-hidden="true" />
        <div>
          <h1 class="lovelacer-wordmark text-3xl leading-none">lovelace<i>r</i></h1>
          <p class="mt-1 text-sm text-stone-500">
            {{ t('app.tagline') }}
          </p>
        </div>
      </div>
      <button
        type="button"
        data-testid="settings-button"
        :aria-label="t('common.settings')"
        class="rounded p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        @click="openSettings"
      >
        ⚙
      </button>
    </header>

    <HealthBar />

    <section class="flex justify-center">
      <AnalyzeButton />
    </section>

    <section
      v-if="analyze.phase === 'error' && analyze.error !== null"
      class="rounded-lg bg-danger-50 px-5 py-3 text-sm text-danger-700"
    >
      <div class="flex items-center justify-between">
        <span>{{ analyze.error.message }}</span>
        <button
          type="button"
          class="rounded bg-danger-700 px-3 py-1 text-xs font-medium text-white hover:bg-danger-900"
          @click="analyze.analyze()"
        >
          {{ t('common.retry') }}
        </button>
      </div>
    </section>

    <section v-if="analyze.phase === 'ready' && analyze.preview !== null" class="space-y-4">
      <DiffBanner :diff="analyze.preview.diff" />
      <RemovedEntitiesPanel
        v-if="analyze.preview.diff !== null && analyze.preview.diff.totals.removed > 0"
        :diff="analyze.preview.diff"
      />
      <SuggestionsPanel :suggestions="analyze.preview.suggestions" />
      <RoomList
        :rooms="analyze.preview.rooms"
        :diff-by-room="diffByRoom"
        :diff-by-entity-id="diffByEntityId"
      />
      <MiscBucket :misc="analyze.preview.misc" />
      <OverridesBar />
      <DashboardPreview :config="analyze.preview.config" />
      <ApplyBar />
    </section>
  </main>

  <OnboardingWizard v-else-if="showWizard" @close="wizardOpen = false" />

  <SettingsModal v-if="settingsOpen" @close="settingsOpen = false" />
  <InviteGate v-if="invite.shouldShowGate" />
</template>
