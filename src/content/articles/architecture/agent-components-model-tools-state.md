---
title: "The Parts of an AI Agent: Model, Instructions, Tools, and State"
description: Learn what each part of an AI agent does, how the parts work together in the agent loop, and why the application, not the prompt, enforces the rules.
topic: Architecture
level: Beginner
publishedAt: 2026-11-04
order: 5
readingMinutes: 9
tags: [architecture, tools, state, memory, fundamentals]
featured: false
draft: true
---

An AI agent has four parts: a model, instructions, tools, and state. The model reads the context and proposes what to do next. The application around it does the rest. It runs the loop, decides what the model sees, executes tools, keeps state, and enforces every rule.

This guide covers each part, follows one turn of the [agent loop](/learn/architecture/the-agent-loop/), and ends with a table of which part enforces which rule.

## What the model does

The model is the language model that reads the context and decides what to say next or which tool to request. It does the agent's reasoning, and you can usually swap one model for another without changing the rest of the system.

There are two things the model does not do:

- It doesn't run anything. When a model "calls a tool," it returns a structured request containing a tool name and arguments. Your application executes the operation and sends the result back. For some built-in tools, the model provider runs it instead.
- It doesn't remember between calls. Each request is processed on its own. Earlier messages and previous tool results reach the model only because something stored them and sent them back.

Because the model can't act or remember on its own, every rule in an agent system ends up in the application.

## What instructions are for

Instructions are the standing guidance sent with every request. Depending on the framework, they're called instructions, an instruction, or a system prompt. Good instructions cover:

- Role and scope: what the agent helps with and what it should decline.
- Steps for the common path. Short, ordered steps work better than a dense policy document.
- When to use which tool, for example "use the status tool for any status question; never guess."
- Edge cases: what to do when a tool fails, the request is ambiguous, or the user asks for something out of scope.
- Output style: tone, length, and format.

The model can be talked out of anything written in its instructions. A cleverly worded input or a poisoned document can get it past any rule in a prompt, so some things never belong there:

| Don't put this in instructions | Put it here instead |
| --- | --- |
| Permissions, such as "only show the user their own orders" | An authorization check in the tool handler |
| Hard limits, such as "never refund more than $500" | Policy code before the tool runs, plus an approval step |
| Secrets: API keys, tokens, internal URLs | Server-side configuration or a secret store |
| Other users' data or bulk reference data | A scoped tool that fetches only what this request needs |
| Loop limits, such as "stop after five attempts" | Step, time, and cost budgets in the loop |
| Facts that change often, such as prices or policies | A data tool or a retrieval step |

To decide where a rule goes, ask: *if the agent ignored this line completely, would anything bad happen?* If so, the rule must also exist in code. You can keep it in the instructions as well, since that saves the model wasted attempts, but only the code protects you.

## Tools: name, description, and schema

A tool is a function the model may ask the application to call. The model never sees your implementation. It sees a name, a description, and an input schema.

```ts
const getShipmentStatus = {
  name: "getShipmentStatus",
  description: "Look up the current status of one of the signed-in user's shipments.",
  inputSchema: {
    type: "object",
    properties: {
      trackingId: { type: "string", description: "The shipment's tracking ID." },
    },
    required: ["trackingId"],
    additionalProperties: false,
  },
};
```

Field names vary by provider and framework, but every tool definition has these three elements. The model reads the description to decide when to call the tool, so the description is effectively part of the prompt. Keep secrets and internal details out of it.

When the model requests a call, the application runs the handler. Enforcement happens there:

```ts
async function handleGetShipmentStatus(args: { trackingId: string }, user: { id: string }) {
  const shipment = await shipments.findByTrackingId(args.trackingId);
  if (!shipment || shipment.ownerId !== user.id) {
    return { error: "not_found" }; // Same answer for "missing" and "not yours"
  }
  return { status: shipment.status, estimatedDelivery: shipment.eta }; // Only the fields needed
}
```

Tools fall into three broad groups:

- Data tools read information: look up an order, search documents, query a database.
- Action tools change something: send a message, update a record, issue a refund.
- Orchestration tools wrap another agent so it can be called like a function.

Most tools you define run in your application. Some providers also offer built-in tools, such as web search or code execution, that run on the provider's infrastructure. They save you work, but they add another party to your system's trust picture, so treat them as a separate boundary.

## State: session and long-term memory

The model forgets between calls, so the application keeps state and sends the relevant parts back each turn. Agent systems usually separate two kinds:

| | Session state | Long-term memory |
| --- | --- | --- |
| Scope | One conversation | One user or the whole app, across conversations |
| Lifetime | Ends with the session | Kept until deleted or expired |
| Contents | Messages, tool calls, results, scratch values | A few selected facts or preferences |
| How it reaches the model | Mostly sent back as-is each turn | Retrieved: only relevant items are added |
| Who decides what is saved | Usually automatic | A deliberate write by your code or a memory tool |

Session state grows with every turn, so a long conversation eventually outgrows the model's context window. Frameworks handle this by trimming or summarizing older turns.

Many agents don't need long-term memory at all. If a fact already lives in a real system, such as an order database or a customer profile, read it from there with a tool instead of copying it into memory. Memory is for information with nowhere else to live, like a preference the user stated.

## How the parts fit into the loop

Here is one turn of a shipment-tracking agent, with each step mapped to the part that does the work:

1. **Receive the task.** The user asks, "Where's my package?" The application identifies the signed-in user and loads their session state.
2. **Prepare context.** The application sends the model the instructions, the conversation so far, and the `getShipmentStatus` definition.
3. **Choose an action.** The model proposes `getShipmentStatus({ trackingId: "1Z…" })`.
4. **Check the request.** The application validates the arguments against the schema and confirms the shipment belongs to this user.
5. **Run the tool.** The handler returns only the status and delivery date.
6. **Observe.** The application saves the result to session state and sends it back to the model.
7. **Stop.** The model writes the answer, the application saves the turn, and the loop ends.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Agent parts diagram. Scrolls horizontally on small screens.">

![Component diagram. A large application box contains instructions, policy and limits, session state, and a tool gateway. The model sits outside the application and receives requests, returning proposals. Tools sit behind the gateway, the user enters from the left, a human approval step connects to policy and limits, a separate box marks provider-hosted tools, and an optional long-term memory store connects to session state.](../../../assets/diagrams/architecture/agent-components.svg)

</div>
<figcaption>Where each part of an agent lives. The model and the tools sit outside the application, which checks everything they send back.</figcaption>
</figure>

The application box holds everything the system controls: the instructions it sends, the policy and limits it enforces, the session state it keeps, and the tool gateway that checks and runs tool calls. The model sits outside the application. Requests go out to it and proposals come back. Tools are outside too, and the application reaches them only through the gateway. Dashed arrows mark anything returning to the application, whether model proposals or tool results, and all of it stays untrusted until checked. Policy and limits send high-impact actions to a human for approval. Provider-hosted tools get their own box because they run outside your application. Long-term memory is drawn as optional because many agents don't need it.

## Who enforces what

| Part | What it does | What it enforces |
| --- | --- | --- |
| Model | Reads context, proposes text or tool calls | Nothing |
| Instructions | Guide behavior and style | Nothing; guidance only |
| Application: policy and limits | Checks identity, permissions, budgets, approvals | Every rule that must hold |
| Application: tool gateway | Validates arguments, runs tools, trims results | Schemas and output limits |
| Tool service | Performs the real operation | Its own authorization, as a second check |
| State store | Keeps session state and memory | Per-user scope and retention |

## Security implications

- A rule that matters has to live in code, in the application or the tool service. Repeating it in the instructions is optional.
- Anything returning to the model may contain text an attacker wrote, including tool results, retrieved documents, and stored memories. Treat it as data, and never follow it as instructions.
- Each tool is code the model can trigger, so each one you add widens the blast radius. Give every tool the narrowest scope it needs, keep read tools separate from write tools, and require approval for consequential actions.
- Scope long-term memory per user, set a retention period, and be careful about what gets saved. Injected text stored as a "memory" gets loaded again in future sessions.
- Keep secrets out of instructions, tool descriptions, and context. All three can leak through logs, traces, or prompt-extraction attacks.

See [Trust Boundaries for Agent Systems](/learn/security/trust-boundaries-for-agents/) for how these parts map to trust zones.

## Terms used in this guide

- **Instructions:** standing guidance sent with every request. Also called a system prompt. Not the same as MCP "prompts," which are templates a user chooses to run.
- **Tool:** a function the model may request; the application or provider runs it. Also called function calling or tool use.
- **Session state:** data for one conversation. Some frameworks call it short-term memory or thread state.
- **Long-term memory:** selected data kept across conversations. Some frameworks call it a store.

## What to learn next

The next Architecture guide, on tool calling and control flow, covers what happens between the model's proposal and the tool's result: schemas, validation, errors, and parallel calls.
