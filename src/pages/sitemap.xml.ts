import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  const root = site ? new URL(import.meta.env.BASE_URL, site) : undefined;
  const paths = ['', 'about/', 'learn/', ...articles.map((article) => `learn/${article.id}/`)];
  const urls = root ? paths.map((path) => {
    const loc = new URL(path, root).toString();
    const article = articles.find((entry) => `learn/${entry.id}/` === path);
    const modified = article?.data.updatedAt;
    return `  <url><loc>${loc}</loc>${modified ? `<lastmod>${modified.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`;
  }) : [];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
