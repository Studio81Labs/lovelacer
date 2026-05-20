<script setup lang="ts">
const items = [
  {
    title: 'Eight languages out of the box',
    body: 'Room detection works across English, Czech, German, Spanish, French, Italian, Polish, and Dutch. Lovelacer recognizes localized room names and falls back gracefully when integrations use inconsistent naming.',
  },
  {
    title: 'Confidence scoring on every assignment',
    body: 'Every placement includes a confidence score and the signals behind it — Home Assistant areas, device metadata, friendly names, and entity IDs. When something looks wrong, you can immediately see why.',
  },
  {
    title: 'Suggestions for fixing entity chaos at the source',
    body: 'If Lovelacer confidently identifies a room but Home Assistant still has no area assigned, it suggests fixing the underlying configuration instead of repeatedly guessing around it.',
  },
  {
    title: 'Diff before apply, never destructive',
    body: 'Re-running analysis shows additions, removals, and moved entities before anything changes. Lovelacer creates a separate dashboard and never overwrites your existing views.',
  },
  {
    title: 'AI is optional, not the product',
    body: 'The base product is fully local and heuristic-driven. Future AI-assisted features remain opt-in and support local Ollama models for users who prefer keeping everything inside their network.',
  },
  {
    title: 'Standalone Docker support',
    body: 'Lovelacer runs as a Home Assistant add-on by default, but the same image also works standalone for Home Assistant Core and Container users.',
  },
]
</script>

<template>
  <section class="lc-hard">
    <div class="lc-section">
      <header class="lc-hard__head">
        <p class="lc-eyebrow">The hard parts</p>
        <h2 class="lc-display lc-hard__title">
          Worth pointing out the parts most "dashboard generators" <em>skip</em>.
        </h2>
      </header>

      <ul class="lc-hard__grid">
        <li v-for="item in items" :key="item.title" class="lc-hard__item">
          <h3 class="lc-hard__item-title">{{ item.title }}</h3>
          <p class="lc-hard__item-body">{{ item.body }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.lc-hard {
  background: var(--vp-c-bg-soft);
}

.lc-hard__head {
  max-width: 800px;
  margin-bottom: 3.5rem;
}

.lc-hard__title {
  font-size: clamp(2rem, 3.5vw, 2.75rem);
  margin: 0;
}

.lc-hard__grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  border-top: 1px solid var(--vp-c-divider);
}

@media (max-width: 768px) {
  .lc-hard__grid {
    grid-template-columns: 1fr;
  }
}

.lc-hard__item {
  padding: 2rem 1.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
  border-right: 1px solid var(--vp-c-divider);
}

.lc-hard__item:nth-child(2n) {
  border-right: none;
}

@media (max-width: 768px) {
  .lc-hard__item {
    border-right: none;
  }
}

.lc-hard__item-title {
  font-family: var(--lc-font-sans);
  font-size: 1.0625rem;
  font-weight: 600;
  margin: 0 0 0.625rem 0;
  color: var(--vp-c-text-1);
}

.lc-hard__item-body {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin: 0;
}
</style>
