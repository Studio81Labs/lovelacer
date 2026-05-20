<script setup lang="ts">
interface Props {
  variant?: 'hero' | 'section'
}
const props = withDefaults(defineProps<Props>(), { variant: 'hero' })

const columns = [
  {
    title: 'Heuristic-first',
    body: 'Lovelacer starts with Home Assistant’s own structure — areas, device metadata, friendly names, and entity IDs — then combines those signals into a confidence score you can review per entity.',
    detail: 'area_id  →  device.area_id  →  friendly_name  →  entity_id  →  device.name',
  },
  {
    title: 'Multi-language room detection',
    body: 'Room detection works across English, Czech, German, Spanish, French, Italian, Polish, and Dutch. Localized room names like kuchyně, Wohnzimmer, cocina, or cuisine still land in the right place.',
    detail: 'kuchyně · Wohnzimmer · cocina · cuisine',
  },
  {
    title: 'Local-first by default',
    body: 'The base product runs entirely locally and never leaves your network. Optional AI-assisted features remain opt-in and support local Ollama models for users who prefer fully local workflows.',
    detail: 'No telemetry. No cloud dependency. No phone-home behavior.',
  },
]
</script>

<template>
  <section :class="['lc-technical', `lc-technical--${props.variant}`]">
    <div class="lc-section">
      <div v-if="props.variant === 'hero'" class="lc-technical__head">
        <p class="lc-eyebrow">Built for tinkerers</p>
        <h1 class="lc-display lc-technical__title">
          Heuristics you can audit. <em>Languages</em> beyond English. Your data stays local.
        </h1>
        <p class="lc-technical__lede">
          Lovelacer is built for the audience that reads source before installing. Every room
          assignment has a traceable confidence score; every detection rule is documented; every
          external call is opt-in.
        </p>
        <div class="lc-cta-row" style="margin-top: 2rem">
          <a class="lc-btn lc-btn--primary" href="/docs/install/supervised"
            >Install on Home Assistant</a
          >
          <a class="lc-btn lc-btn--ghost" href="/docs/architecture">Read the architecture</a>
        </div>
      </div>

      <div v-else class="lc-technical__head">
        <p class="lc-eyebrow">Under the hood</p>
        <h2 class="lc-display lc-technical__title lc-technical__title--section">
          The <em>hard</em> stuff, where you can see it.
        </h2>
      </div>

      <div class="lc-technical__columns">
        <div v-for="c in columns" :key="c.title" class="lc-technical__col">
          <h3 class="lc-technical__col-title">{{ c.title }}</h3>
          <p class="lc-technical__col-body">{{ c.body }}</p>
          <div class="lc-technical__col-detail lc-mono">{{ c.detail }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lc-technical--hero {
  padding-top: 1rem;
}

.lc-technical__head {
  max-width: 820px;
  margin-bottom: 3.5rem;
}

.lc-technical__title {
  font-size: clamp(2.25rem, 4.5vw, 3.75rem);
  margin-bottom: 1.5rem;
}

.lc-technical__title--section {
  font-size: clamp(2rem, 3.5vw, 2.75rem);
  margin-bottom: 0;
}

.lc-technical__lede {
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  max-width: 720px;
}

.lc-technical__columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-top: 1.5rem;
}

@media (max-width: 880px) {
  .lc-technical__columns {
    grid-template-columns: 1fr;
  }
}

.lc-technical__col {
  padding-top: 1.5rem;
  border-top: 2px solid var(--lc-amber-500);
}
.dark .lc-technical__col {
  border-top-color: var(--lc-amber-300);
}

.lc-technical__col-title {
  font-family: var(--lc-font-sans);
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  color: var(--vp-c-text-1);
}

.lc-technical__col-body {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin: 0 0 1.25rem 0;
}

.lc-technical__col-detail {
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  padding: 0.75rem;
  background: var(--vp-c-bg-soft);
  border-radius: 6px;
  word-break: break-word;
}
</style>
