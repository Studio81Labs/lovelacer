<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'

const analyticsScriptId = 'lovelacer-umami-script'
const analyticsScriptSrc = 'https://analytics.studio81.cz/script.js'
const analyticsWebsiteId = 'b40619ec-1753-454b-861d-0be814164c51'
const consentStorageKey = 'lovelacer.analyticsConsent'

type AnalyticsConsent = 'accepted' | 'declined'

const mounted = ref(false)
const consent = ref<AnalyticsConsent | null>(null)
const isPanelOpen = ref(false)
const hasFooterTarget = ref(false)
const route = useRoute()

const hasChoice = computed(() => consent.value !== null)

const footerButtonLabel = computed(() =>
  consent.value === 'accepted' ? 'Analytics preferences' : 'Cookie preferences',
)

const readStoredConsent = (): AnalyticsConsent | null => {
  const storedConsent = window.localStorage.getItem(consentStorageKey)

  if (storedConsent === 'accepted' || storedConsent === 'declined') {
    return storedConsent
  }

  return null
}

const writeStoredConsent = (value: AnalyticsConsent): void => {
  window.localStorage.setItem(consentStorageKey, value)
}

const loadAnalytics = (): void => {
  if (document.getElementById(analyticsScriptId)) {
    return
  }

  const script = document.createElement('script')
  script.id = analyticsScriptId
  script.defer = true
  script.src = analyticsScriptSrc
  script.dataset.websiteId = analyticsWebsiteId

  document.head.appendChild(script)
}

const unloadAnalytics = (): void => {
  document.getElementById(analyticsScriptId)?.remove()
  delete (window as Window & { umami?: unknown }).umami
}

const acceptAnalytics = (): void => {
  consent.value = 'accepted'
  writeStoredConsent('accepted')
  loadAnalytics()
  isPanelOpen.value = false
}

const declineAnalytics = (): void => {
  const shouldReload = consent.value === 'accepted'

  consent.value = 'declined'
  writeStoredConsent('declined')
  unloadAnalytics()
  isPanelOpen.value = false

  if (shouldReload) {
    window.location.reload()
  }
}

const openPreferences = (event?: Event): void => {
  event?.preventDefault()
  isPanelOpen.value = true
}

const refreshFooterTarget = async (): Promise<void> => {
  await nextTick()
  hasFooterTarget.value = Boolean(document.querySelector('.VPFooter .message'))
}

onMounted(async () => {
  mounted.value = true
  consent.value = readStoredConsent()
  isPanelOpen.value = consent.value === null

  if (consent.value === 'accepted') {
    loadAnalytics()
  }

  await refreshFooterTarget()
})

watch(
  () => route.path,
  () => {
    void refreshFooterTarget()
  },
  { flush: 'post' },
)
</script>

<template>
  <Teleport v-if="mounted && hasFooterTarget" to=".VPFooter .message">
    <span class="lc-cookie-footer-separator" aria-hidden="true"> · </span>
    <button class="lc-cookie-footer-link" type="button" @click="openPreferences">
      {{ footerButtonLabel }}
    </button>
  </Teleport>

  <Teleport v-if="mounted" to="body">
    <button
      v-if="!hasFooterTarget && !isPanelOpen"
      class="lc-cookie-floating-link"
      type="button"
      @click="openPreferences"
    >
      {{ footerButtonLabel }}
    </button>

    <section
      v-if="isPanelOpen"
      class="lc-cookie-bar"
      aria-label="Cookie preferences"
      aria-live="polite"
    >
      <div class="lc-cookie-bar__copy">
        <p class="lc-cookie-bar__title">Cookie preferences</p>
        <p>
          Lovelacer uses optional Umami analytics to understand which docs help people most. The
          script loads only if you allow it.
        </p>
      </div>
      <div class="lc-cookie-bar__actions">
        <button
          class="lc-cookie-bar__button lc-cookie-bar__button--ghost"
          type="button"
          @click="declineAnalytics"
        >
          {{ hasChoice ? 'Turn off' : 'Decline' }}
        </button>
        <button
          class="lc-cookie-bar__button lc-cookie-bar__button--primary"
          type="button"
          @click="acceptAnalytics"
        >
          Allow analytics
        </button>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.lc-cookie-footer-separator {
  color: var(--vp-c-text-3);
}

.lc-cookie-footer-link {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vp-c-brand-1);
  font: inherit;
  cursor: pointer;
}

.lc-cookie-footer-link:hover {
  color: var(--vp-c-brand-2);
}

.lc-cookie-floating-link {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 99;
  appearance: none;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  box-shadow: 0 10px 32px rgba(44, 44, 42, 0.12);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
}

.lc-cookie-floating-link:hover {
  color: var(--vp-c-brand-2);
  transform: translateY(-1px);
}

.dark .lc-cookie-floating-link {
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.28);
}

.lc-cookie-bar {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  left: 1rem;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: min(680px, calc(100vw - 2rem));
  margin-left: auto;
  padding: 1rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  box-shadow: 0 16px 48px rgba(44, 44, 42, 0.16);
}

.dark .lc-cookie-bar {
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.34);
}

.lc-cookie-bar__copy {
  min-width: 0;
}

.lc-cookie-bar__title {
  margin: 0 0 0.25rem;
  color: var(--vp-c-text-1);
  font-weight: 600;
}

.lc-cookie-bar p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  line-height: 1.5;
}

.lc-cookie-bar__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
}

.lc-cookie-bar__button {
  min-height: 2.25rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
}

.lc-cookie-bar__button--ghost {
  border-color: var(--vp-c-border);
  background: transparent;
  color: var(--vp-c-text-1);
}

.lc-cookie-bar__button--primary {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: #ffffff;
}

.lc-cookie-bar__button:hover {
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .lc-cookie-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .lc-cookie-bar__actions {
    justify-content: flex-end;
  }
}
</style>
