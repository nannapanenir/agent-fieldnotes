# Agent Fieldnotes

This project is a static Astro learning site about AI agents and agent security. Markdown files under `src/content/articles/<topic>/` generate public routes under `/learn/<topic>/`.

- Use `/research-agent-topic` for source gathering, `/draft-agent-article` for route-ready article files, `/review-agent-security` for security content, and `/seo-site-audit` for site or article SEO reviews.
- Keep articles focused, cite current primary sources for changing technical facts, and do not invent author credentials, experience, benchmark results, or endorsements.
- Match article frontmatter to `src/content.config.ts`. Keep new articles as drafts until the user asks to publish them.
- Use the Google Search Central guidance in the SEO skill. Treat sitemaps and structured data as discovery and interpretation aids; do not promise indexing, rich results, or rankings.
- The canonical site origin is supplied through `SITE_URL` at build time. Do not replace it with a guessed domain.
