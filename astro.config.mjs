// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const repoFull = process.env.GITHUB_REPOSITORY ?? '';
const ownerEnv = process.env.GITHUB_REPOSITORY_OWNER ?? '';
const [ownerFromRepo, repoName] = repoFull.split('/');
const owner = ownerEnv || ownerFromRepo || 'OWNER';
const repo = repoName || 'system-design-primer';

export default defineConfig({
  site: `https://${owner}.github.io`,
  base: `/${repo}`,
  trailingSlash: 'ignore',
  integrations: [
    starlight({
      title: 'System Design Primer',
      description:
        'Учебник по проектированию крупномасштабных систем и подготовке к собеседованию по системному дизайну.',
      defaultLocale: 'root',
      locales: {
        root: { label: 'RU', lang: 'ru' },
        en: { label: 'EN', lang: 'en' },
        ja: { label: 'JA', lang: 'ja' },
        'zh-hans': { label: 'ZH-CN', lang: 'zh-CN' },
        'zh-tw': { label: 'ZH-TW', lang: 'zh-TW' },
      },
      social: {
        github: 'https://github.com/anton-kutuzov/system-design-primer',
      },
      editLink: {
        baseUrl: `https://github.com/${owner}/${repo}/edit/master/`,
      },
      lastUpdated: true,
      pagination: false,
      sidebar: [],
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
      customCss: ['./src/styles/custom.css'],
      head: [
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossorigin: '',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'keywords',
            content:
              'system design, системный дизайн, проектирование систем, масштабируемость, балансировка нагрузки, кэширование, репликация, шардирование, микросервисы, CAP, собеседование',
          },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:type', content: 'website' },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: `https://${owner}.github.io/${repo}/og-image.svg`,
          },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:width', content: '1200' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:height', content: '630' },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:image',
            content: `https://${owner}.github.io/${repo}/og-image.svg`,
          },
        },
        {
          tag: 'meta',
          attrs: { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
        },
        {
          tag: 'meta',
          attrs: { name: 'theme-color', content: '#252529', media: '(prefers-color-scheme: dark)' },
        },
      ],
    }),
  ],
});
