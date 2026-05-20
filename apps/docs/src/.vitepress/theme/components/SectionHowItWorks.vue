<script setup lang="ts">
import ThemedScreenshot from './ThemedScreenshot.vue'

const steps = [
  {
    n: '01',
    title: 'Open Lovelacer from your Home Assistant sidebar',
    body: [
      'Lovelacer installs as a Home Assistant add-on and opens directly inside HA. No separate login, no exposed ports, no external service required.',
      'Standalone Docker support is available for Home Assistant Core users.',
    ],
    screenshotName: 'onboarding-1-language',
    singleSource: false,
    alt: 'Lovelacer first-run onboarding screen asking the user to pick a detection language',
  },
  {
    n: '02',
    title: 'Review the proposed rooms',
    body: [
      "Lovelacer groups entities by room, scores uncertain matches, and lets you review everything before applying. Rename rooms, change icons, move entities, or hide things you don't want on the dashboard.",
    ],
    screenshotName: 'entity-overrides',
    darkName: 'room-detail',
    singleSource: false,
    alt: 'Per-entity override panel showing each entity in a room with a dropdown to reassign and a hide button',
  },
  {
    n: '03',
    title: 'Apply and open it in Home Assistant',
    body: [
      'Lovelacer creates a separate dashboard using Home Assistant’s native storage mode. Your existing dashboards stay untouched, and nothing is overwritten unless Lovelacer created it originally.',
    ],
    screenshotName: 'ha-jidelna',
    singleSource: false,
    alt: 'The applied dashboard in HA, showing the Jídelna view with Lights, Climate, and Other sections',
  },
]
</script>

<template>
  <section id="how-it-works" class="lc-how">
    <div class="lc-section">
      <header class="lc-how__head">
        <p class="lc-eyebrow">How it works</p>
        <h2 class="lc-display lc-how__title">Three steps. <em>Reversible</em> at every one.</h2>
      </header>

      <ol class="lc-how__steps">
        <li v-for="step in steps" :key="step.n" class="lc-how__step">
          <div class="lc-how__step-text">
            <div class="lc-how__step-num">{{ step.n }}</div>
            <h3 class="lc-how__step-title">{{ step.title }}</h3>
            <p v-for="paragraph in step.body" :key="paragraph" class="lc-how__step-body">
              {{ paragraph }}
            </p>
          </div>
          <figure class="lc-how__step-visual">
            <ThemedScreenshot
              :name="step.screenshotName"
              :dark-name="step.darkName"
              :single-source="step.singleSource"
              :alt="step.alt"
            />
          </figure>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.lc-how__head {
  max-width: 720px;
  margin-bottom: 3.5rem;
}

.lc-how__title {
  font-size: clamp(2rem, 3.5vw, 2.75rem);
  margin: 0;
}

.lc-how__steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.lc-how__step {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 3rem;
  align-items: start;
}

@media (max-width: 880px) {
  .lc-how__step {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}

.lc-how__step-num {
  font-family: var(--lc-font-mono);
  font-size: 0.875rem;
  color: var(--lc-amber-700);
  margin-bottom: 1rem;
  letter-spacing: 0.05em;
}
.dark .lc-how__step-num {
  color: var(--lc-amber-300);
}

.lc-how__step-title {
  font-family: var(--lc-font-sans);
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.25;
  margin: 0 0 1rem 0;
  color: var(--vp-c-text-1);
}

.lc-how__step-body {
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--vp-c-text-2);
  margin: 0;
}

.lc-how__step-body + .lc-how__step-body {
  margin-top: 0.875rem;
}

.lc-how__step-visual {
  margin: 0;
  position: sticky;
  top: 80px;
}

@media (max-width: 880px) {
  .lc-how__step-visual {
    position: static;
  }
}
</style>
