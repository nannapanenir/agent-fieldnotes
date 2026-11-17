import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  base: process.env.SITE_BASE_PATH || '/',
  site: process.env.SITE_URL || undefined,
  markdown: {
    // Code blocks carry both palettes; src/styles/global.css uses the dark one on the navy code background.
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-high-contrast' },
      defaultColor: false,
    },
  },
});
