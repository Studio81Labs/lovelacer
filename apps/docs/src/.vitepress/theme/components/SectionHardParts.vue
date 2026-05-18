<script setup lang="ts">
const items = [
  {
    title: 'Eight languages out of the box',
    body: 'Czech, German, Spanish, French, Italian, Polish, Dutch, English. Detection picks up localized room words like kuchyně, Wohnzimmer, salón, cuisine, cucina, kuchnia, keuken. Add a language or extend a keyword set with a PR — the data is plain TypeScript.',
  },
  {
    title: 'Confidence scoring on every assignment',
    body: 'Each room assignment lists the signals that produced it — HA area, device area, friendly name, entity ID — with weights and a single percentage. When a placement is wrong, you can see why, fix it once, and the override sticks across re-runs.',
  },
  {
    title: 'It tells you when HA itself needs cleaning',
    body: "Found a high-confidence room match for an entity that has no area_id set in HA? Lovelacer surfaces a one-click action to fix the underlying registry. The next analysis won't need to guess.",
  },
  {
    title: 'Diff before apply, never destructive',
    body: 'Re-running on a changed install produces a diff with additions, removals, and movements per entity. Lovelacer applies as a new dashboard alongside your existing ones — your handcrafted views stay untouched.',
  },
  {
    title: 'AI is opt-in, not the default',
    body: "The base product is heuristic-only. AI features are gated behind explicit configuration and support local Ollama models for users who don't want anything leaving their network. Cost caps prevent runaway inference bills.",
  },
  {
    title: 'Standalone Docker for HA Core users',
    body: 'Lovelacer runs as a Supervisor add-on by default. If you run HA Core or HA Container, the same image works standalone with a long-lived access token — same features, same behavior, no Supervisor required.',
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
