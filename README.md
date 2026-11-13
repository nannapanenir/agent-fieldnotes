# Agent Fieldnotes

A static Astro blog about agentic systems, their architecture, and security. Articles are Markdown files grouped by topic; the site generates their routes and indexes during the build.

## Project structure

```text
.
├── .claude/skills/          # Shared Claude Code skills (research, drafting, security review, SEO)
├── .github/workflows/       # GitHub Pages deployment
├── public/                  # Static files copied as-is (favicon)
├── src/
│   ├── components/          # Astro components
│   ├── content/articles/    # Published and draft articles, one folder per topic
│   │   ├── foundations/
│   │   ├── architecture/
│   │   ├── frameworks/
│   │   ├── deployment/
│   │   └── security/
│   ├── layouts/             # Page layouts
│   ├── pages/               # Routes, sitemap.xml and robots.txt
│   └── content.config.ts    # Article frontmatter schema
├── templates/articles/      # Article templates (not loaded by Astro)
├── astro.config.mjs
├── CLAUDE.md                # Project instructions for Claude Code
└── package.json
```

## Local development

### Requirements

Node.js 22 or newer (`"engines": { "node": ">=22.0.0" }` in `package.json`). Check your version with:

```sh
node --version
```

### Install dependencies

```sh
npm install
```

Use `npm ci` instead for a clean install that matches `package-lock.json` exactly.

### Start the development server

```sh
npm run dev
```

Astro prints the local URL, usually `http://localhost:4321/`. Pages reload as you edit files. Stop the server with `Ctrl+C`.

Copy `.env.example` to `.env` if the project adds one. `.env` files are git-ignored; never commit secrets.

## Write an article

### Start from a template

Templates for concept guides, tutorials, framework comparisons, and security analyses live in `templates/articles/`. See [`templates/articles/README.md`](templates/articles/README.md) for which to pick. Copy one into the matching topic folder and rename it:

```sh
cp templates/articles/concept-guide.md src/content/articles/foundations/what-is-tool-calling.md
```

Then replace every `TODO` placeholder. Keep templates themselves out of `src/content/articles/`; anything there is loaded as an article.

### Publish through the stage pull request

New articles use `draft: false`. Articles are grouped by roadmap stage into one pull request; the user reviews that pull request, and merging it publishes them. Templates start with `draft: true` only so a half-filled copy can't go live by accident: change it to `draft: false` once every `TODO` is gone, before you open the pull request.

Articles marked `draft: true` are excluded from every page, the article index, and `sitemap.xml`, including when you run `npm run dev`. Use it only to hold back an article that isn't ready to merge.

Keep external source links out of the article body. List sources with their dates in the pull request description, and attribute claims in words in the article (for example, "OWASP's 2026 edition lists...").

### Topic folders and frontmatter

Articles live under `src/content/articles/` in one of these topic folders:

```text
foundations/
architecture/
frameworks/
deployment/
security/
```

For example, `src/content/articles/security/prompt-injection.md` becomes `/learn/security/prompt-injection/`. Add frontmatter like this. The `topic` must match the section name exactly. New articles use `draft: false`; merging the stage pull request publishes them.

```yaml
---
title: Prompt Injection and Agents
description: A short summary used on the site and in search results.
topic: Security
level: Beginner
publishedAt: 2026-11-03
order: 10
readingMinutes: 8
tags: [security, prompt-injection]
featured: false
draft: false
---
```

The frontmatter schema lives in `src/content.config.ts`; routes come from `src/pages/learn/[...slug].astro`.

## Build

```sh
npm ci
npm run build
npm run preview
```

The static output is written to `dist/`. The included GitHub Actions workflow publishes it to GitHub Pages. Before the first deployment, add a GitHub repository Actions variable named `SITE_URL` with the canonical origin, for example `https://your-domain.com`. For a custom domain at the root, leave `SITE_BASE_PATH` unset. For a repository-path site before a custom domain is configured, set `SITE_BASE_PATH` to `/<repository-name>/`.

The site generates canonical URLs, Open Graph and Twitter metadata, `sitemap.xml`, `robots.txt`, and JSON-LD for the home page and article pages. After deployment, verify ownership in Google Search Console and submit `/sitemap.xml`. A sitemap helps discovery but does not guarantee indexing or ranking.

## Project skills for Claude Code

Project-specific skills live in `.claude/skills/<skill-name>/SKILL.md` and can be committed with the site so the same research, drafting, security-review, and SEO workflows are available in Claude Code for this repository.
