import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Lovelacer',
  description: 'Home Assistant dashboards that organize themselves.',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: '/brand/lovelacer-favicon.svg', type: 'image/svg+xml' }],
    ['meta', { property: 'og:title', content: 'Lovelacer Documentation' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'Install and operate the Home Assistant dashboard generator.',
      },
    ],
  ],
  themeConfig: {
    logo: '/brand/lovelacer-favicon.svg',
    siteTitle: 'Lovelacer Docs',
    nav: [
      { text: 'Install', link: '/install/supervised' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'FAQ', link: '/faq' },
      { text: 'GitHub', link: 'https://github.com/Studio81Labs/lovelacer' },
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
      copyright: 'Copyright (c) Studio81Labs',
    },
  },
})
