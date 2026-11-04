---
name: draft-agent-article
description: Draft or revise an Agent Fieldnotes article as a route-ready Markdown file with clear explanations, verified sources, and the site's required frontmatter.
---

# Draft an Agent Fieldnotes article

1. Identify the intended reader, question, takeaway, and place in the learning path. Use `src/content/articles/` and the existing articles to match the site's structure and avoid duplicating material.
2. For current details, gather sources with `/research-agent-topic` or browse official documentation directly. Cite links near the claims they support; include versions and dates for fast-changing technical details.
3. Write for an engineer who may be new to the topic. Define terms, use one concrete example, explain tradeoffs, and avoid hype or unqualified security claims.
4. Save a `.md` file under the matching topic folder: `foundations`, `architecture`, `frameworks`, `deployment`, or `security`. The file path beneath the folder becomes the route beneath `/learn/`.
5. Include valid frontmatter with `title`, `description`, `topic`, `level`, `publishedAt`, `order`, `tags`, `featured`, and `draft`. Use the exact topic spelling from the content schema. Use `draft: true` until the user wants publication.
6. Preview article links and headings. Do not claim that the article has been fact-checked, built, or published unless those steps were completed.

Use these sections when they fit: the reader's question, explanation, worked example, tradeoffs or failure modes, security implications, and further reading. Keep the article focused; move a different reader question into a separate post.
