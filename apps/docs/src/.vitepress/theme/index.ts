import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import HomeLayout from './layouts/HomeLayout.vue'
import './styles/tokens.css'
import './styles/overrides.css'

export default {
  extends: DefaultTheme,
  Layout: HomeLayout,
} satisfies Theme
