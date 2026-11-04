---
# Template: agent security analysis. See templates/articles/README.md.
# Replace every TODO value, then delete these comment lines if you like.
# Review the draft with /review-agent-security before publishing.
title: "TODO: Security article title, e.g. Prompt Injection Through Retrieved Documents"
description: "TODO: One or two sentences naming the threat, the affected agent pattern, and the main control."
# topic must be exactly one of: Foundations, Architecture, Frameworks, Deployment, Security
topic: Security
# level must be exactly one of: Beginner, Intermediate, Advanced
level: Intermediate
# TODO: replace with the real publication date (YYYY-MM-DD)
publishedAt: 2026-01-01
# updatedAt: 2026-01-01   # optional; uncomment when you revise a published article
# TODO: position within the topic list (lower numbers appear first)
order: 100
# TODO: estimated reading time in whole minutes (positive integer)
readingMinutes: 10
tags: [security, threat-modeling, todo-tag]
featured: false
draft: true
---

TODO: Two or three sentences describing the threat in plain terms and which kinds of agent systems it affects.

## System under analysis

TODO: Describe the example agent: its users, model provider, tools (read-only vs. state-changing), data sources, memory, and secrets. A simple diagram or list is enough.

## Trust boundaries

- TODO: Boundary 1, e.g. user ↔ application.
- TODO: Boundary 2, e.g. retrieved content ↔ model context.
- TODO: Boundary 3, e.g. model output ↔ tool execution.

TODO: Mark which inputs are attacker-controllable.

## Attack paths

### TODO: Attack path 1

- **Attacker:** TODO: who, and what access they need.
- **Entry point:** TODO.
- **Steps:** TODO.
- **Impact:** TODO: data exposed or action taken.

Describe the attack conceptually. Do not include working exploit payloads against real services.

### TODO: Attack path 2

TODO: Same structure.

## Controls

| Control | Attack path addressed | Where it is enforced | Limitation |
| --- | --- | --- | --- |
| TODO, e.g. least-privilege tool scopes | TODO | TODO: application, not prompt | TODO |
| TODO, e.g. human approval for writes | TODO | TODO | TODO |

Prefer controls enforced outside the model. Note which controls reduce likelihood and which reduce impact.

## Residual risk

TODO: What remains after the controls, and what monitoring or response would catch it. Avoid claims such as "fully prevents" unless you can support them.

## Checklist

- [ ] TODO: Actionable check a reader can apply to their own system.
- [ ] TODO

## Sources

- [TODO: Primary source, e.g. OWASP, NIST, vendor security docs](https://example.com/TODO) — TODO: version or date checked.
