<script setup lang="ts">
/*
 * Three lead variants are built into this homepage. Set HERO_VARIANT
 * to 'A', 'B', or 'C' to choose which one renders at the top. The
 * other two adapt into supporting roles further down the page.
 *
 *   A — Before/After visual hero (the strongest pure sell)
 *   B — Numbers / time hero (the strongest concrete pitch)
 *   C — Technical depth hero (the strongest credibility play)
 *
 * Pick one, ship it. Don't ship all three live — pick one.
 */
import { ref } from 'vue'
import HeroBeforeAfter from './HeroBeforeAfter.vue'
import HeroNumbers from './HeroNumbers.vue'
import HeroTechnical from './HeroTechnical.vue'
import SectionFeatures from './SectionFeatures.vue'
import SectionHowItWorks from './SectionHowItWorks.vue'
import SectionHardParts from './SectionHardParts.vue'
import SectionInPractice from './SectionInPractice.vue'
import SectionAlpha from './SectionAlpha.vue'
import SectionInstall from './SectionInstall.vue'

const HERO_VARIANT: 'A' | 'B' | 'C' = 'A'

// The "demoted" leads — these become supporting sections rather than disappearing.
// If hero = A, then B and C show up later. If hero = B, then A and C. Etc.
const demotedLeads = ref<('A' | 'B' | 'C')[]>(
  HERO_VARIANT === 'A' ? ['B', 'C'] : HERO_VARIANT === 'B' ? ['A', 'C'] : ['A', 'B'],
)
</script>

<template>
  <div class="lc-home">
    <!-- ========== HERO ========== -->
    <HeroBeforeAfter v-if="HERO_VARIANT === 'A'" />
    <HeroNumbers v-else-if="HERO_VARIANT === 'B'" />
    <HeroTechnical v-else />

    <!-- ========== SUPPORTING SECTIONS ========== -->
    <SectionFeatures />
    <SectionHowItWorks />

    <!-- Demoted hero B becomes the "numbers" mid-section if not the lead -->
    <HeroNumbers v-if="demotedLeads.includes('B')" variant="section" />

    <SectionHardParts />

    <!-- Demoted hero C becomes the "technical depth" mid-section -->
    <HeroTechnical v-if="demotedLeads.includes('C')" variant="section" />

    <SectionInPractice />

    <!-- Demoted hero A becomes a smaller "see the difference" mid-section -->
    <HeroBeforeAfter v-if="demotedLeads.includes('A')" variant="section" />

    <SectionAlpha />
    <SectionInstall />
  </div>
</template>

<style>
.lc-home {
  /* HomePage sits inside VitePress's home container. Reset top spacing
     because we draw our own hero. */
  margin-top: -64px;
  padding-top: 64px;
}
</style>
