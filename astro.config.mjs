import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  base: process.env.SITE_BASE_PATH || '/',
  site: process.env.SITE_URL || undefined,
  markdown: {
    // Code blocks carry both palettes; SiteLayout.astro picks one from the site theme.
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
});
