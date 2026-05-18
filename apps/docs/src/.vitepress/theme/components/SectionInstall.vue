<script setup lang="ts">
const paths = [
  {
    title: 'Home Assistant Supervised',
    desc: 'You run HA OS or HA Supervised and have the add-on store. Add the custom repository, click Install, open Lovelacer from the sidebar.',
    href: '/install/supervised',
    primary: true,
  },
  {
    title: 'Standalone Docker',
    desc: 'You run HA Core, HA Container, or want a local dev runtime. Run the published image with a long-lived access token. Same features.',
    href: '/install/standalone-docker',
    primary: false,
  },
]
</script>

<template>
  <section class="lc-install">
    <div class="lc-section lc-section--narrow">
      <p class="lc-eyebrow">Get started</p>
      <h2 class="lc-display lc-install__title">Two ways in. <em>Same</em> Lovelacer.</h2>

      <div class="lc-install__paths">
        <a
          v-for="p in paths"
          :key="p.title"
          :href="p.href"
          :class="['lc-install__path', { 'lc-install__path--primary': p.primary }]"
        >
          <h3 class="lc-install__path-title">{{ p.title }}</h3>
          <p class="lc-install__path-desc">{{ p.desc }}</p>
          <span class="lc-install__path-arrow">Install guide →</span>
        </a>
      </div>

      <div class="lc-install__links">
        <a href="/architecture">Architecture</a>
        <span class="lc-install__sep">·</span>
        <a href="/faq">FAQ</a>
        <span class="lc-install__sep">·</span>
        <a href="https://github.com/Studio81Labs/lovelacer">GitHub</a>
        <span class="lc-install__sep">·</span>
        <a href="https://github.com/Studio81Labs/lovelacer/discussions">Discussions</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lc-install__title {
  font-size: clamp(2rem, 3.5vw, 2.75rem);
  margin: 0 0 2.5rem 0;
}

.lc-install__paths {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 3rem;
}

@media (max-width: 768px) {
  .lc-install__paths {
    grid-template-columns: 1fr;
  }
}

.lc-install__path {
  display: block;
  padding: 1.75rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  transition:
    border-color 0.15s,
    transform 0.15s;
  background: var(--vp-c-bg-alt);
}

.lc-install__path:hover {
  border-color: var(--lc-amber-500);
  transform: translateY(-2px);
}
.dark .lc-install__path:hover {
  border-color: var(--lc-amber-300);
}

.lc-install__path--primary {
  border-color: var(--lc-amber-500);
  background: var(--lc-amber-50);
}
.dark .lc-install__path--primary {
  background: rgba(244, 183, 61, 0.08);
  border-color: var(--lc-amber-300);
}

.lc-install__path-title {
  font-family: var(--lc-font-sans);
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--vp-c-text-1);
}

.lc-install__path-desc {
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--vp-c-text-2);
  margin: 0 0 1rem 0;
}

.lc-install__path-arrow {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--lc-amber-700);
}
.dark .lc-install__path-arrow {
  color: var(--lc-amber-300);
}

.lc-install__links {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
  font-size: 0.9375rem;
  color: var(--vp-c-text-2);
}

.lc-install__links a {
  color: var(--vp-c-text-2);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  text-decoration-color: var(--vp-c-divider);
}
.lc-install__links a:hover {
  color: var(--lc-amber-500);
  text-decoration-color: var(--lc-amber-500);
}

.lc-install__sep {
  color: var(--vp-c-text-3);
}
</style>
