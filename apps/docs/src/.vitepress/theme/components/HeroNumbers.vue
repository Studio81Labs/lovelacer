<script setup lang="ts">
interface Props {
  variant?: 'hero' | 'section'
}
const props = withDefaults(defineProps<Props>(), { variant: 'hero' })

const stats = [
  { value: '2,000+', label: 'entities reviewed' },
  { value: '13', label: 'organized rooms' },
  { value: '89%', label: 'high-confidence assignments' },
  { value: '< 5 min', label: 'from install to applied dashboard' },
]
</script>

<template>
  <section :class="['lc-numbers', `lc-numbers--${props.variant}`]">
    <div class="lc-section">
      <div v-if="props.variant === 'hero'" class="lc-numbers__head">
        <p class="lc-eyebrow">Numbers from a real install</p>
        <h1 class="lc-display lc-numbers__title">
          From <em>2,000+ entities</em> to 13 organized rooms — in under five minutes.
        </h1>
        <p class="lc-numbers__lede">
          Lovelacer reads your HA registry, infers rooms from areas, devices, and naming patterns,
          and builds a per-room Lovelace dashboard you can preview before applying. No YAML.
        </p>
        <div class="lc-cta-row" style="margin-top: 2rem">
          <a class="lc-btn lc-btn--primary" href="/docs/install/supervised"
            >Install on Home Assistant</a
          >
          <a class="lc-btn lc-btn--ghost" href="#how-it-works">How it works</a>
        </div>
      </div>

      <div v-else class="lc-numbers__head">
        <p class="lc-eyebrow">By the numbers</p>
        <h2 class="lc-display lc-numbers__title lc-numbers__title--section">
          One install. <em>One run.</em>
        </h2>
      </div>

      <div class="lc-numbers__grid">
        <div v-for="s in stats" :key="s.label" class="lc-numbers__stat">
          <div class="lc-numbers__value">{{ s.value }}</div>
          <div class="lc-numbers__label">{{ s.label }}</div>
        </div>
      </div>

      <p class="lc-numbers__footnote">
        Based on a real Home Assistant install with multiple integrations and years of accumulated
        entities. Your results depend on how clean your existing setup already is.
      </p>
    </div>
  </section>
</template>

<style scoped>
.lc-numbers--hero {
  padding-top: 1rem;
}

.lc-numbers__head {
  max-width: 760px;
  margin-bottom: 3.5rem;
}

.lc-numbers__title {
  font-size: clamp(2.5rem, 5vw, 4rem);
  margin-bottom: 1.5rem;
}

.lc-numbers__title--section {
  font-size: clamp(2rem, 3.5vw, 2.75rem);
  margin-bottom: 0;
}

.lc-numbers__lede {
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  max-width: 640px;
}

.lc-numbers__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .lc-numbers__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.lc-numbers__stat {
  padding: 1.75rem 0;
  border-top: 1px solid var(--vp-c-divider);
}

.lc-numbers__value {
  font-family: var(--lc-font-display);
  font-size: clamp(2.5rem, 4vw, 3.5rem);
  font-weight: 400;
  line-height: 1;
  color: var(--lc-amber-500);
  letter-spacing: -0.02em;
}
.dark .lc-numbers__value {
  color: var(--lc-amber-300);
}

.lc-numbers__label {
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
  margin-top: 0.5rem;
}

.lc-numbers__footnote {
  margin-top: 2.5rem;
  font-size: 0.875rem;
  color: var(--vp-c-text-3);
  max-width: 640px;
  line-height: 1.55;
}
</style>
