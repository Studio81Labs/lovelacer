<script setup lang="ts">
const works = [
  'Eight-language room detection',
  'Per-entity confidence scoring',
  'Manual overrides that persist across re-runs',
  'Suggestions for fixing HA registry gaps',
  'Diff view before re-applying',
  'YAML export of generated dashboards',
  'Czech-first translations of generated card headings (room headings localize; group labels like "Lights & Outlets" are still English — known issue)',
]

const coming = [
  'AI fallback for low-confidence entities',
  'Mushroom card pack (currently core HA cards only)',
  'Smart Panel export target',
  'Generated dashboard themes',
  'More languages — anything community contributes',
]
</script>

<template>
  <section class="lc-alpha">
    <div class="lc-section lc-section--narrow">
      <p class="lc-eyebrow">Where we are</p>
      <h2 class="lc-display lc-alpha__title">Public alpha. <em>Useful</em> today.</h2>
      <p class="lc-alpha__lede">
        Lovelacer is in the polish phase before its v1 release. The core pipeline — analyze, review,
        apply, suggest — is working on real installs in multiple languages. We're honest about
        what's not done yet.
      </p>

      <div class="lc-alpha__cols">
        <div class="lc-alpha__col">
          <h3 class="lc-alpha__col-title">
            <span class="lc-pill lc-pill--success">Working today</span>
          </h3>
          <ul class="lc-alpha__list">
            <li v-for="w in works" :key="w">{{ w }}</li>
          </ul>
        </div>

        <div class="lc-alpha__col">
          <h3 class="lc-alpha__col-title">
            <span class="lc-pill lc-pill--warning">Coming next</span>
          </h3>
          <ul class="lc-alpha__list">
            <li v-for="c in coming" :key="c">{{ c }}</li>
          </ul>
        </div>
      </div>

      <p class="lc-alpha__cta">
        Bug? Missing language? Confusing behavior?
        <a href="https://github.com/Studio81Labs/lovelacer/issues/new" class="lc-alpha__link"
          >Open an issue</a
        >
        — issues from real users shape what we work on next.
      </p>
    </div>
  </section>
</template>

<style scoped>
.lc-alpha__title {
  font-size: clamp(2rem, 3.5vw, 2.75rem);
  margin: 0 0 1.25rem 0;
}

.lc-alpha__lede {
  font-size: 1.0625rem;
  line-height: 1.65;
  color: var(--vp-c-text-2);
  margin: 0 0 3rem 0;
}

.lc-alpha__cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5rem;
  margin-bottom: 3rem;
}

@media (max-width: 768px) {
  .lc-alpha__cols {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

.lc-alpha__col-title {
  margin: 0 0 1.25rem 0;
}

.lc-alpha__list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.lc-alpha__list li {
  position: relative;
  padding-left: 1.5rem;
  padding-block: 0.5rem;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid var(--vp-c-divider);
}

.lc-alpha__list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 1.1rem;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lc-amber-500);
}
.dark .lc-alpha__list li::before {
  background: var(--lc-amber-300);
}

.lc-alpha__cta {
  padding: 1.5rem 1.75rem;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin: 0;
}

.lc-alpha__link {
  color: var(--lc-amber-500);
  font-weight: 500;
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
}
.dark .lc-alpha__link {
  color: var(--lc-amber-300);
}
</style>
