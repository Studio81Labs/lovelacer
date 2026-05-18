<script setup lang="ts">
const rooms = [
  { name: 'Obývák', count: 65, conf: 86, hint: 'Living room' },
  { name: 'Kuchyně', count: 35, conf: 89, hint: 'Kitchen' },
  { name: 'Ložnice', count: 38, conf: 86, hint: 'Bedroom' },
  { name: 'Pracovna', count: 172, conf: 85, hint: 'Office' },
  { name: 'Koupelna', count: 18, conf: 89, hint: 'Bathroom' },
  { name: 'Garage', count: 16, conf: 85, hint: 'Garage' },
  { name: 'Zahrada', count: 26, conf: 86, hint: 'Garden' },
  { name: 'Chodba', count: 33, conf: 75, hint: 'Hallway' },
]
</script>

<template>
  <section class="lc-practice">
    <div class="lc-section">
      <header class="lc-practice__head">
        <p class="lc-eyebrow">From one real install</p>
        <h2 class="lc-display lc-practice__title">
          Eight of the thirteen rooms Lovelacer found in a Czech HA install.
        </h2>
        <p class="lc-practice__lede">
          Same engine, same heuristics. Different home, different rooms, different language. The
          screenshots throughout this page come from this install — generalized in the headlines,
          real in the detail.
        </p>
      </header>

      <div class="lc-practice__grid">
        <div v-for="r in rooms" :key="r.name" class="lc-practice__room">
          <div class="lc-practice__room-name lc-mono">{{ r.name }}</div>
          <div class="lc-practice__room-hint">{{ r.hint }}</div>
          <div class="lc-practice__room-stats">
            <span>{{ r.count }} entities</span>
            <span class="lc-pill" :class="r.conf >= 85 ? 'lc-pill--success' : 'lc-pill--warning'">
              {{ r.conf }}% conf
            </span>
          </div>
        </div>
      </div>

      <p class="lc-practice__footnote">
        Detection language was set to <code class="lc-mono">auto</code>, which matches every loaded
        keyword set — the Czech names resolved without any per-install configuration.
      </p>
    </div>
  </section>
</template>

<style scoped>
.lc-practice__head {
  max-width: 760px;
  margin-bottom: 3rem;
}

.lc-practice__title {
  font-size: clamp(2rem, 3.5vw, 2.75rem);
  margin: 0 0 1.25rem 0;
}

.lc-practice__lede {
  font-size: 1rem;
  line-height: 1.65;
  color: var(--vp-c-text-2);
  margin: 0;
  max-width: 680px;
}

.lc-practice__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-top: 2rem;
}

@media (max-width: 880px) {
  .lc-practice__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.lc-practice__room {
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 1.25rem;
}

.lc-practice__room-name {
  font-size: 1rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
  margin-bottom: 0.125rem;
}

.lc-practice__room-hint {
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  margin-bottom: 0.875rem;
}

.lc-practice__room-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: var(--vp-c-text-2);
}

.lc-practice__footnote {
  margin-top: 2rem;
  font-size: 0.875rem;
  color: var(--vp-c-text-3);
  max-width: 680px;
  line-height: 1.55;
}
</style>
