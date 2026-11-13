# Editorial roadmap

This file is the source of truth for the Agent Fieldnotes article plan. The `write-agent-article` skill reads it to pick the next article and updates the status tracker as articles move through pull requests. It was created from the skill's seed copy dated 2026-11-13.

## Status tracker

Statuses: `published` (live, `draft: false`), `in repo` (committed, still draft or waiting on fixes), `written` (finished outside the repo, the user still needs to add it and its SVGs), `in PR` (in an open stage pull request), `next`, `planned`.

| Stage | File | Status | Notes |
| --- | --- | --- | --- |
| 1 | foundations/what-is-an-agent.md | published | Revised version replaces the live one; adds agent-spectrum.svg. `draft: false` is set in this PR, so the live page stays up after merge. |
| 1 | foundations/agentic-ai-glossary.md | published | No images. |
| 1 | foundations/ai-phrasebook.md | published | Adds engineering-ladder.svg. Links into the glossary. |
| 2 | architecture/the-agent-loop.md | published | Closing-paragraph fix is in this PR. |
| 2 | architecture/agent-components-model-tools-state.md | published | Adds agent-components.svg, plus agent-loop.svg and trust-boundaries.svg figure blocks. |
| 2 | architecture/tool-calling-and-control-flow.md | published | Adds tool-call-path.svg. |
| 2 | architecture/context-memory-and-retrieval.md | published | Adds context-sources.svg. |
| 2 | architecture/single-agent-vs-multi-agent.md | published | Adds single-vs-multi-agent.svg and mcp-vs-a2a.svg. |
| 2 | architecture/orchestration-patterns.md | published | Adds five pattern-*.svg diagrams. |
| 3 | security/trust-boundaries-for-agents.md | published | Further-reading update (OWASP Agentic Top 10 2026, NIST AI 600-1) is in this PR. |
| 3 | security/tool-permissions-and-excessive-agency.md | published | Adds security/scoped-token-flow.svg. |
| 3 | security/prompt-injection-in-agent-systems.md | next | |
| 3 | security/agent-memory-and-data-exposure.md | planned | |
| 3 | security/sandboxing-and-code-execution.md | planned | |
| 3 | security/human-approval-for-sensitive-actions.md | planned | |
| 4 | architecture/build-a-minimal-agent-in-typescript.md | planned | |
| 4 | architecture/add-tools-and-permissions.md | planned | |
| 4 | architecture/add-state-and-handle-tool-errors.md | planned | |
| 4 | architecture/evaluate-agent-behavior-locally.md | planned | |
| 5 | security/threat-modeling-an-agent.md | planned | |
| 5 | security/evaluating-agent-security.md | planned | |
| 6 | frameworks/choosing-an-agent-framework.md | published | |
| 6 | frameworks/framework-comparison-by-use-case.md | planned | |
| 7 | deployment/reliability-cost-and-runaway-loops.md | planned | |
| 7 | deployment/deploying-an-agent.md | planned | |
| 8 | deployment/what-is-microsoft-foundry.md | planned | New in the Foundry track. |
| 8 | deployment/choose-an-azure-agent-hosting-option.md | planned | Now also covers Azure Container Apps. |
| 8 | deployment/foundry-models.md | planned | New. |
| 8 | deployment/deploy-a-prompt-agent-to-foundry.md | planned | |
| 8 | deployment/deploy-a-hosted-agent-to-foundry.md | planned | Recheck supported SDKs and languages. |
| 8 | deployment/microsoft-agent-framework-basics.md | planned | New. |
| 8 | deployment/foundry-tools.md | planned | New. |
| 8 | deployment/foundry-iq.md | planned | New. |
| 8 | deployment/configure-azure-agent-identity-rbac-and-secrets.md | planned | |
| 8 | deployment/foundry-guardrails-and-content-safety.md | planned | New. |
| 8 | deployment/foundry-evaluations-tracing-and-red-teaming.md | planned | New. |
| 8 | deployment/azure-networking-and-private-access.md | planned | |
| 8 | deployment/monitor-version-and-roll-back-an-azure-agent.md | planned | |
| 8 | deployment/monitoring-and-incident-response.md | planned | |

## Writing rules

- Cite OWASP LLM Top 10 IDs from the 2026 edition (for example LLM03:2026 Excessive Agency) and name the edition.

## Stage 8 notes (Microsoft Foundry)

Stage 8 is a 14-article Microsoft Foundry track. Open decision for the user: keep these under the Deployment topic with a `foundry` tag (recommended, no code change), or add a Foundry topic to `src/content.config.ts`. Ask before starting Stage 8. Foundry changes monthly: recheck Microsoft Learn on the day you write each article and state the date checked. Microsoft's docs currently disagree on agent types, and visual workflows are documented as retiring on December 1, 2026.

New articles in this stage, in reading order alongside the existing entries below:

- `deployment/what-is-microsoft-foundry.md` (first in the stage): the five parts (Models, Agent Service, Tools, IQ, Control Plane), the naming history (Azure AI Studio, Azure AI Foundry, Microsoft Foundry), the resource and project model. Visual: one diagram of the five parts.
- `deployment/foundry-models.md` (after the hosting choice): the model catalog, deployments, choosing a model, quotas and cost basics.
- `deployment/microsoft-agent-framework-basics.md` (after the hosted agent): Microsoft's code framework for agents and workflows, its built-in orchestrations, and how it runs on Foundry. Links back to `orchestration-patterns`.
- `deployment/foundry-tools.md`: built-in tools, MCP tools, OpenAPI tools, and choosing among them with least privilege. Security angle: OWASP ASI02 and the MCP security best practices.
- `deployment/foundry-iq.md`: knowledge bases, agentic retrieval, and grounding. Security angle: OWASP ASI06 memory and context poisoning.
- `deployment/foundry-guardrails-and-content-safety.md` (after identity): controls on inputs, outputs, and tool calls, and task adherence. Must describe filters as a mitigation layer, never as a boundary.
- `deployment/foundry-evaluations-tracing-and-red-teaming.md`: built-in evaluators, tracing, monitoring, and the AI Red Teaming Agent. Note which parts are generally available and which are in preview on the date checked.


The sequence is to compare the three Azure hosting options, follow the one tutorial that fits (each tutorial stands alone after the comparison), then learn the production topics that apply to all three. Every Azure article is drafted against current Microsoft Learn documentation (see "Microsoft Learn sources").

**Treat as changeable facts to re-verify when writing each article:** service and product names, portal labels, SDK package names and versions, `az` and `azd` versions and extensions, preview vs. GA status, role names, regions, quotas and limits, and pricing. For example, Microsoft Learn notes that the Foundry RBAC roles were recently renamed: Foundry User, Foundry Owner, Foundry Account Owner, and Foundry Project Manager were previously Azure AI User, Azure AI Owner, Azure AI Account Owner, and Azure AI Project Manager. Learn also keeps separate "Foundry (classic)" pages. Use the current Foundry docs, not the classic ones.

**Every tutorial brief uses the same structure:** prerequisites, setup, deployment, invocation, verification, cleanup, and cost, region, and permission caveats, plus a security section. The steps are numbered, and each tutorial has a visual walkthrough whose diagram numbers match the steps.

## Article briefs (planned articles)

#### security/prompt-injection-in-agent-systems.md
- Question: What is prompt injection, why is it worse when an agent has tools, and what actually reduces the risk?
- Outcome: The reader can tell direct and indirect injection apart, trace how injected text turns into a tool action, and explain why controls must limit what a successful injection can do, because no filter fully prevents injection.
- Prereqs: `trust-boundaries-for-agents`, `tool-permissions-and-excessive-agency`.
- Security: OWASP ASI01 (Agent Goal Hijack), and the Information Security risk in NIST AI 600-1. Avoid claiming that any classifier, content filter, delimiter scheme, or system prompt prevents injection. Vendor content filters are a mitigation layer, not a boundary.
- Visual: An indirect prompt-injection attack path, with and without controls. Format: Two Mermaid flowcharts ("without controls" and "with controls"), exported to SVG. Number the attack steps A1–A5 and refer to them in the text.

#### security/agent-memory-and-data-exposure.md
- Question: How can an agent's memory, retrieval, logs, and traces leak or be poisoned, and how do I limit that?
- Outcome: The reader can scope memory per user and tenant, validate what gets written to memory, minimize and redact logs and traces, and set retention rules.
- Prereqs: `context-memory-and-retrieval`, `prompt-injection-in-agent-systems`.
- Security: OWASP ASI06 (Memory & Context Poisoning), and the Data Privacy risk in NIST AI 600-1. Cover data sent to model providers and data captured by tracing as separate exposure paths.
- Visual: Where user data travels (model provider, memory, logs, traces, backups) and the controls at each stop. Format: Mermaid data-flow diagram exported to SVG, with a control annotation on each store (scope, redaction, retention).

#### security/sandboxing-and-code-execution.md
- Question: If an agent runs code or shell commands, how do I contain what that code can reach?
- Outcome: The reader can choose an isolation level (for example process, container, or microVM) based on risk, and can restrict network egress, file system access, credentials, CPU and memory, and run time.
- Prereqs: `tool-permissions-and-excessive-agency`.
- Security: OWASP ASI05 (Unexpected Code Execution). Keep isolation claims specific to a named, versioned technology. Don't describe any sandbox as escape-proof.
- Visual: What a sandbox does and doesn't contain when an agent runs code. Format: Hand-authored SVG of nested boxes (host, sandbox, process), with labeled blocked and allowed paths for network, file system, and credentials.

#### security/human-approval-for-sensitive-actions.md
- Question: Which agent actions need a person to approve them, and how do I design approvals that people won't just click through?
- Outcome: The reader can classify actions by impact and reversibility, place approval gates, show approvers the exact action and data involved, and handle timeouts and rejections safely.
- Prereqs: `tool-permissions-and-excessive-agency`, `prompt-injection-in-agent-systems`.
- Security: OWASP ASI09 (Human-Agent Trust Exploitation), and the Human-AI Configuration risk in NIST AI 600-1, including automation bias. An approval step reduces risk only if it is enforced in the application and the approver gets meaningful information.
- Visual: The approval lifecycle: proposed, pending, approved, rejected, timed out. Format: Mermaid state diagram exported to SVG. Add an optional static mockup of an approval card, labeled "Illustrative mockup", showing the exact action and data.

#### architecture/build-a-minimal-agent-in-typescript.md
- Question: What does the smallest working agent look like when I write it myself in TypeScript, without a framework?
- Outcome: The reader runs a local shipment-tracking agent with one model client, one read-only mock tool, a bounded loop with step, time, and token limits, and structured logs. That gives them the baseline that `choosing-an-agent-framework` asks for.
- Prereqs: `the-agent-loop`, `tool-calling-and-control-flow`. Requires Node.js and an API key or Entra ID access for one model provider.
- Security: No write tools yet, an explicit stop on every limit, tool output treated as untrusted, and no secrets in source, prompts, or logs.
- Visual: The project layout and what happens during one run. Format: Numbered tutorial steps. A text code block for the project file tree. A Mermaid sequence diagram of one run that shows where each limit is checked. Terminal output as a code block, not a screenshot.

#### architecture/add-tools-and-permissions.md
- Question: How do I add more tools to my agent, including one that changes data, without giving it more authority than the task needs?
- Outcome: The reader adds a second read tool and one write tool (for example, "request a delivery reschedule"). They define strict argument schemas, enforce per-user authorization inside the tool handler, separate read and write permissions, and require explicit approval before the write runs.
- Prereqs: `build-a-minimal-agent-in-typescript`, `tool-permissions-and-excessive-agency`, `human-approval-for-sensitive-actions`.
- Security: Puts least privilege into code (OWASP ASI02 and ASI03). Show an ID-tampering attempt, such as asking about another user's shipment, being rejected by the server-side check rather than by the prompt.
- Visual: How read and write tools differ, and how an ID-tampering attempt is rejected. Format: Numbered tutorial steps. A Markdown permissions table. A Mermaid sequence diagram with two branches: an approved write, and a rejected attempt to read another user's shipment.

#### architecture/add-state-and-handle-tool-errors.md
- Question: How should my agent keep conversation state and recover when a tool fails, times out, or returns something unexpected?
- Outcome: The reader adds per-conversation state with a size limit, classifies tool errors (validation error, authorization denial, timeout, upstream failure), retries only idempotent reads with a cap and backoff, and returns a clear partial result instead of an invented answer.
- Prereqs: `add-tools-and-permissions`, `context-memory-and-retrieval`.
- Security: Never automatically retry a write. Don't put raw error details or stack traces into model context or user replies. State is scoped per user and is not shared memory.
- Visual: What happens after each kind of tool outcome. Format: Numbered tutorial steps. A Mermaid state diagram of tool-call outcomes, exported to SVG.

#### architecture/evaluate-agent-behavior-locally.md
- Question: How do I know my agent does the right thing, and that a change didn't break it, before deploying?
- Outcome: The reader builds a small, versioned test set that covers happy paths, invalid input, unauthorized lookups, tool failures, and injected instructions inside tool output. They check tool selection and arguments deterministically wherever possible, add model-graded checks only where needed (with their limits explained), and run the suite locally and in CI.
- Prereqs: `add-state-and-handle-tool-errors`.
- Security: Security cases are part of normal regression testing from the start. `evaluating-agent-security` goes deeper.
- Visual: How the local evaluation suite runs and gates changes. Format: Numbered tutorial steps. A Mermaid flowchart of the test harness. A Markdown table of test categories. Sample test output as a code block.

#### security/threat-modeling-an-agent.md
- Question: How do I systematically threat-model a specific agent before shipping it?
- Outcome: The reader threat-models the Stage 4 shipment agent, going from the system description to assets, trust boundaries, attack paths, controls, validation steps, and residual risk.
- Prereqs: All Stage 3 articles, and `add-tools-and-permissions`.
- Security: Use the OWASP Agentic Top 10 as a checklist of risk categories to consider and the NIST AI RMF functions (Govern, Map, Measure, Manage) to organize the process. State that covering every category doesn't make a system secure.
- Visual: The full threat model of the shipment agent: data flows, trust boundaries, and numbered attack paths. Format: Hand-authored SVG (needs precise placement) with numbered markers T1–Tn that match a Markdown table of threat, control, test, and residual risk. The table is the complete text equivalent.

#### security/evaluating-agent-security.md
- Question: How do I test whether my agent's security controls actually work?
- Outcome: The reader extends the local test set from `evaluate-agent-behavior-locally` with adversarial cases (direct and indirect injection, permission escalation, ID tampering, runaway loops) and keeps them in CI.
- Prereqs: `threat-modeling-an-agent`, `evaluate-agent-behavior-locally`.
- Security: Testing corresponds to the NIST "Measure" function. Report results as evidence about specific scenarios, not as certification or a penetration test.
- Visual: Where adversarial test cases enter the system, and which control each one tests. Format: Mermaid flowchart showing injection points at each trust boundary, plus a Markdown table mapping each control to its test.

#### frameworks/framework-comparison-by-use-case.md
- Question: For a few common use cases, how do current frameworks compare when built against the same task?
- Outcome: The reader sees the method from `choosing-an-agent-framework` applied to the Stage 4 agent as a baseline, with stated evaluation dates and versions.
- Prereqs: `evaluate-agent-behavior-locally`.
- Security: Compare how each framework handles tool authorization, state storage and retention, tracing of sensitive data, and human approval. Note that dependencies are supply-chain risks (OWASP ASI04).
- Visual: Differences between candidates on the same criteria. Format: Markdown tables, one per use case, with the evaluation date in the caption. Add a small Mermaid control-flow diagram per framework only where their control models genuinely differ.

#### deployment/reliability-cost-and-runaway-loops.md
- Question: How do I keep an agent from looping forever, retrying unsafe actions, or running up unexpected cost in production?
- Outcome: The reader can set step, time, token, and spend budgets, add circuit breakers and alerts on budget breaches, and return useful partial results when a limit is hit.
- Prereqs: `add-state-and-handle-tool-errors`.
- Security: Denial of service and resource exhaustion, and failures spreading across tools or agents (OWASP ASI08). Point out that platform billing based on concurrency (see Stage 8) turns runaway sessions into a direct cost risk.
- Visual: The budget guards around the loop and how a circuit breaker changes state. Format: Mermaid flowchart of the budget checks, plus a Mermaid state diagram of the circuit breaker (closed, open, half-open), both exported to SVG.

#### deployment/deploying-an-agent.md
- Question: What has to be true before any agent goes to production, whatever platform it runs on?
- Outcome: The reader can work through a platform-neutral release checklist: evaluations passing, threat model reviewed, limits and approvals enforced, secrets out of code, least-privilege identity, rollback plan, kill switch, and an owner for incidents.
- Prereqs: `evaluating-agent-security`, `reliability-cost-and-runaway-loops`.
- Security: Supply chain and dependency review (OWASP ASI04, and the Value Chain and Component Integration risk in NIST AI 600-1).
- Visual: The release path from build to staged rollout, with gates and a rollback route. Format: Mermaid flowchart exported to SVG. The checklist itself stays a Markdown list, not an image.

#### deployment/choose-an-azure-agent-hosting-option.md
- Question: Should my agent run as a Foundry prompt agent, a Foundry hosted agent, or my own container on Azure Container Apps?
- Outcome: The reader can tell the three options apart and pick one for the shipment agent.
- Security: Compare the default exposure and authentication model of each option, where secrets live, and who patches the runtime.
- Visual: What you own and what Azure manages in each of the three options, and how to choose between them. Format: 1) A hand-authored SVG with three columns (prompt agent, hosted agent, Container Apps) and stacked layers (endpoint and auth, orchestration code, runtime and compute, identity, network, telemetry), each labeled "You" or "Azure" in text. 2) A Mermaid decision flowchart. 3) The comparison table as the text equivalent.

#### deployment/deploy-a-prompt-agent-to-foundry.md
- Question: How do I turn the shipment assistant's instructions and tool definitions into a managed Foundry prompt agent and call it from code?
- Prereqs: - An Azure subscription, and a Foundry resource and project in a region that supports agents and the chosen model.
- Security: - Give callers the Foundry Agent Consumer role so they can only invoke, keeping building rights separate from invoking rights.
- Visual: The deployment and invocation flow: where the agent definition lives and which identity calls what. Format: Numbered tutorial steps. A Mermaid deployment-flow diagram whose numbers match the steps, exported to SVG. Avoid portal screenshots because the UI changes often. If one is essential, crop it, date it in the caption, and give it alt text.

#### deployment/deploy-a-hosted-agent-to-foundry.md
- Question: How do I run my own agent code on Foundry hosted agents, and what does the platform handle for me?
- Prereqs: - An Azure subscription, and a region where hosted agents are available.
- Security: - Each hosted agent gets a dedicated Entra agent identity. The project's managed identity is separate and used for platform tasks such as image pulls.
- Visual: How code moves from a local machine to a running hosted-agent session, and which identity does each job. Format: Numbered tutorial steps. A Mermaid deployment-flow diagram exported to SVG. Command output as code blocks.

#### deployment/configure-azure-agent-identity-rbac-and-secrets.md
- Question: Which identities does my Azure agent use, what should each be allowed to do, and where should secrets live?
- Outcome: The reader can map the identities in each option, assign least-privilege roles at the narrowest scope, and remove stored secrets wherever Entra ID can replace them.
- Prereqs: One Stage 8 tutorial, and `tool-permissions-and-excessive-agency`.
- Security: OWASP ASI03 (Identity and Privilege Abuse). Prefer Entra ID over keys. Avoid broad Owner or Contributor grants for runtime identities. Review role definitions before assigning them.
- Visual: Every principal, the role it holds, and the scope of that role. Format: Hand-authored SVG or Mermaid flowchart (principal, then role, then scope), plus a Markdown table as the complete text equivalent. Label principals with their type (human, managed identity, agent identity) in text, not by color.

#### deployment/azure-networking-and-private-access.md
- Question: How do I keep my Azure agent, its model, and its tools off the public internet, and what breaks when I do?
- Outcome: The reader can choose between public, restricted-public, and private topologies, and can configure private access for the option they deployed.
- Prereqs: One Stage 8 tutorial, and `configure-azure-agent-identity-rbac-and-secrets`.
- Security: Limit inbound exposure, keep tool traffic private, and allow outbound access only to approved destinations. Explain that private networking reduces exposure but doesn't stop a compromised agent from misusing the tools and data it can already reach.
- Visual: The private topology for each option: subnets, private endpoints, private DNS, and allowed outbound paths. Format: Hand-authored SVG network diagrams (precise layout needed), one for Foundry standard setup with private networking and one for an internal Container Apps environment. Add a Markdown table of DNS zones and endpoints. Give long descriptions in the text.

#### deployment/monitor-version-and-roll-back-an-azure-agent.md
- Question: How do I see what my Azure agent is doing, ship new versions safely, and roll back when something goes wrong?
- Outcome: The reader can connect Application Insights, read traces of model and tool calls, release a new version to a small share of traffic, and return traffic to the previous version.
- Prereqs: One Stage 8 tutorial, and `deploying-an-agent`.
- Security: Traces can contain user data and tool results, so plan redaction, retention, and access. Alert on authorization failures, unusual tool use, and cost spikes. Keep the kill switch and rollback procedure tested.
- Visual: The anatomy of one trace, and a staged rollout with a rollback path. Format: Two Mermaid diagrams exported to SVG: span nesting for one agent turn, and a rollout flow (version 1 at 100%, then version 2 at 10%, then 100% or a rollback to version 1). Give one variant each for Foundry version routing and Container Apps revision weights.

#### deployment/monitoring-and-incident-response.md
- Question: Once an agent is live on any platform, how do I detect misbehavior and respond when something goes wrong?
- Outcome: The reader can define alerts for anomalous tool use, cost spikes, and permission denials, and can write an incident runbook covering containment (disabling the endpoint, revoking credentials or roles, rolling back), investigation from traces, and follow-up.
- Prereqs: `monitor-version-and-roll-back-an-azure-agent`, or equivalent telemetry on another platform.
- Security: OWASP ASI10 (Rogue Agents) and the NIST "Manage" function. Incident findings should feed back into the threat model and the evaluation set.
- Visual: The incident lifecycle and the containment options. Format: Mermaid flowchart exported to SVG. The runbook steps stay a numbered Markdown list.
