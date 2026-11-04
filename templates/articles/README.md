# Article templates

These are starting points for new Agent Fieldnotes articles. They live outside `src/content/articles/`, so Astro never loads them as articles. Copy one into a topic folder before you edit it.

## Choose a template

| Template | Use it for | Default `topic` |
| --- | --- | --- |
| `concept-guide.md` | Explaining an idea, pattern, or term: "what is X and how does it work?" | `Foundations` |
| `tutorial.md` | Step-by-step instructions where the reader builds or runs something | `Deployment` |
| `framework-comparison.md` | Comparing two or more frameworks, SDKs, or services for a specific use case | `Frameworks` |
| `security-analysis.md` | Threat-modeling an agent pattern: trust boundaries, attack paths, controls, residual risk | `Security` |

The default `topic` is only a suggestion. A concept guide about the agent loop belongs in `Architecture`; a tutorial on sandboxing tools could belong in `Security`.

## Copy it into the right folder

The topic folder and the `topic` value in frontmatter must match:

| Folder | `topic` value |
| --- | --- |
| `src/content/articles/foundations/` | `Foundations` |
| `src/content/articles/architecture/` | `Architecture` |
| `src/content/articles/frameworks/` | `Frameworks` |
| `src/content/articles/deployment/` | `Deployment` |
| `src/content/articles/security/` | `Security` |

Name the file with a short, lowercase, hyphenated slug. The path becomes the URL:

```bash
cp templates/articles/security-analysis.md src/content/articles/security/prompt-injection-in-rag.md
```

That file is served at `/learn/security/prompt-injection-in-rag/`.

## Fill it in

1. Replace every `TODO` in the frontmatter and body. Search the file for `TODO` before you finish.
2. Set `publishedAt` to the real publication date (`YYYY-MM-DD`). Add `updatedAt` only when you revise a published article.
3. Keep `topic` and `level` spelled exactly as listed in the comments. The allowed values come from `src/content.config.ts`, and the build fails on anything else.
4. Cite primary sources next to the claims they support, with versions and dates for anything that changes quickly.
5. Delete the template comments (`# ...` lines in frontmatter and `<!-- ... -->` in the body) if you don't need them.

## Keep it a draft until it's ready

Every template starts with `draft: true`, which keeps the article out of the public build. Change it to `draft: false` only when the article is reviewed and ready to publish. For security articles, run `/review-agent-security` first. For any article, `/seo-site-audit` can check metadata and internal links.

If the schema in `src/content.config.ts` changes, update these templates to match.
