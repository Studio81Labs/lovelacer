<script setup lang="ts">
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import HomePage from '../components/HomePage.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
</script>

<template>
  <Layout>
    <template v-if="frontmatter.layout === 'home'" #home-hero-before>
      <HomePage />
    </template>
    <template v-if="frontmatter.layout === 'home'" #home-features-after>
      <div />
    </template>
  </Layout>
</template>

<style>
/* When we render our custom HomePage in the hero slot, hide the
   default home features block — we render our own sections. */
.VPHome > .VPFeatures,
.VPHome > .container > .main > .hero,
.VPHome .VPHero {
  display: none !important;
}
</style>
