# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three audiences, in priority order. Design for the first; the security notes and the Foundry track must also work for the second and third.

1. **Software engineers new to agents.** They can already write code but haven't built an agent. They follow the learning path in order, from concepts to a deployed agent, and run the TypeScript or Python code along the way.
2. **Security-minded engineers (AppSec, platform).** They threat-model and review agent systems their teams are building. They come for the security notes (stages 3 and 5) and the trust-boundary drawings, often without reading the path in order.
3. **Azure / Microsoft Foundry teams.** They will deploy on Foundry. For them, stages 1–7 are groundwork for the stage 8 Foundry track.

## Product Purpose

Agent Fieldnotes is a free, static learning site that explains how AI agents work and how to keep them inside their limits. It starts from fundamentals and builds toward practical architecture, deployment, evaluation, and risk reduction.

Success: a reader can build and ship a safe agent, going from no agent to a working, bounded, deployed agent using the code in the learning path.

## Positioning

- Security is part of every explanation from the start, not added at the end. The security notes use the same drawings as the architecture notes, so a reader sees exactly where each check sits.
- One continuous, staged path (8 stages) with runnable code that builds a single project through to deployment, rather than a set of standalone posts.
- Facts that change quickly are checked against current primary sources, with versions and the date checked stated in the article.

## Operating Context

- Readers move through `/learn/` and its 8-stage learning path, or arrive on a single article from search. Articles live at `/learn/<topic>/<slug>/`, grouped into Foundations, Architecture, Frameworks, Deployment, and Security.
- Articles mix prose, SVG diagrams with numbered markers that match tables or steps, comparison tables, and code shown in TypeScript/Python tabs (TypeScript first).
- Readers copy code into their own projects and run it locally (Node.js 22, Python 3.12) before deploying.

## Capabilities and Constraints

- Static Astro site (`output: 'static'`, trailing-slash URLs), deployed with GitHub Pages through `.github/workflows/`. No accounts, search backend, comments, or server-side features.
- Content is Markdown under `src/content/articles/<topic>/`; the frontmatter must match `src/content.config.ts` (topic, level, stage 1–8, stageOrder, readingMinutes, tags, featured, draft).
- The canonical origin comes from `SITE_URL` at build time; never hard-code a guessed domain. `SITE_BASE_PATH` sets the base path.
- `docs/editorial-roadmap.md` is the source of truth for the article plan and publishing status. Every code example ships in both TypeScript and Python.
- SEO follows Google Search Central guidance. Sitemaps and structured data help discovery and interpretation; they never promise indexing, rich results, or rankings.

## Brand Commitments

- Name: **Agent Fieldnotes**. Taglines in use: "Understand agents. Build them responsibly." and "Clear thinking for systems that can act."
- Voice (from the about page): explain the mechanism before the marketing language; distinguish an LLM call, a fixed workflow, and an agentic loop; pair each risk with a control; state what remains uncertain or unmitigated.
- The site is presented as a work in progress, "written and drawn in public".

## Evidence on Hand

- 39 articles across 8 stages, with SVG diagrams per article (see `docs/editorial-roadmap.md`), and code tested on stated SDK and runtime versions.
- A designer credit and profile card in the footer (`src/components/FooterCredit.astro`).
- None of the following exist, and they must not be invented: author credentials or years of experience, testimonials, reader counts, endorsements, benchmark results, or partner/vendor affiliations.

## Product Principles

1. **The newcomer engineer comes first.** If a page doesn't work for someone building their first agent, it isn't done. Reviewers and Foundry teams must still find their way in.
2. **Every page moves the reader toward a safe, shipped agent.** Concepts lead to code, and code leads to deployment.
3. **Show the boundary.** Every mechanism is explained together with where its controls and checks sit.
4. **Earn trust with sources, not claims.** Cite primary sources, give versions and check dates, and admit open risks.
5. **Reading and running code are the main tasks.** Long-form reading, diagrams, and copyable code take priority over decoration.

## Accessibility & Inclusion

Target WCAG 2.2 AA across the site: text contrast, full keyboard access, visible focus, reflow at 320 CSS px, text alternatives for diagrams (tables or step lists already serve as text equivalents for several SVGs), and dismissible hover/focus content (WCAG 1.4.13). The site already honors `prefers-reduced-motion`.
