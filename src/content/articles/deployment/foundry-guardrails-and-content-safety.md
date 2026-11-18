---
title: "Foundry Guardrails and Content Safety: A Mitigation Layer, Not a Boundary"
description: What Microsoft Foundry guardrails check, at which points in an agent's run, and what they can't stop. How guardrails apply to models, prompt agents, and hosted agents, where task adherence fits, and why the shipment agent's real boundaries stay in its code.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-18
order: 12
stage: 8
stageOrder: 10
readingMinutes: 7
tags: [deployment, foundry, azure, guardrails, content-safety, security]
featured: false
draft: false
---

Microsoft Foundry can screen what goes into and comes out of a model or an agent: harmful content, prompt injection attempts, personal data, and tool calls that don't match what the user asked for. Foundry calls these checks guardrails. They're useful, and they're also easy to over-trust. A guardrail is a classifier that flags content it recognizes. It doesn't decide what the agent is allowed to do, and an attacker can sometimes write content it doesn't recognize.

This article explains what Foundry's guardrails check and where, how they apply to each hosting option from [Choose an Azure Agent Hosting Option](/learn/deployment/choose-an-azure-agent-hosting-option/), and how they fit next to the controls that actually bound the shipment agent. It was checked against Microsoft Learn on 2026-11-18, when agent guardrails were in preview.

## Risks, intervention points, and actions

Learn describes a guardrail as "a named collection of controls". Each control names a risk to detect, the point in the run where it checks, and the action to take. The risks are detected by classification models from Azure AI Content Safety.

Risks, with whether they apply to models and to agents on 2026-11-18:

| Risk | Models | Agents (preview) |
| --- | --- | --- |
| Hate, sexual, self-harm, violence | Yes | Yes |
| User prompt attacks (direct prompt injection) | Yes | Yes |
| Indirect attacks (instructions hidden in documents or tool results) | Yes | Yes |
| Protected material, for code and for text | Yes | Yes |
| Personally identifiable information (preview) | Yes | Yes |
| Task adherence (preview) | Yes | Yes |
| Spotlighting (preview) | Yes | No |
| Groundedness (preview) | Yes | No |

Intervention points are where in the run a control checks:

| Intervention point | What's checked | Models | Agents |
| --- | --- | --- | --- |
| User input | The prompt sent to the model or agent | Yes | Yes |
| Tool call (preview) | The tool and the data the agent proposes to send to it | No | Yes |
| Tool response (preview) | What the tool returns, before the agent reads it | No | Yes |
| Output | The final answer returned to the user | Yes | Yes |

For harm categories, each control has a blocking level: low blocks only high-severity content, high blocks low, medium, and high. When a control finds something, models can annotate or annotate and block; agents can only annotate and block. Learn notes that turning content filtering off for outputs requires approval from Microsoft.

## Which guardrail applies

The inheritance rules are where most surprises come from:

- Models get the `Microsoft.DefaultV2` guardrail by default.
- An agent uses the guardrail assigned to it. If none is assigned, it inherits its model deployment's guardrail.
- Once an agent has its own guardrail, Learn says it "fully overrides the model's guardrail". In Learn's example, a model with violence detection at high and an agent with violence detection at low for input and output, but nothing for tool calls, ends up checking input and output at low and not checking tool calls or tool responses at all.
- Some preview risks, such as groundedness and spotlighting, don't apply to agents yet. A guardrail that includes them still applies them to models, but silently skips them for agents.

Two scope limits matter for the shipment agent in particular. First, Learn states that the guardrail system "applies to all Foundry Models sold by Azure." Claude is a partner model, not a model sold by Azure (see [Foundry Models](/learn/deployment/foundry-models/)), so don't assume a Claude deployment has a model-layer guardrail. Check the model's own documentation. Second, Learn says the guardrail system currently applies only to agents built in Foundry Agent Service, not to agents registered from elsewhere.

## Hosted agents

A hosted agent's guardrail is opt-in. Learn's hosted-agent content safety page says that if the agent definition omits `rai_config`, "the agent runs without a content safety guardrail at the hosted-agent boundary." Including `rai_config` without naming a policy applies `Microsoft.DefaultV2`. This boundary guardrail is independent of any guardrail on a model deployment the agent calls.

For the hosted shipment agent from the [hosted agent tutorial](/learn/deployment/deploy-a-hosted-agent-to-foundry/), the boundary guardrail can check the customer's input and the agent's final answer. Its tool calls are different: the agent's code calls the shipment tools directly, inside its own loop, so they never pass through Foundry as tool calls, and the tool-call and tool-response intervention points don't see them. If you want those checks for your own tools, they belong in your code.

Learn's hosted-agent page is explicit about what guardrails aren't: content safety "doesn't cover network egress controls or replace authorization, data loss prevention, tool permissions, or human approval for consequential actions." Hosted agents also have network egress controls, a separate feature that limits which outbound connections the agent can make, which Learn lists as generally available apart from transform rules.

## Task adherence

Task adherence (preview) is the guardrail closest to agent security. Learn describes it as detecting "tool actions that are misaligned with user goals or input intent", improper tool input or output, and answers that don't match what the customer asked, with reasoning when it flags a call. Its stated purpose includes providing "a signal for downstream tool invocation blocking and escalation to human-in-the-loop (HITL) review".

For the shipment agent, that's the scenario where a customer asks for a status update and the agent, steered by injected text, tries to book a redelivery. Task adherence might flag it. The approval prompt and the ownership check stop it, whether or not anything flags it. Use task adherence as an extra signal, and as something to alert on, not as the thing that decides.

## How guardrails fit with the shipment agent's controls

| Threat | Guardrail that may help | Control that bounds it |
| --- | --- | --- |
| A customer types an injection attempt | User prompt attacks | Tools check ownership from the session; bookings need the customer's approval |
| A document or tool result carries hidden instructions | Indirect attacks, tool response (preview) | Retrieved and tool content is treated as data; tool-side checks still apply |
| The agent tries an action the customer didn't ask for | Task adherence (preview) | Approval for every write, from values in your records |
| The answer leaks personal data | PII (preview) | Tools return only the signed-in customer's data; logs hold no message text |
| A runaway loop runs up cost | None | Step, time, token, and spend budgets |

The right-hand column is enforced by code you wrote and tested in the earlier tutorials, and it holds whatever the content looks like. The middle column reduces how often bad content gets through, and gives you signals to alert on. That's the sense in which guardrails are a mitigation layer.

## Security implications

- No classifier fully prevents prompt injection. Prompt attack and indirect attack detection catch patterns they recognize, and new phrasings get through. [Prompt Injection in Agent Systems](/learn/security/prompt-injection-in-agent-systems/) explains why the controls that matter limit what a successful injection can do. OWASP's Top 10 for Agentic Applications (2026) lists the goal of these attacks as Agent Goal Hijack (ASI01).
- Check which guardrail is actually applied. Because an agent's guardrail fully overrides its model's, and some risks are skipped for agents, the effective policy can be weaker than the one on the model. Verify the assigned guardrail for each agent, and include tool-call and tool-response controls deliberately.
- Plan for blocks. A blocked request is a normal outcome: the hosted agent page notes that a blocked tool call stops the agent until the next user input. Give the customer a clear message, log the block without the content, and alert on block rates as in [Reliability, Cost, and Runaway Loops](/learn/deployment/reliability-cost-and-runaway-loops/).
- Test with your adversarial cases. Run the cases from [Evaluating Agent Security](/learn/security/evaluating-agent-security/) against the deployed agent with its guardrail on. The guardrail should block some of them, and the code should stop all of the ones that matter.

## What to learn next

Guardrails act on each request. The next article, Foundry Evaluations, Tracing, and Red Teaming, covers measuring the agent's behavior across many requests: built-in evaluators, traces of each run, and the AI Red Teaming Agent.
