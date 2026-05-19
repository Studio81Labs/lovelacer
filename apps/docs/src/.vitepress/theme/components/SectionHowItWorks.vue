<script setup lang="ts">
import ThemedScreenshot from './ThemedScreenshot.vue'

const steps = [
  {
    n: '01',
    title: 'Open Lovelacer in your HA sidebar',
    body: "The add-on installs into Home Assistant and shows up as an ingress entry. No separate auth, no port to expose, no tokens to copy. If you're running HA Core without Supervisor, the standalone Docker image takes a long-lived access token instead.",
    screenshotName: 'onboarding-1-language',
    singleSource: false,
    alt: 'Lovelacer first-run onboarding screen asking the user to pick a detection language',
  },
  {
    n: '02',
    title: 'Review the proposed rooms',
    body: "Lovelacer detects rooms from your registry, scores each entity's assignment, and lists them all. Edit a room's icon or name, drag entities between rooms, or hide ones you don't want on the dashboard. The diff at the top tells you what changed since the last apply.",
    screenshotName: 'entity-overrides',
    darkName: 'room-detail',
    singleSource: false,
    alt: 'Per-entity override panel showing each entity in a room with a dropdown to reassign and a hide button',
  },
  {
    n: '03',
    title: 'Apply and look at it in HA',
    body: "Apply writes a new dashboard via HA's storage API — your existing dashboards are untouched. Open the new one from the sidebar and decide whether to keep it as default, take elements from it into your own dashboard, or ignore it. Lovelacer never overwrites anything you didn't generate with it.",
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
            <p class="lc-how__step-body">{{ step.body }}</p>
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
