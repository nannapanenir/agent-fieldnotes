---
title: Trust Boundaries for Agent Systems
description: Map the model, tools, retrieved content, and application as separate trust boundaries before adding security controls.
topic: Security
level: Beginner
publishedAt: 2026-11-03
order: 4
readingMinutes: 6
tags: [security, threat-modeling, tools]
featured: false
draft: false
---

An agent security review should begin with the system around the model. List the people and services that interact with it, the data they can reach, and the actions the application can take. Then mark which inputs and outputs are trusted.

## Draw the boundaries

For a basic tool-using assistant, map at least:

- The user and their authenticated identity.
- The model provider and the information sent to it.
- Retrieved documents, web pages, uploaded files, and tool results.
- The application server and its policy checks.
- Read-only tools and tools that can change external state.
- Persistent memory, databases, logs, and secrets.
- Human approval and support paths.

The model's context can contain attacker-controlled text. A retrieved page may tell the model to ignore its instructions or expose information. Treat that page as untrusted data, even when it came from a source the application normally uses.

## Keep authority outside the prompt

Instructions can guide a model, but they do not enforce access control. Check identity and permissions in the application or tool service on every operation. Give tools the narrowest scope they need, separate reads from writes, and require explicit approval for high-impact actions.

Validate tool arguments against a strict schema. Limit output sizes and execution time. Avoid giving an agent broad shell, database, or account access when one narrow application function is enough.

## Match controls to risks

| Risk | Example control | What still needs checking |
| --- | --- | --- |
| Untrusted text changes the model's behavior | Separate instructions from data; constrain available actions | Test indirect prompt injection in realistic retrieved content |
| A tool accesses another user's record | Enforce authorization in the server-side tool | Verify tenant boundaries and test ID tampering |
| A loop makes too many requests | Step, time, and cost limits | Ensure retries cannot repeat unsafe writes |
| Sensitive data appears in traces | Minimize and redact logs | Check retention, access, and backups |
| A model requests an unsafe action | Narrow tool schema and approval gate | Test both direct and chained tool requests |

No single prompt, classifier, or checklist makes an agent secure. Controls must be tested against the actual tools, data, users, and impact of failure. Keep a record of the risks that remain after mitigation.

## Further reading

- [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/) — application-focused risk guidance; check the current edition before citing specific categories.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) — risk-management resource; map its guidance to the system context rather than treating it as a technical checklist.
