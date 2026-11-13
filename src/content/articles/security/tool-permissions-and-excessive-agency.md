---
title: "Tool Permissions and Excessive Agency: Give Agents Only What the Task Needs"
description: How to apply least privilege to an agent's tools, with separate read and write tools, user-scoped short-lived credentials, per-tool limits, and approval for high-impact actions.
topic: Security
level: Intermediate
publishedAt: 2026-11-11
updatedAt: 2026-11-13
order: 2
readingMinutes: 9
tags: [security, permissions, least-privilege, excessive-agency, owasp]
featured: false
draft: false
---

An agent can only do what its tools allow, with the credentials those tools use. That makes tool permissions the most direct control you have over how much damage a confused or manipulated agent can cause. If the model is tricked into calling the wrong tool, permissions decide whether the result is an error message or a real incident.

This article applies least privilege to the shipment assistant from earlier articles. It assumes you've read [Trust Boundaries for Agent Systems](/learn/security/trust-boundaries-for-agents/) and [Tool Calling and Control Flow](/learn/architecture/tool-calling-and-control-flow/).

## What "excessive agency" means

OWASP's Top 10 for LLM Applications (2026 edition) lists excessive agency as LLM03:2026 (it was LLM06 in the 2025 edition): a system that can take damaging actions because a model's output was unexpected, ambiguous, or manipulated. OWASP names three root causes:

- Excessive functionality: tools the task doesn't need, or tools that can do more than intended.
- Excessive permissions: tools that reach systems with broader access than the task needs.
- Excessive autonomy: high-impact actions that run without a check or approval.

The OWASP Top 10 for Agentic Applications (2026) builds on this. Tool misuse (ASI02) covers agents using legitimate tools in harmful ways. Identity and privilege abuse (ASI03) covers agents that reuse, escalate, or leak the credentials and access they inherit. Both lists rest on the same idea, which the agentic list calls least agency: give an agent only the tools, access, and autonomy the task requires.

## Rule 1: Split read tools from write tools

Reading and changing things carry different risks, so they belong in different tools. In the shipment assistant, `getShipmentStatus` only reads, and `requestRedelivery` changes a booking.

Separate tools let you:

- offer read tools freely and add checks only where something changes
- give each tool its own credential scope
- require approval for writes without slowing down reads
- see in your logs exactly when the agent tried to change something

Avoid general-purpose tools that do both. A tool like `updateShipment(fields)` or `runQuery(sql)` turns one narrow capability into many, and the model will eventually use the extra range.

## Rule 2: Act as the user, not as the application

The most common permission mistake is a tool that calls downstream services with one powerful application account. The agent can then reach every customer's data, and the only thing keeping it to the right customer is the model's judgment.

Instead, every tool call should carry the identity of the person the agent is working for, and the downstream service should check that identity itself:

- Take the user's identity from the signed-in session, never from tool arguments. If `customerId` is an argument, a manipulated model can pass someone else's.
- Check ownership in the service that holds the data. The shipment service should confirm that the shipment belongs to this user before returning anything.
- Return the same response for "not yours" and "doesn't exist," so the agent can't probe for other customers' records.

A service that acts on a request without checking whose authority it carries is called a confused deputy: it uses its own broad access on behalf of someone who shouldn't have it. The Model Context Protocol's security best practices treat this as one of the main risks for MCP servers that sit in front of other APIs, and they forbid passing a client's token straight through to downstream services.

## Rule 3: Use short-lived, narrow credentials that the model never sees

Match each credential to a single task:

- Scope each token to one kind of action, such as `shipments:read` or `redelivery:write`, so it can't reach the rest of the API.
- Make tokens short-lived, measured in minutes, so a leaked one stops working quickly.
- Issue the write token only when a write is about to happen, after any approval.
- Keep tokens out of the model's context, the prompts, and the logs. The model proposes a tool call; the application attaches the credential when it runs the call.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Sequence diagram of a user-scoped token flow. Scrolls horizontally on small screens.">

![Sequence diagram with four lanes: user, application, model, and shipment service. The user signs in. The application sends the model context and tool definitions but no tokens. The model proposes getShipmentStatus. The application checks the schema and policy, then calls the shipment service with a short-lived token scoped to this user and to reading shipments. The service checks that the user owns the shipment and returns status data, which the application treats as untrusted. The model proposes requestRedelivery. The application pauses at a human checkpoint, the user approves, and the application calls the service with a separate write-scoped token and an idempotency key. The model never sees a token.](../../../assets/diagrams/security/scoped-token-flow.svg)

</div>
<figcaption>Least privilege in practice: each tool gets only the scope its task needs.</figcaption>
</figure>

**How to read the diagram.** Follow the numbers from top to bottom. Dashed arrows are proposals from the model or results from a service, and the application checks both. Credentials appear only on the application's calls to the shipment service, never on any arrow to or from the model.

## Rule 4: Put limits on every tool

Even a correctly scoped tool can do damage in volume. A redelivery tool that's fine once can be a problem when a looping agent calls it 200 times. Each tool needs limits that the application enforces:

- calls per run and per minute
- spend per run and per day, for tools that cost money
- the size of what a tool can return to the model
- a time limit on each call

Here's the permission plan for the shipment assistant:

| Tool | Read or write | Credential scope | Approval | Limit |
| --- | --- | --- | --- | --- |
| `getShipmentStatus` | Read | `shipments:read`, this user, 5 minutes | No | 30 calls per run |
| `searchHelpArticles` | Read | Public help content only | No | 10 calls per run |
| `requestRedelivery` | Write | `redelivery:write`, this user, issued per call | Yes, the customer confirms | 1 per shipment per day |
| `sendEmail` | Write | Fixed templates, this customer's own address | No, template only | 3 per run |
| Refunds | Not an agent tool | Handled by staff | Always | Not applicable |

Refunds, in the last row, aren't an agent tool at all. When an action is high value and rare, a link to a human process is often safer than a tool with an approval step.

A policy table like this can live in code, checked before every call:

```ts
type ToolPolicy = {
  access: "read" | "write";
  scope: string;
  requiresApproval: boolean;
  maxCallsPerRun: number;
};

const POLICIES: Record<string, ToolPolicy> = {
  getShipmentStatus: { access: "read", scope: "shipments:read", requiresApproval: false, maxCallsPerRun: 30 },
  searchHelpArticles: { access: "read", scope: "help:read", requiresApproval: false, maxCallsPerRun: 10 },
  requestRedelivery: { access: "write", scope: "redelivery:write", requiresApproval: true, maxCallsPerRun: 1 },
};

type Decision =
  | { kind: "run"; scope: string }
  | { kind: "needs_approval"; scope: string }
  | { kind: "deny"; reason: string };

export function checkPolicy(tool: string, callsSoFar: number, approved: boolean): Decision {
  const policy = POLICIES[tool];
  if (!policy) return { kind: "deny", reason: "tool_not_allowed" };
  if (callsSoFar >= policy.maxCallsPerRun) return { kind: "deny", reason: "limit_reached" };
  if (policy.requiresApproval && !approved) return { kind: "needs_approval", scope: policy.scope };
  return { kind: "run", scope: policy.scope };
}
```

The application calls `checkPolicy` before it requests a token for the tool, and it asks the identity service for exactly the scope the policy names. The model never chooses the scope.

## Rule 5: Require approval for high-impact actions

Approval belongs on actions that are costly, hard to undo, or visible to other people: payments, deletions, bookings, and messages sent on someone's behalf.

An approval step only helps if the person can see what they're approving:

- Show the exact action and its details, such as "Redeliver package 1Z999… on Saturday, Nov 14, to the side door," not "Approve action?"
- Ask the person with the authority to decide. For a customer's own redelivery, that's the customer. For a refund above a threshold, it's a staff member.
- Make approval expire, and tie it to that one action, so it can't be reused for a different one.

Too many prompts teach people to click "approve" without reading. Keep approval for actions where a mistake really matters, and rely on scopes and limits for the rest.

## Common mistakes

- One API key with admin access shared by every tool.
- Tools that accept a user ID, account ID, or tenant ID from the model.
- Generic tools such as HTTP fetch, shell commands, or raw SQL, offered "just in case."
- Tokens placed in the system prompt or logged with tool calls.
- Approval prompts that hide what will happen.
- No limits, so one confused run can repeat a write many times.
- MCP servers connected with broad default scopes and never reviewed.

## Checklist

1. Every tool has one job, and reads are separate from writes.
2. User identity comes from the session, and downstream services check ownership.
3. Each tool call uses a short-lived token with only the scope that tool needs.
4. The model never sees a credential.
5. Every tool has call, spend, size, and time limits enforced in code.
6. High-impact writes need approval from the right person, showing exact details.
7. High-value, rare actions stay outside the agent.

For the terms used here, see the [Agentic AI Glossary](/learn/foundations/agentic-ai-glossary/).

## What to learn next

Permissions limit how much damage a manipulated agent can do. The next article looks at how agents get manipulated in the first place: prompt injection, why tools make it worse, and what actually reduces the risk.
