---
title: "Monitor, Version, and Roll Back an Azure Agent"
description: Watch what the shipment agent does on Azure, release a new version safely, and move traffic back when it misbehaves. Foundry hosted-agent versions and endpoint pinning, a customer cohort for prompt agents, Container Apps revision weights, and Foundry's disable switch, with the routing code in TypeScript and Python.
topic: Deployment
level: Advanced
publishedAt: 2026-11-18
order: 15
stage: 8
stageOrder: 13
readingMinutes: 10
tags: [deployment, foundry, azure, monitoring, rollout, rollback, typescript, python]
featured: false
draft: false
---

[Deploying an Agent](/learn/deployment/deploying-an-agent/) described a release path that ends with a staged rollout and a way back: send a small share of customers to the new version, watch, then promote it or roll back. This article does that on Azure for the shipment agent. It covers what to watch, how each hosting option versions the agent, how to send some traffic to a new version (which Foundry hosted agents can't do by percentage), and how to roll back or switch the agent off.

It was checked against Microsoft Learn on 2026-11-18. The commands come from Learn's pages and weren't run against a live subscription. The routing code was type-checked and tested for identical behavior in both languages.

## What to watch

Three sources together give you a working picture:

- Traces. Connect Application Insights to the Foundry project, as described in [Foundry Evaluations, Tracing, and Red Teaming](/learn/deployment/foundry-evaluations-tracing-and-red-teaming/), so each run is recorded as a trace.
- Logs. The shipment agent's own events from Stage 4 and Stage 7 (`model_response`, `tool_call`, `budget_breach`, `circuit_open`) go to the container's output. For a hosted agent, Learn's quickstart streams them with `azd ai agent monitor --follow`. For Container Apps, they go to Log Analytics.
- Metrics. Azure Monitor shows token use, latency, request counts, and errors at the Foundry resource level, and agent activity at the project level.

One trace is a tree of spans for one question:

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Timeline of the nested spans in one traced agent turn. Scrolls horizontally on small screens.">

![A timeline of about four seconds. The root span, invoke_agent shipment-hosted, covers the whole turn. Inside it, in time order: a chat span for claude-opus-5-5, step 1, with tokens in and out and stop reason tool_use; an execute_tool span for get_shipment_status, which contains an HTTP call to the carrier; and a second chat span for claude-opus-5-5, step 2, which writes the answer with stop reason end_turn. A note says that span names, durations, model, token counts, tool name, and status are safe to show widely; that tool arguments and results and message text are sensitive and should be redacted or kept in a restricted table; and that calls your code makes directly appear only if that code is instrumented.](../../../assets/diagrams/deployment/agent-trace-anatomy.svg)

</div>
<figcaption>The spans in one traced question. Span names follow the OpenTelemetry GenAI conventions.</figcaption>
</figure>

**How to read the diagram.** Read left to right for time, and top to bottom for nesting. The outer span is the whole question. Each model call and each tool call is a child span, and the carrier call nests inside the tool call that made it. A slow answer shows up as a long bar, and a loop shows up as many repeated chat and tool spans under one root.

Build alerts on top of these. The rules from [Reliability, Cost, and Runaway Loops](/learn/deployment/reliability-cost-and-runaway-loops/) cover budgets, the breaker, and spend. The roadmap for this track adds three more that matter for security:

| Signal | Where it comes from | What a rise usually means |
| --- | --- | --- |
| Authorization failures | `not_found` and `denied` tool results; 401 and 403 responses from your services | Someone probing other customers' packages, or a broken role assignment after a release |
| Unusual tool use | `tool_call` counts per tool and per question | A prompt injection steering the agent, or a prompt change that made it call tools differently |
| Cost spikes | Token metrics, `model_response` spend | A loop, longer answers after a model change, or abuse |

Compare each signal for the new version against the current version during a rollout. That comparison is what decides whether to promote.

## Versions

Each option has its own unit of release:

| Option | Unit | How it's created | Immutable? |
| --- | --- | --- | --- |
| Prompt agent | Agent version | `createVersion` / `create_version`, as in the [prompt agent tutorial](/learn/deployment/deploy-a-prompt-agent-to-foundry/) | Yes; a change creates a new version |
| Hosted agent | Agent version | Each `azd deploy`, or the SDK | Yes |
| Container Apps | Revision | Each change to the app's template | Yes |

For hosted agents, Learn's "Manage hosted agents" page lists version statuses (`creating`, `active`, `failed`, `deleting`, `deleted`) and says a new version typically takes 2 to 5 minutes to become `active`. Wait for `active` before testing it.

## Releasing a new version

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Rollout and rollback steps on Foundry hosted agents and on Container Apps. Scrolls horizontally on small screens.">

![Two rows. Foundry hosted agent, where one version gets 100% and there's no percentage split: 1, pin v1, at 100%; 2, deploy v2, which gets no traffic; 3, test v2 in a pinned test session; 4, promote, so v2 gets 100%. A dashed rollback arrow returns from step 4 to step 1: restore the selector to v1, and existing sessions keep their version. A note says that to put a cohort on v2 first, your app pins the version per request, for prompt agents through agent_reference.version. Container Apps, in multiple revision mode, where weights must total 100%: 1, revision 1 at 100%; 2, a canary with revision 2 at 10% and revision 1 at 90%; 3, full rollout with revision 2 at 100%. A dashed rollback arrow returns from step 2 to step 1: revision 1 back to 100%.](../../../assets/diagrams/deployment/agent-rollout.svg)

</div>
<figcaption>Promotion and rollback on each platform. Foundry moves the whole endpoint at once; Container Apps can split by percentage.</figcaption>
</figure>

**How to read the diagram.** Solid arrows move forward and dashed arrows go back. The two rows differ in the middle: Container Apps has a canary step that splits traffic by percentage, and the Foundry row doesn't, because a Foundry agent endpoint serves one version at a time.

### Foundry hosted agents: pin, test, promote

Learn is explicit: "An agent endpoint routes 100% of its traffic to one agent version," and "Traffic splitting between agent versions isn't supported." By default the endpoint follows the latest version, so deploying a new version changes what customers get. Learn's "Release a version without changing production" procedure avoids that:

1. Record and pin production. Set the endpoint's version selector to the current version, with one `FixedRatio` rule at 100%.
2. Create the candidate with `azd deploy` or the SDK, and record its version number. Don't resolve "latest" again later.
3. Wait until the candidate is `active`, and confirm its image and configuration are the ones you meant to release.
4. Test it in a session pinned to the candidate version. Learn says to check for a successful completion and the expected content, not just for logs or a connection.
5. Promote by setting the selector to the candidate at 100%, after checking production still points at the version you recorded.
6. Verify with a new session. To roll back, restore the previous selector.

Pinning uses a PATCH on the agent, as in Learn's example:

```bash
az rest --method PATCH --resource "https://ai.azure.com" \
  --url "https://shipment-foundry.services.ai.azure.com/api/projects/shipment-assistant/agents/shipment-hosted?api-version=v1" \
  --headers "Content-Type=application/merge-patch+json" \
  --body '{"agent_endpoint": {"version_selector": {"version_selection_rules": [
            {"agent_version": "3", "traffic_percentage": 100, "type": "FixedRatio"}]},
          "protocol_configuration": {"responses": {}}}}'
```

Two details from Learn change how rollback behaves. Existing sessions are bound to the version they started on, so changing the selector affects new sessions only. And "Deleting the agent or a version isn't a rollback operation": keep previous versions and their images until nothing depends on them. Learn also warns that `azd deploy` applies the endpoint settings in your configuration, so check that a deploy doesn't overwrite your pin.

### A cohort on the new version

Since Foundry can't split one endpoint by percentage, a staged rollout to a share of customers has to happen in your application. For a prompt agent, the request's `agent_reference` can name a version. Your application can send a fixed share of customers to the candidate and everyone else to the stable version:

<div class="code-tabs">

```ts
// foundry/rollout.ts
import { createHash } from "node:crypto";

export type Rollout = { stable: string; candidate: string | null; candidatePercent: number };

// Puts each customer in a fixed bucket from 0 to 99, so the same customer always gets the same version.
export function bucketFor(customerId: string): number {
  return createHash("sha256").update(customerId).digest().readUInt32BE(0) % 100;
}

// The agent version this customer's request should use.
export function versionFor(customerId: string, rollout: Rollout): string {
  if (rollout.candidate === null) return rollout.stable;
  return bucketFor(customerId) < rollout.candidatePercent ? rollout.candidate : rollout.stable;
}

// The body field that names the agent and pins the version, for a prompt agent.
export function agentReference(name: string, customerId: string, rollout: Rollout) {
  return { agent_reference: { type: "agent_reference", name, version: versionFor(customerId, rollout) } };
}
```

```python
# foundry/rollout.py
import hashlib
from dataclasses import dataclass


@dataclass(frozen=True)
class Rollout:
    stable: str
    candidate: str | None
    candidate_percent: int


# Puts each customer in a fixed bucket from 0 to 99, so the same customer always gets the same version.
def bucket_for(customer_id: str) -> int:
    return int.from_bytes(hashlib.sha256(customer_id.encode()).digest()[:4], "big") % 100


# The agent version this customer's request should use.
def version_for(customer_id: str, rollout: Rollout) -> str:
    if rollout.candidate is None:
        return rollout.stable
    return rollout.candidate if bucket_for(customer_id) < rollout.candidate_percent else rollout.stable


# The body field that names the agent and pins the version, for a prompt agent.
def agent_reference(name: str, customer_id: str, rollout: Rollout) -> dict[str, dict[str, str]]:
    return {"agent_reference": {"type": "agent_reference", "name": name, "version": version_for(customer_id, rollout)}}
```

</div>

Each customer's bucket comes from a hash of their ID, so the same customer always gets the same version for the whole rollout. Customers don't flip between versions mid-conversation, and a complaint can be traced to a version. With a 10% rollout, 117 of 1,000 test IDs landed on the candidate in both languages, and both versions computed the same bucket for every ID.

For a hosted agent, the comparable approach is a second agent for the candidate, such as `shipment-hosted-next`, with your application sending the cohort to its endpoint. That doubles the agents to manage, so for most releases the pin, test, and promote procedure above is enough.

### Container Apps: revision weights

Container Apps can split traffic by percentage. Learn's traffic splitting page explains that with multiple revision mode, you set a weight for each active revision, and the weights must total 100%:

```bash
az containerapp ingress traffic set --name shipment-agent --resource-group shipment-agent-rg \
  --revision-weight shipment-agent--v1=90 shipment-agent--v2=10
```

Promote by moving the weights to 0 and 100, and roll back by moving them back. Revision labels (`--label-weight`) let you refer to `stable` and `canary` instead of revision names. A plain percentage split sends any request anywhere, so a customer's follow-up question can land on the other revision. If the agent keeps state between turns, use a cohort in your application as above, or session affinity on ingress.

## When to roll back, and how to stop everything

Decide the rollback triggers before the rollout starts, as the release checklist says. For example: authorization failures or tool calls per question noticeably above the stable version's, any rise in budget breaches, or a failed spot-check of answers. Then act on them without a debate.

When a rollback isn't fast enough, stop the agent. Foundry has a built-in switch for that: Learn's management page describes disabling an agent, which takes its endpoint offline without deleting it or its versions, and is reversible:

```bash
az rest --method POST --resource "https://ai.azure.com" \
  --url "https://shipment-foundry.services.ai.azure.com/api/projects/shipment-assistant/agents/shipment-hosted:disable?api-version=v1"
```

Learn notes this wasn't available in the JavaScript/TypeScript SDK on 2026-11-18, so use the REST call from any language. The application-level kill switch from [Deploying an Agent](/learn/deployment/deploying-an-agent/) is still worth having, because its `read_only` mode stops bookings while the agent keeps answering status questions. Disabling the agent stops everything.

## Security implications

- Traces need access control and retention. Every span with tool arguments or results holds customer data. Restrict who can read that content, set a retention period, and redact what you don't need, as Learn's tracing guidance advises.
- Alert on authorization failures, not just errors. A spike in `not_found` results for package lookups is what probing looks like from the inside. It's also the first sign that a release broke a role assignment.
- Keep the way back working. Keep previous versions and images, test the rollback procedure in staging, and make sure the people on call can run the disable command. The NIST AI Risk Management Framework's Manage function covers having these response plans in place before you need them.
- Releases change behavior even without code changes. A new prompt, model, or tool description is a new version. Put it through the same pin, test, and promote steps.

## What to learn next

The last article in this track, Monitoring and Incident Response, applies all of this to the bad day: detecting misbehavior, containing it, investigating from traces, and feeding what you learn back into the threat model and the evaluation suite.
