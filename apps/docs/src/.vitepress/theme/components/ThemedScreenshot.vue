<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

interface Props {
  name: string
  darkName?: string
  alt: string
  ext?: 'png' | 'jpg' | 'svg' | 'webp'
  singleSource?: boolean
  imgClass?: string
  loading?: 'eager' | 'lazy'
}

const props = withDefaults(defineProps<Props>(), {
  darkName: undefined,
  ext: 'png',
  singleSource: false,
  imgClass: 'lc-screenshot',
  loading: 'lazy',
})

const { isDark } = useData()

const src = computed(() => {
  if (props.singleSource) {
    return `/screenshots/${props.name}.${props.ext}`
  }

  if (isDark.value) {
    return `/screenshots/${props.darkName ?? props.name}-dark.${props.ext}`
  }

  return `/screenshots/${props.name}-light.${props.ext}`
})
</script>

<template>
  <img :src="src" :alt="alt" :class="imgClass" :loading="loading" />
</template>
