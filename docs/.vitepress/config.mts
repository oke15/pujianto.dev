import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Pujianto DEV",
  description: "Kumpulan ide project dan catatan saat gabut menulis kode",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/pujiantodev.svg",
    nav: [
      { text: "Home", link: "/" },
      // { text: 'Daftar Blog', link: '/blog' },
      {
        text: "Artikel",
        link: "/articles/200261028-auto-backup-laravel-app",
        activeMatch: "/articles/",
      },
      {
        text: "Artikel (AI Mode)",
        link: "/articles-ai/200261028-auto-backup-laravel-app",
        activeMatch: "/article-ai/",
      },
    ],

    sidebar: {
      "/articles/": [
        {
          text: "Daftar Article",
          items: articleItems(),
        },
      ],
      "/articles-ai/": [
        {
          text: "Article (AI Gen)",
          items: articleAiItems(),
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/pujiantodev/pujianto.dev" },
    ],
    search: {
      provider: "local",
    },
    outline: {
      level: "deep",
      label: "Semua di halaman ini",
    },
  },
  markdown: {
    toc: { level: [1, 2, 3] },
    image: {
      lazyLoad: true,
    },
    // Shiki memakai id "dotenv" untuk file .env, bukan "env"
    languageAlias: {
      env: "dotenv",
    },
  },
});

function articleItems() {
  return [
    {
      text: "Auto Backup Laravel",
      link: "/articles/200261028-auto-backup-laravel-app",
    },
  ];
}
function articleAiItems() {
  return [
    {
      text: "Auto Backup Laravel",
      link: "/articles-ai/200261028-auto-backup-laravel-app",
    },
  ];
}
