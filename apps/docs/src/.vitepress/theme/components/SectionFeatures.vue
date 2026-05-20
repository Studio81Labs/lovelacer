<script setup lang="ts">
import ThemedScreenshot from './ThemedScreenshot.vue'

const features = [
  {
    title: 'Rooms detected from your Home Assistant setup',
    body: 'Lovelacer uses Home Assistant areas when available, then falls back to room-name detection for entities that were never properly assigned. Every placement includes a confidence score, so you can review uncertain matches before applying.',
    screenshotName: 'room-list',
    darkName: 'room-list-applied',
    alt: 'Lovelacer room list showing 13 rooms detected from a Czech HA install, each with entity count and confidence percentage',
  },
  {
    title: 'Preview every change before you apply',
    body: 'Re-running analysis shows what changed: new entities, moved entities, and removed entities. Nothing is written to your dashboard until you click Apply.',
    screenshotName: 'room-list-applied',
    alt: 'Room list view after applying with a success banner at the bottom',
  },
  {
    title: 'Suggestions for fixing entity chaos at the source',
    body: 'When Lovelacer can confidently place an entity but Home Assistant still has no room assigned, it suggests fixing the underlying area configuration. Cleaner entities lead to cleaner dashboards over time.',
    screenshotName: 'suggestions',
    alt: 'Suggestions panel showing five entities with detected rooms but missing area_id, each with an "Open HA settings" button',
  },
]
</script>

<template>
  <section class="lc-features">
    <div class="lc-section">
      <header class="lc-features__head">
        <p class="lc-eyebrow">What you get</p>
        <h2 class="lc-display lc-features__title">
          A useful starting dashboard. <em>And</em> the tools to keep it that way.
        </h2>
      </header>

      <div class="lc-features__list">
        <article v-for="(f, i) in features" :key="f.title" class="lc-features__row">
          <div class="lc-features__text">
            <div class="lc-features__num">{{ String(i + 1).padStart(2, '0') }}</div>
            <h3 class="lc-features__row-title">{{ f.title }}</h3>
            <p class="lc-features__row-body">{{ f.body }}</p>
          </div>
          <figure class="lc-features__visual">
            <ThemedScreenshot :name="f.screenshotName" :dark-name="f.darkName" :alt="f.alt" />
          </figure>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lc-features {
  background: var(--vp-c-bg-soft);
}

.lc-features__head {
  max-width: 720px;
  margin-bottom: 4rem;
}

.lc-features__title {
  font-size: clamp(2rem, 3.5vw, 2.75rem);
  margin: 0;
}

.lc-features__list {
  display: flex;
  flex-direction: column;
  gap: 5rem;
}

.lc-features__row {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 4rem;
  align-items: center;
}

.lc-features__row:nth-child(even) {
  direction: rtl;
}
.lc-features__row:nth-child(even) > * {
  direction: ltr;
}

@media (max-width: 880px) {
  .lc-features__row,
  .lc-features__row:nth-child(even) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    direction: ltr;
  }
}

.lc-features__num {
  font-family: var(--lc-font-display);
  font-size: 1.75rem;
  color: var(--lc-amber-500);
  font-style: italic;
  margin-bottom: 1rem;
}
.dark .lc-features__num {
  color: var(--lc-amber-300);
}

.lc-features__row-title {
  font-family: var(--lc-font-sans);
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.25;
  margin: 0 0 1rem 0;
  color: var(--vp-c-text-1);
}

.lc-features__row-body {
  font-size: 1rem;
  line-height: 1.65;
  color: var(--vp-c-text-2);
  margin: 0;
}

.lc-features__visual {
  margin: 0;
}
</style>
