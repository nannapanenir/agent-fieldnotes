---
name: review-agent-security
description: Review an AI agent design or Agent Fieldnotes security article by mapping trust boundaries, attack paths, controls, and residual risk.
---

# Review agent security

1. Define the system, intended users, assets, data flows, tools, external services, and actions with real-world impact. State assumptions if details are missing.
2. Mark trust boundaries and identify untrusted sources, including user input, retrieved pages, uploaded files, and tool results.
3. Trace plausible attack paths through the complete application. Consider prompt injection, excessive authority, broken authorization, sensitive data exposure, poisoned memory or retrieval, unsafe execution, denial of service, and supply-chain risks where relevant.
4. Pair each material risk with layered controls and a validation method. Keep access control in the application or tool service; do not rely on prompt instructions as an enforcement boundary.
5. Check whether the design has least privilege, narrow tool schemas, output validation, sandboxing, approval gates for consequential actions, limits on steps/time/cost, safe retries, logging with data minimization, monitoring, and incident response.
6. For standards or framework-specific recommendations, verify the current source and scope. Name the version or date; do not claim a checklist guarantees security.
7. Return findings by severity with evidence, attack scenario, impact, recommended change, validation step, and residual risk. Separate confirmed issues from assumptions and suggestions.

When reviewing a blog article, preserve its educational intent and flag misleading or unsupported claims. Do not present a review as a penetration test or certification.
