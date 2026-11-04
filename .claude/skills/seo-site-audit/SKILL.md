---
name: seo-site-audit
description: Audit and improve the Agent Fieldnotes Astro site for technical and editorial SEO, including crawlability, metadata, canonical URLs, sitemaps, structured data, internal links, and article quality.
---

# SEO audit for Agent Fieldnotes

Use this skill for site-wide SEO reviews, page reviews, SEO-related code changes, and preparation for Google Search Console. Work from the current Astro source and generated output; do not assume that a package, route, domain, image, or deployment exists without checking.

## Workflow

1. Establish the task scope: whole site, a route template, or a particular Markdown article. Read the current `astro.config.mjs`, content schema, layouts, relevant route files, workflow, and the target article.
2. Use current Google Search Central guidance for Google-specific recommendations. Browse primary documentation for fast-changing requirements and include links in the report. Separate Google requirements from general recommendations.
3. Inspect the generated static output when available. Check page status/output, crawlable links, title and description, one clear main heading, canonical URL, social metadata, robots rules, sitemap coverage, structured data, and mobile-readable content. Do not claim a check passed unless it was actually inspected.
4. Review the article itself for a clear reader question, useful and original explanations, accurate technical claims, clear heading structure, descriptive internal links, citations near changing claims, and accurate author or update details. Do not keyword-stuff or invent experience, credentials, sources, or dates.
5. Report findings by impact and evidence. For each issue, say which route or file is affected, why it matters, the recommended change, and any prerequisite such as the canonical domain.
6. If asked to implement fixes, make the smallest coherent source changes, keep the content collection schema valid, then run the production build and inspect the relevant generated files. Do not change the live domain, Search Console account, analytics, or deployment audience without an explicit request.
7. Summarize fixed items, unresolved items, and the exact post-deployment work needed. Never promise rankings, indexing, traffic, rich-result display, or AI-search citations.

## Site-specific checks

- **Build and routes:** `npm run build` generates pages from `src/content/articles/**/*.md`. The route should preserve the path below the topic folder as `/learn/<topic>/<nested-path>/`. Draft articles must not appear in public routes or the sitemap.
- **Canonical origin:** `SITE_URL` is the authoritative origin. Check that each canonical URL and sitemap URL uses the same origin and the configured `SITE_BASE_PATH`. Never substitute a guessed domain.
- **Titles and descriptions:** each page should have a distinct, descriptive HTML title and a concise description that matches its visible content. Avoid duplicate or misleading copy.
- **Social previews:** check Open Graph and Twitter title, description, and URL metadata. Recommend a preview image only if a real image is available and has an appropriate absolute URL and alt description.
- **Crawlability:** `robots.txt` should allow public articles and identify the root sitemap. The XML sitemap should list only public canonical pages and use absolute URLs. A sitemap is a hint, not an indexing guarantee.
- **Structured data:** validate JSON-LD against visible page content. Use only appropriate types such as `WebSite`, `BlogPosting`, and `BreadcrumbList`; do not add fabricated authors, ratings, organizations, or unsupported claims. Structured data does not guarantee a rich result.
- **Internal links:** link related guides with descriptive anchor text, keep navigation crawlable, and identify broken or orphaned article routes.
- **Performance and accessibility:** inspect semantic HTML, heading order, image alternatives, keyboard access, responsive layout, and obvious build-time asset or font costs. Report Core Web Vitals only when measured with a named tool and real evidence.
- **Editorial quality:** favor helpful, accurate, people-first writing. For agent security topics, review trust boundaries and mitigations, not only search keywords. Treat framework features and standards as versioned facts that need current primary sources.

## Output format

For an audit, return:

1. A short overall status and scope.
2. A prioritized findings table with severity, evidence or file/route, and action.
3. Fixes made, if any.
4. Items that require the final domain, deployed site, or Search Console access.
5. Primary sources used.

Keep the report useful and specific. Do not produce a numerical SEO score unless a named, repeatable scoring method and its evidence are provided.
