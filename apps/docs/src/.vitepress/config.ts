import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Lovelacer',
  description: 'Home Assistant dashboards that organize themselves.',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/brand/lovelacer-favicon.svg' }],
    [
      'link',
      {
        rel: 'alternate icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/brand/lovelacer-favicon-32.png',
      },
    ],
    [
      'link',
      {
        rel: 'alternate icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/brand/lovelacer-favicon-16.png',
      },
    ],
    ['meta', { property: 'og:title', content: 'Lovelacer' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'Home Assistant dashboards that organize themselves.',
      },
    ],
    ['meta', { property: 'og:image', content: '/brand/lovelacer-logo-1024.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    ],
  ],
  themeConfig: {
    logo: {
      light: '/brand/lovelacer-lockup.svg',
      dark: '/brand/lovelacer-lockup-dark.svg',
      alt: 'Lovelacer',
    },
    siteTitle: false,
    nav: [
      { text: 'Install', link: '/install/supervised' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'FAQ', link: '/faq' },
      { text: 'GitHub', link: 'https://github.com/Studio81Labs/lovelacer' },
      { text: 'Discuss', link: 'https://github.com/Studio81Labs/lovelacer/discussions' },
    ],
    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Home Assistant Supervised', link: '/install/supervised' },
          { text: 'Standalone Docker', link: '/install/standalone-docker' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'FAQ', link: '/faq' },
        ],
      },
    ],
    search: {
      provider: 'local',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/Studio81Labs/lovelacer' }],
    footer: {
      message: 'MIT licensed. Built for Home Assistant users who want a useful first dashboard.',
      copyright: 'Copyright (c) Studio81 Labs',
    },
  },
})
