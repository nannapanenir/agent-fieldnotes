---
title: "Context, Memory, and Retrieval: What the Model Sees at Each Step"
description: How an agent decides what goes into each model call, and how conversation state, a scratchpad, long-term memory, and retrieval differ in size, freshness, cost, and risk.
topic: Architecture
level: Intermediate
publishedAt: 2026-11-06
order: 7
readingMinutes: 11
tags: [architecture, context, memory, retrieval, rag, security]
featured: false
draft: false
---

A model knows nothing about your user, your product, or the conversation so far except what you send it on each call. Every step of the agent loop starts with the application deciding what goes into that call. This article covers where that information comes from, how much of it fits, and which parts you can trust.

The examples use the shipment assistant from earlier articles. A customer writes:

> Will my package get here before Friday? And if it doesn't, can you redeliver it Saturday?

To answer well, the agent needs four different kinds of information: the conversation so far, the live shipment status, the company's redelivery policy, and maybe a note from a past conversation that this customer wants packages left at the side door. Each comes from a different place and needs different handling.

## Context is a budget

The context is everything the application sends the model for one call: instructions, tool definitions, conversation history, retrieved text, and tool results. Three limits make it a budget:

- Size. Every model has a maximum context window, and everything for the step has to fit.
- Cost and speed. You pay for every token you send, on every step, and longer inputs take longer to process. A long history sent on each of ten loop steps is paid for ten times.
- Quality. Models don't use all of a long context equally well. Research on long inputs found that models use information near the start and end of the context more reliably than information buried in the middle. Extra text that isn't needed can push out or drown the text that is.

Aim for the smallest context that holds what the model needs for this step.

## Four places information lives

| | Conversation state | Scratchpad | Long-term memory | Retrieval |
| --- | --- | --- | --- | --- |
| What it holds | This conversation's messages and tool results | Working notes for the current task | Facts kept across sessions | Documents and records found by search |
| Lifetime | One session | One task | Until deleted or expired | As long as the index |
| Who writes it | The application, as the conversation happens | The model, through a tool the application controls | The application, under rules you set | Whoever writes the documents |
| Freshness | Current | Current | Can go stale | As fresh as the last index update |
| Main cost | Grows every turn | Small | Lookups, plus storage and privacy duties | Search time, plus the index |
| Shipment example | "Before Friday?" and the status lookup | "Checked 2 of 3 packages" | "Leave at side door" | The redelivery policy |

Tool results are a fifth input. They behave like conversation state: they arrive during the turn and are kept for the session.

### Conversation state

The application stores the messages and tool results for the current session and sends them back on each call, because the model forgets everything between calls. It grows with every turn, so long conversations need a plan:

- Keep the most recent turns word for word.
- Replace older turns with a short summary. This is often called compaction. The summary costs a model call to make, and anything it leaves out is gone, so keep key facts such as tracking numbers and what the customer agreed to.
- Drop or shorten old tool results once the model has used them. A full shipment record from ten steps ago rarely needs to come along again.

### Scratchpad

For longer tasks, give the agent somewhere to keep working notes outside the context: the plan, what's done, what's left. In the shipment example, a customer asking about three packages might get notes like "1Z999 delivered, 1Z888 delayed, 1Z777 not checked yet." The application stores the notes and puts the current version back in the context, so the model can pick up where it left off even after older turns are summarized.

A scratchpad usually lasts for one task. Treat it as working state, and clear it when the task ends.

### Long-term memory

Memory keeps information across sessions, so the next conversation can start with "leave at side door" already known. It's a database the application controls, and the hard questions are about what gets written:

- Decide what's worth keeping. Stable preferences and facts the customer stated are good candidates. One-off details and anything the model inferred usually aren't.
- Decide who writes. A common design lets the model propose a memory through a tool, and the application checks it against rules before saving it.
- Scope it to one user. Look up memory with the signed-in customer's ID, the same way you'd look up their orders.
- Let it expire, and let people see and delete what's stored about them.

Memory goes stale. A delivery preference from two years ago may no longer be true, so newer information, including what the customer says today, should win.

### Retrieval

Retrieval finds relevant documents or records and adds them to the context. It's often called RAG, for retrieval-augmented generation. The redelivery policy is a good fit: it's too long to send on every call, it changes occasionally, and only one section matters for this question.

There are two common ways to retrieve:

- Before the model call. The application searches using the customer's message and adds the top results to the context.
- As a tool. The model calls something like `searchPolicies(query)` when it decides it needs to. This loads text only when it's needed, at the cost of extra steps.

Retrieval is as fresh as the index. For anything that changes by the minute, like the shipment's current location, use a tool that reads the live system, because an index built last night is already out of date.

## Building the context for one step

The application assembles the context again for every step. One place in the code should own that job, so the rules apply the same way every time.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Data-flow diagram of context sources. Scrolls horizontally on small screens.">

![Data-flow diagram. Five sources feed a context builder in the application: instructions and tool definitions, written by you and trusted; conversation state, untrusted; long-term memory, untrusted; retrieved documents, untrusted; and tool results, untrusted. The builder scopes everything to the current user, selects what is relevant, trims it to a token budget, and orders and labels it, then sends the result to one model call. The context is rebuilt for every step.](../../../assets/diagrams/architecture/context-sources.svg)

</div>
<figcaption>Context is assembled per step from several sources. Retrieved and remembered content stays untrusted.</figcaption>
</figure>

**How to read the diagram.** Each box on the left is a source of text. Only the top one is content you wrote. The dashed boxes hold text from users, documents, or other systems, so the model may see instructions in them that you never wrote. Everything passes through the context builder, which decides what the model sees on this step.

The builder does four things, in order:

1. Scope to this user. Memory, retrieved records, and history are fetched for the signed-in customer only. This is an access-control step, and it belongs in the queries, before any text reaches the model.
2. Select what's relevant. Not every memory or document applies to this step.
3. Trim to a budget. Set a token budget per source, so a long tool result can't crowd out the instructions.
4. Order and label. Put instructions first, and mark where each piece came from so the model can tell your rules from retrieved text.

Here's a simplified builder in TypeScript:

```ts
type Source = "conversation" | "memory" | "retrieved" | "tool_result";

type Chunk = {
  source: Source;
  origin: string; // e.g. "policy/redelivery.md" or "getShipmentStatus"
  text: string;
  tokens: number;
  relevance: number; // 0..1, from your search or ranking step
};

// Chunks arrive already fetched for the signed-in user (step 1 happens in the queries).
export function buildContext(instructions: string, chunks: Chunk[], budget: number): string {
  const perSourceCap: Record<Source, number> = {
    conversation: Math.floor(budget * 0.4),
    tool_result: Math.floor(budget * 0.25),
    retrieved: Math.floor(budget * 0.25),
    memory: Math.floor(budget * 0.1),
  };
  const used: Record<Source, number> = { conversation: 0, memory: 0, retrieved: 0, tool_result: 0 };

  // 2. Select: most relevant first, within each source's cap.
  const selected = [...chunks]
    .sort((a, b) => b.relevance - a.relevance)
    .filter((chunk) => {
      if (used[chunk.source] + chunk.tokens > perSourceCap[chunk.source]) return false; // 3. Trim
      used[chunk.source] += chunk.tokens;
      return true;
    });

  // 4. Order and label: instructions first, then each source wrapped with its origin.
  const labeled = selected.map(
    (chunk) => `<${chunk.source} origin="${chunk.origin}">\n${chunk.text}\n</${chunk.source}>`,
  );
  return [instructions, ...labeled].join("\n\n");
}
```

A real builder also keeps conversation turns in their original order and summarizes what didn't fit. Either way, one function decides what the model sees, using rules you can test.

Labels like `<retrieved>` help the model tell your instructions apart from other text, but a determined injection can get past them. What stops it are controls in the application: what each tool may do, and the authorization checks from [Tool Calling and Control Flow](/learn/architecture/tool-calling-and-control-flow/).

## Choosing where information should live

Ask what the information is and how long it stays true:

- It's about this conversation: conversation state, summarized when it gets long.
- It's progress on a long task: a scratchpad that ends with the task.
- It's a stable fact about the user that should carry over: long-term memory, scoped to that user, with an expiry.
- It's reference material that's too big to send every time: retrieval.
- It changes minute to minute: a tool that reads the live system on demand.

## Security implications

Everything in the dashed boxes is untrusted, and two of those sources last longer than one conversation.

- Retrieved documents can contain injected instructions. A support article or a product review with hidden text can steer the model the moment it's retrieved. This is indirect prompt injection.
- Memory can be poisoned. If an attacker gets text saved to memory, it comes back in later sessions, long after the original conversation. OWASP's Top 10 for Agentic Applications (2026) lists this as ASI06, Memory and Context Poisoning.
- Scoping mistakes leak data. If memory or retrieval isn't filtered by user, one customer's details can end up in another customer's context, and the model may repeat them.

The defenses follow from the builder's job:

- Filter by user in the data layer, before text reaches the model.
- Never save memory straight from untrusted content. Save only what passes your rules, and record where each memory came from.
- Expire memories, and let users see and delete what's stored.
- Keep retrieved and remembered text labeled, and keep the authorization checks in code, so a manipulated model still can't act outside its permissions.
- Send the least sensitive data that answers the question.

A later security article covers memory and data exposure in depth. For the terms used here, see the [Agentic AI Glossary](/learn/foundations/agentic-ai-glossary/), and for where these boundaries sit in the whole system, see [Trust Boundaries for Agent Systems](/learn/security/trust-boundaries-for-agents/).

## What to learn next

One agent with a well-built context handles a lot. The next article asks when it's worth splitting the work across several agents, each with its own context, and what that costs.
