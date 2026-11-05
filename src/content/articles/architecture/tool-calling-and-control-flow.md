---
title: Tool Calling and Control Flow
description: How a model requests a tool, and how your application should validate, authorize, run, and return each call, including errors, timeouts, writes, and parallel calls.
topic: Architecture
level: Intermediate
publishedAt: 2026-11-05
order: 6
readingMinutes: 11
tags: [architecture, tools, tool-calling, validation, security]
featured: false
draft: true
---

A model can't run a tool. When it wants one, it writes a structured request, and your application decides what happens next. Most of the security of an agent depends on how the application makes that decision.

This article follows one tool call from request to result. It uses the shipment assistant from earlier articles, with two tools: `getShipmentStatus`, which only reads, and `requestRedelivery`, which changes something in the real world. If you haven't read [The Agent Loop, Step by Step](/learn/architecture/the-agent-loop/) and [The Parts of an AI Agent](/learn/architecture/agent-components-model-tools-state/), start there.

## What a tool call looks like

Provider APIs differ in field names, but every tool call has the same three pieces.

First, the application describes the tool when it calls the model. The description has a name, a sentence about when to use it, and a JSON Schema for the inputs:

```json
{
  "name": "getShipmentStatus",
  "description": "Get the current status of one of the signed-in customer's shipments. Use when the customer asks where a package is.",
  "input_schema": {
    "type": "object",
    "properties": {
      "trackingId": {
        "type": "string",
        "pattern": "^[A-Z0-9]{10,22}$",
        "description": "Carrier tracking number, letters and digits only."
      }
    },
    "required": ["trackingId"],
    "additionalProperties": false
  }
}
```

Second, the model answers with a request instead of text. The request names the tool, supplies arguments, and carries a call ID:

```json
{ "id": "call_7f2a", "name": "getShipmentStatus", "arguments": { "trackingId": "1Z999AA10123456784" } }
```

Third, the application sends back a tool result tagged with the same call ID, and calls the model again. The model reads the result and either answers or asks for another tool.

The call ID matters when the model asks for several tools at once. Each result has to be matched to its own request, and most APIs reject the next request if a result is missing.

## Design narrow tools

Most tool-calling problems start with a tool that can do too much. The model will eventually use whatever range a tool allows, either by mistake or because injected text told it to.

A few rules keep tools narrow:

- Give each tool one job. `getShipmentStatus` and `requestRedelivery` are separate tools, so the read can be offered freely and the write can get extra checks.
- Avoid open-ended inputs. A `query` string passed to a database, a `url` the tool fetches, or a `command` it runs turns one tool into many.
- Constrain every field. Use enums for fixed choices, patterns for IDs, length limits for text, and `additionalProperties: false` so the model can't invent fields.
- Keep identity out of the arguments. The tool should take the customer from the signed-in session. If `customerId` were an argument, the model could be talked into passing someone else's.
- Write the description for the model. Say when to use the tool and when not to, in a sentence or two. The description guides the model's choice. It doesn't limit what the tool can do, which is why the rules above live in code.

Here's the difference in practice:

| Too broad | Narrow |
| --- | --- |
| `lookup(query: string)` | `getShipmentStatus(trackingId)` |
| `updateShipment(customerId, fields: object)` | `requestRedelivery(trackingId, date)` with `date` limited to the next 14 days |
| `fetch(url)` | No tool, or one that only reaches the carrier's API |

## The path of one call

Every tool call should pass the same checks, in the same order, before anything runs. Each failure produces an error result for the model, so the loop always gets an answer.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Flowchart of one tool call. Scrolls horizontally on small screens.">

![Flowchart. 1, the model proposes a tool call with a name, arguments, and a call ID. 2, the application checks the tool is on this agent's allowlist; if not, it returns an unknown-tool error. 3, it validates the arguments against the schema; if they fail, it returns an error naming the field. 4, it checks the action is allowed for this user; if not, it returns a denial that looks the same as not found. 5, it runs the tool with a timeout; if the tool fails, it returns an error saying whether a retry may help. 6, it trims the result to a size limit and marks it untrusted. 7, every path returns a tool result to the model, paired with the call ID, and counts against the step budget.](../../../assets/diagrams/architecture/tool-call-path.svg)

</div>
<figcaption>Every tool call passes schema validation and authorization before it runs.</figcaption>
</figure>

**How to read the diagram.** Follow the left column for a call that succeeds. Each outlined box is something the application does. The dashed boxes on the right are error results, and they all return to the model the same way a success does, through step 7.

1. The model proposes a call. Treat it as untrusted input, like anything else the model writes.
2. Check the tool name against the tools this agent is allowed to use. The model can ask for a tool you never offered, especially after reading injected text.
3. Validate the arguments against the schema in your code. Some providers can constrain the model to the schema, which reduces malformed calls, but your validation is still the one you can rely on.
4. Authorize the action for this user, on every call. In the shipment example, the shipment has to belong to the signed-in customer. If it doesn't, return the same reply you'd return for a shipment that doesn't exist, so the model can't probe for other people's data.
5. Run the tool with a timeout. A slow carrier API shouldn't stall the whole turn.
6. Trim the result to a size limit and keep only the fields the model needs. The result is untrusted data: a delivery note from the carrier could contain text written to manipulate the model.
7. Return the result, or the error, paired with the call ID. Count the call against the step budget either way, so a model stuck in a retry loop still hits a limit.

Here's that path as a TypeScript gateway. It uses Zod for validation; any schema library works.

```ts
import { z } from "zod";

// Data access, defined elsewhere in the app. Ownership is part of the query.
declare const shipments: {
  findForCustomer(trackingId: string, customerId: string): Promise<
    { status: string; eta: string; lastScan: string } | null
  >;
};

class TimeoutError extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new TimeoutError()), ms)),
  ]);
}

type Session = { customerId: string };
type ToolCall = { id: string; name: string; arguments: unknown };
type ToolResult = { callId: string; ok: boolean; content: string };

const MAX_RESULT_CHARS = 2_000;
const TIMEOUT_MS = 5_000;

const tools = {
  getShipmentStatus: {
    schema: z.object({ trackingId: z.string().regex(/^[A-Z0-9]{10,22}$/) }).strict(),
    run: async (args: { trackingId: string }, session: Session) => {
      const shipment = await shipments.findForCustomer(args.trackingId, session.customerId);
      if (!shipment) return { error: "not_found" };
      return { status: shipment.status, eta: shipment.eta, location: shipment.lastScan };
    },
  },
} as const;

export async function executeToolCall(call: ToolCall, session: Session): Promise<ToolResult> {
  const reply = (ok: boolean, body: unknown): ToolResult => ({
    callId: call.id,
    ok,
    content: JSON.stringify(body).slice(0, MAX_RESULT_CHARS),
  });

  // 2. Known tool for this agent?
  const tool = tools[call.name as keyof typeof tools];
  if (!tool) return reply(false, { error: "unknown_tool", name: call.name });

  // 3. Arguments match the schema?
  const parsed = tool.schema.safeParse(call.arguments);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join("."));
    return reply(false, { error: "invalid_arguments", fields });
  }

  // 4 and 5. Authorization happens inside run(), scoped to session.customerId,
  // and the run is bounded by a timeout.
  try {
    const result = await withTimeout(tool.run(parsed.data, session), TIMEOUT_MS);
    // 6. Trimming happens in reply(); run() already returns only the fields the model needs.
    return reply(!("error" in result), result);
  } catch (err) {
    const retryable = err instanceof TimeoutError;
    return reply(false, { error: retryable ? "timeout" : "tool_failed", retryable });
  }
}
```

Four details in that code are easy to miss:

- The customer ID comes from `session`, never from `call.arguments`.
- The ownership check is inside the data query (`findForCustomer`), so there's no path that reads a shipment first and checks ownership after.
- Errors go back to the model as tool results, not as exceptions that crash the loop. The model can often recover, for example by asking the customer to recheck a tracking number.
- Error messages are short and safe. The model sees `invalid_arguments` and the field name, not a stack trace or a database error.

## Errors, timeouts, and retries

The model reads your error results and decides what to do next, so make them useful to it:

- Say what failed in terms the model can act on: which field was invalid, or that the shipment wasn't found.
- Say whether retrying could help. A timeout might succeed on a second try. A validation error won't, unless the arguments change.
- Keep retries inside your limits. Put a cap on attempts per tool and on total steps per turn, so a model that keeps retrying ends the turn instead of looping.
- Don't let a tool error end the conversation unless it has to. Return the error, let the model explain it to the customer, and log the details on your side.

## Tools that change things

Reads and writes need different care. If `getShipmentStatus` runs twice, nothing bad happens. If `requestRedelivery` runs twice, the customer might get two redeliveries, or a confusing pair of emails.

Writes need three extra protections:

- Make them idempotent. Generate an idempotency key in the application, for example from the call ID, and pass it to the downstream API so a repeated request has no extra effect. Don't ask the model to supply the key.
- Validate business rules, not just types. The schema can say `date` is a date. Your code has to check that it's in the allowed window and that the shipment is eligible for redelivery.
- Ask before high-impact actions. For anything costly or hard to undo, pause the loop and ask the customer to confirm before running it. A redelivery might be fine to run directly. A refund probably isn't.

## Sequential and parallel calls

Many models can request several tools in one response, and most provider APIs allow this by default. A customer asking about two packages might trigger two `getShipmentStatus` calls at once.

Parallel calls are safe when the calls are independent reads. Running them together saves time, and the order doesn't matter.

Run calls one at a time when:

- one call needs another's result, such as looking up the shipment before requesting redelivery
- any of the calls writes, since two writes in parallel can conflict or run in an order you didn't plan
- a call needs human approval, since the others shouldn't run past it

The application decides, whatever the model asked for. You can run a batch of parallel requests sequentially, or reject a write that arrives alongside other calls and ask the model to send it on its own. Most providers also let you turn off parallel calls for a request. Either way, return one result for every call ID before calling the model again.

## Who decides whether a tool is used

By default the model decides on each step whether to call a tool or answer in text. Most provider APIs let the application override that for a request:

- let the model choose (the usual default)
- require a tool call
- require one specific tool
- forbid tool calls

Requiring a specific tool is useful in workflow steps where you already know what has to happen next. Forbidding tools is useful for the final step of a turn, when you want an answer and no more actions. The parameter names differ by provider, so check your provider's documentation.

## Security implications

OWASP's Top 10 for Agentic Applications (2026) lists tool misuse and exploitation as ASI02: an agent using legitimate tools in harmful ways, usually because of manipulated input or tools that allow too much. The defenses are the ones in this article:

- narrow tools with strict schemas, so a manipulated model has little room
- validation and authorization in code on every call, so the model's request is never the last check
- bounded results marked as untrusted, so tool output can't flood the context or slip in instructions unchecked
- idempotency and confirmation for writes, so mistakes and repeats are cheap

The design questions in [Trust Boundaries for Agent Systems](/learn/security/trust-boundaries-for-agents/) apply to each tool: what it can reach, whose data it touches, and what happens if the model calls it at the worst possible moment. For the terms used here, see the [Agentic AI Glossary](/learn/foundations/agentic-ai-glossary/).

## What to learn next

Tool results add to what the model sees on each step, and context fills up fast. The next article covers context, memory, and retrieval: what to send the model, what to keep, and what to leave out.
