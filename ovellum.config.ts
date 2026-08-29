// ovellum.config.ts — your Ovellum site configuration.
//
// Every option is listed below: active lines are set, commented lines show the
// default (or an example) plus the allowed values, so you can tinker right here
// without leaving the file. Full reference:
//   https://ovellum.oss.oinam.com/docs/reference/config/
//
// `import type` is erased when the config loads, so this file has no runtime
// dependency on `ovellum` resolving here — it's purely for editor autocomplete.
import type { OvellumUserConfig } from "ovellum";

export default {
  name: "albums-oinam-com",
  // version: 'auto', // 'auto' reads package.json#version; or a literal like '1.2.0'
  mode: "manual", // 'manual' | 'auto' | 'hybrid'
  input: "docs", // the documentation this project relies on
  output: ".docs-site", // kept out of dist/ — that belongs to the album site
  // defaultFormat: 'md', // 'md' | 'mdx'

  site: {
    title: "albums.oinam.com",
    // description: 'One-line summary used in <meta> and the footer.',
    // logo: '/public/logo.svg', // brand mark before the title (theme-flipping monochrome); unset = title only
    // favicon: '/favicon.ico',  // default: a root-level favicon.ico
    // home: 'index.md',         // page rendered at /; auto-resolves to index.md, else a root README.md
    // baseUrl: 'https://example.com', // enables sitemap.xml, RSS, and canonical links
    // basePath: '/docs',        // serve under a subpath (e.g. GitHub project pages)
    // Multiple languages (i18n) — content moves to content/<code>/ subtrees,
    // defaultLocale serves at the root, others under /<code>/. Adds a topbar
    // language picker. Codes are BCP 47 (en-US, ja, zh-Hans). See the i18n guide.
    // defaultLocale: 'en-US',
    // locales: [{ code: 'en-US', label: 'English' }, { code: 'ja', label: '日本語' }],
    defaultTheme: "auto", // 'auto' | 'light' | 'dark'
    // palette: 'default',       // 'default' | 'nord' | 'flexoki' | 'solarized' | 'eink'
    // accent: 'oklch(57% 0.16 255)', // primary color (CTA buttons, links, focus); any CSS color
    // font: 'sans',             // 'sans' | 'serif' (system) | 'inter' | 'geist' (bundled, lazy)
    //                           //   …or bring your own: { body: "'Brand', system-ui", mono?, source: '/fonts.css', label? }
    // dateFormat: 'humanized',  // 'humanized' (today / Jun 14, 2026) | 'iso' (2026-06-14)
    // footer: 'Your Name',      // footer text / copyright line
    // credit: true,             // 'Built with Ovellum' footer link; set false to remove
    // codeTheme: 'github',      // 'github' | 'nord' | 'solarized'
    // editUrlPattern: 'https://github.com/you/repo/edit/main/{path}',
    // search: { enabled: false }, // true → Pagefind search box + Cmd/K (adds a build pass + client payload)
    // pageMeta: { readingTime: true, lastModified: true }, // 'N min read · Edited …' line above each article
    // sidebar: { collapse: true }, // collapse folders by default (a folder's _meta.json can override per-folder)
    // backToTop: { enabled: true, threshold: 360 }, // floating button after THRESHOLD px of scroll
    // publicDir: 'public',      // RESERVED static-assets dir → copied to the output ROOT (public/favicon.ico → /favicon.ico); never processed
    // assetBaseUrl: 'https://cdn.example.com/site', // serve publicDir from a CDN: skip the local copy + rewrite /asset refs to this base (like Vite base / Next assetPrefix)
    // ignoreFolders: [],        // folder names to exclude at any depth
    // ignoreFiles: [],          // file globs to exclude, e.g. ['README.md', 'drafts/**']
    // topbarNav: [              // right-aligned top-bar links (title + URL)
    //   { label: 'GitHub', href: 'https://github.com/you/repo', icon: 'github', external: true },
    // ],
    // footerNav: [              // footer links (icon optional: github | npm | rss | mail)
    //   { label: 'GitHub', href: 'https://github.com/you/repo', icon: 'github', external: true },
    // ],
    // headExtra: '', // raw HTML injected into <head> (analytics, fonts) — author-controlled, NOT sanitised
    // landing: { enabled: false }, // homepage at / (hero + feature grid + CTAs)
  },

  // update: { check: true, intervalHours: 24 }, // CLI "update available" notice (auto-off in CI / non-TTY)
} satisfies OvellumUserConfig;
