<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import {
  getScreenshotMode,
  getScreenshotSource,
  type ScreenshotMode,
  type ScreenshotModeSource,
} from './screenshotSources'

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

const mode = ref<ScreenshotMode>(isDark.value ? 'dark' : 'light')

function syncMode() {
  const source: ScreenshotModeSource = { isDark: isDark.value }

  if (typeof document !== 'undefined') {
    source.hasDocumentClass = (className) => document.documentElement.classList.contains(className)
  }

  mode.value = getScreenshotMode(source)
}

let themeObserver: MutationObserver | undefined

watch(isDark, syncMode, { immediate: true })

onMounted(() => {
  syncMode()

  themeObserver = new MutationObserver(syncMode)
  themeObserver.observe(document.documentElement, {
    attributeFilter: ['class'],
    attributes: true,
  })
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
})

const src = computed(() => {
  return getScreenshotSource(
    {
      name: props.name,
      darkName: props.darkName,
      ext: props.ext,
      singleSource: props.singleSource,
    },
    mode.value,
  )
})
</script>

<template>
  <img :src="src" :alt="alt" :class="imgClass" :loading="loading" />
</template>
