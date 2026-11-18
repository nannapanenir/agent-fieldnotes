---
title: "Framework Comparison by Use Case: LangGraph and the OpenAI Agents SDK"
description: Build the same shipment agent with LangGraph and the OpenAI Agents SDK, in TypeScript and Python, and compare tool authorization, approvals, limits, stored state, tracing, and dependencies on tested behavior, evaluated November 16, 2026.
topic: Frameworks
level: Intermediate
publishedAt: 2026-11-16
order: 4
stage: 6
stageOrder: 2
readingMinutes: 14
tags: [frameworks, langgraph, openai-agents-sdk, evaluation, security, typescript, python]
featured: false
draft: false
---

[How to Choose an Agent Framework](/learn/frameworks/choosing-an-agent-framework/) recommends one method: build the same small task with each candidate, run the same cases against each, and compare what they do. This article applies that method to the shipment assistant from the Stage 4 tutorials, with the hand-written agent from [Build a Minimal Agent](/learn/architecture/build-a-minimal-agent/) through [Evaluate Agent Behavior Locally](/learn/architecture/evaluate-agent-behavior-locally/) as the baseline.

Two frameworks are compared, LangGraph and the OpenAI Agents SDK, because both have official TypeScript and Python releases, both are actively released, and both can call Claude through an adapter package. Frameworks with only one language, which this site can't show in both, are left out. Every example comes in TypeScript and Python; pick a language with the tabs, and the choice applies to every example on the site.

## What was compared, and how

Everything here was evaluated on November 16, 2026, against these versions:

| Option | TypeScript | Python |
| --- | --- | --- |
| Baseline | `@anthropic-ai/sdk` 1.8.0 | `anthropic` 2.8.0 |
| LangGraph | `@langchain/langgraph` 1.7.4, `@langchain/core` 1.4.1, `@langchain/anthropic` 1.6.5 | `langgraph` 1.2.22, `langchain-core` 1.8.1, `langchain-anthropic` 1.7.10 |
| OpenAI Agents SDK | `@openai/agents` 0.22.0, `@openai/agents-extensions` 0.22.0, `@ai-sdk/anthropic` 4.0.105 | `openai-agents` 0.24.0, `litellm` 1.109.1 |

Each framework got the same core of the shipment agent: a read tool, a write tool that needs the customer's approval, the customer ID from the signed-in session, and an ownership check in the handlers. The same scripted scenarios then ran against all four builds (two frameworks, two languages): another customer's package, a forged extra argument, a wrong-typed argument, an approval that's granted or refused after a restart, a tampered saved run, and a model that never stops calling tools.

The model in these runs was a scripted stand-in, the same idea as the hostile model in [Evaluating Agent Security](/learn/security/evaluating-agent-security/). That makes the results evidence about each framework's mechanics: its limits, its pause and resume, and how it validates and passes data. They say nothing about answer quality with a real model, which this comparison didn't test. The facts about defaults come from each package's own source and documentation comments at the versions above, and they will change; recheck them before you rely on them.

## Use case 1: A support assistant with tools

The shipment assistant's first job is to answer questions with tools, for one signed-in customer, without letting the model act for anyone else.

| | Hand-written baseline | LangGraph | OpenAI Agents SDK |
| --- | --- | --- | --- |
| Where the customer ID comes from | The session, passed to the tool runner | `config.configurable`, set on each call | The run context, which the SDK's source says is never passed to the model |
| Unknown argument, default schema | Rejected with `invalid_arguments` | Accepted; the extra field is silently dropped | Accepted; the extra field is silently dropped |
| Unknown argument, strict schema | Same as above | Rejected; the error text, with the field name, goes back to the model | Rejected; the model gets a generic "An error occurred while running the tool." |
| Default step limit | 8 model calls per question (the tutorial's setting) | 25 graph steps in TypeScript, about 12 model calls; 10,007 graph steps in Python | 10 turns in both languages |
| What happens at the limit | The run ends with `step_limit` | `GraphRecursionError` is thrown | `MaxTurnsExceededError` is thrown |

Table 1. Evaluated November 16, 2026, at the versions listed above.

Three rows deserve a closer look:

- Both frameworks validate tool arguments with your schema library, and both libraries drop unknown fields by default. A forged `address` argument is ignored rather than rejected, so nothing tells you a model tried. Make schemas strict (`.strict()` in Zod, `extra="forbid"` in pydantic) to turn that into a visible error.
- LangGraph's default step limit differs by language. In TypeScript a graph stops after 25 steps. In Python 1.2.22, the default comes from the `LANGGRAPH_DEFAULT_RECURSION_LIMIT` environment variable and is 10,007; a test graph that loops forever ran all 10,007 steps before stopping. With two graph steps per model call, that's roughly 5,000 model calls. Set `recursion_limit` yourself on every run.
- Both frameworks keep authorization where it belongs, in your tool code, as long as the customer ID comes from data the model can't write: run config in LangGraph, run context in the Agents SDK. In both, the ownership check returned `not_found` for another customer's package.

## Use case 2: An approval that waits for a person

A redelivery needs the customer's yes. In a web app, that yes can arrive minutes later, after the server has restarted, so the paused run has to be saved and resumed. This is where the two frameworks' control models really differ.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="How LangGraph and the OpenAI Agents SDK pause a write for approval. Scrolls horizontally on small screens.">

![Two columns, each with five steps of an approval for the requestRedelivery tool. LangGraph pauses inside the tool: 1, the model proposes the write, which is untrusted. 2, the tool starts, checks ownership, then calls interrupt(). 3, the checkpointer saves the thread, as it does at every step. 4, the customer answers, a human checkpoint. 5, Command(resume) is sent on the same thread, and the tool re-runs from the top, then books. A note says anything before interrupt() runs twice. The OpenAI Agents SDK stops before the tool: 1, the model proposes the write. 2, the run stops before execute, because the tool has needsApproval. 3, you save the RunState string, which includes the context, so keep it server-side. 4, the customer answers. 5, you load it with the context from the server session and approve, and the tool runs once, then books. A note says snapshots aren't checked for tampering.](../../../assets/diagrams/frameworks/approval-control-models.svg)

</div>
<figcaption>LangGraph pauses inside the tool and re-runs it on resume. The OpenAI Agents SDK stops before the tool and runs it once.</figcaption>
</figure>

**How to read the diagram.** Read each column from top to bottom. The dashed box is model output, which is untrusted; outlined boxes are your code; the grey box is stored state; and the rounded box is the customer's decision. The notes at the bottom are the one thing each model gets wrong most easily.

In LangGraph, the write tool calls `interrupt()`. The graph stops, the checkpointer saves the thread, and later a `Command` with the customer's answer resumes it. The resumed tool runs again from its first line, so `interrupt()` has to come before any side effect:

<div class="code-tabs">

```ts
import { tool } from "@langchain/core/tools";
import { Command, interrupt } from "@langchain/langgraph";
import { z } from "zod";

// Records and booking, defined elsewhere in the app.
declare function ownerOf(trackingId: string): string | undefined;
declare function bookRedelivery(trackingId: string, date: string): Promise<void>;
// The compiled graph, with this tool in its ToolNode and a durable checkpointer such as a Postgres saver.
declare const graph: { invoke(input: Command, config: { configurable: Record<string, string> }): Promise<unknown> };

export const requestRedelivery = tool(
  async ({ trackingId, date }, config) => {
    if (ownerOf(trackingId) !== config.configurable?.customerId) return JSON.stringify({ error: "not_found" });
    // The graph pauses here and saves a checkpoint. On resume this function runs again
    // from the top, so nothing before this line may change anything.
    const answer = interrupt({ action: "Redeliver this package", trackingId, date });
    if (answer !== "yes") return JSON.stringify({ error: "declined_by_customer" });
    await bookRedelivery(trackingId, date);
    return JSON.stringify({ scheduled: true });
  },
  {
    name: "requestRedelivery",
    description: "Redeliver one of the signed-in customer's packages.",
    schema: z.object({ trackingId: z.string(), date: z.string() }).strict(), // unknown arguments are an error
  },
);

// Later, possibly in another process: resume the paused thread with the customer's answer.
// The customer ID comes from the current session; the checkpoint doesn't supply it.
export async function resumeRedelivery(threadId: string, customerId: string, answer: "yes" | "no") {
  return graph.invoke(new Command({ resume: answer }), { configurable: { thread_id: threadId, customerId } });
}
```

```python
import json
from typing import Any, Protocol

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.types import Command, interrupt
from pydantic import BaseModel, ConfigDict


# Records and booking, defined elsewhere in the app.
class Shipments(Protocol):
    def owner_of(self, tracking_id: str) -> str | None: ...
    def book_redelivery(self, tracking_id: str, date: str) -> None: ...


# The compiled graph, with this tool in its ToolNode and a durable checkpointer such as a Postgres saver.
class Graph(Protocol):
    def invoke(self, input: Command[str], config: RunnableConfig) -> Any: ...


class RedeliveryArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)  # unknown arguments are an error
    tracking_id: str
    date: str


@tool(args_schema=RedeliveryArgs)
def request_redelivery(tracking_id: str, date: str, config: RunnableConfig) -> str:
    """Redeliver one of the signed-in customer's packages."""
    shipments: Shipments = config["configurable"]["shipments"]
    if shipments.owner_of(tracking_id) != config["configurable"]["customer_id"]:
        return json.dumps({"error": "not_found"})
    # The graph pauses here and saves a checkpoint. On resume this function runs again
    # from the top, so nothing before this line may change anything.
    answer = interrupt({"action": "Redeliver this package", "tracking_id": tracking_id, "date": date})
    if answer != "yes":
        return json.dumps({"error": "declined_by_customer"})
    shipments.book_redelivery(tracking_id, date)
    return json.dumps({"scheduled": True})


# Later, possibly in another process: resume the paused thread with the customer's answer.
# The customer ID comes from the current session; the checkpoint doesn't supply it.
def resume_redelivery(graph: Graph, shipments: Shipments, thread_id: str, customer_id: str, answer: str) -> Any:
    config: RunnableConfig = {
        "configurable": {"thread_id": thread_id, "customer_id": customer_id, "shipments": shipments}
    }
    return graph.invoke(Command(resume=answer), config)
```

</div>

The Python version passes the shipment store in the run config, next to the customer ID, because LangGraph tools receive their dependencies through the config.

In the OpenAI Agents SDK, the tool declares `needsApproval`. The run stops before the tool runs and returns the pending approvals; you save the run state as a string and, later, load it, approve or reject, and run again:

<div class="code-tabs">

```ts
import { anthropic } from "@ai-sdk/anthropic";
import { Agent, run, RunContext, RunState, tool } from "@openai/agents";
import { aisdk } from "@openai/agents-extensions/ai-sdk";
import { z } from "zod";

type Session = { customerId: string };

// Records, booking, and server-side storage for paused runs, defined elsewhere in the app.
declare function ownerOf(trackingId: string): string | undefined;
declare function bookRedelivery(trackingId: string, date: string): Promise<void>;
declare const pausedRuns: { save(runId: string, state: string): Promise<void>; load(runId: string): Promise<string> };

export const requestRedelivery = tool({
  name: "requestRedelivery",
  description: "Redeliver one of the signed-in customer's packages.",
  parameters: z.object({ trackingId: z.string(), date: z.string() }).strict(), // unknown arguments are an error
  needsApproval: true, // the run stops before execute until the customer decides
  execute: async ({ trackingId, date }, runContext) => {
    const session = runContext?.context as Session | undefined;
    if (!session || ownerOf(trackingId) !== session.customerId) return JSON.stringify({ error: "not_found" });
    await bookRedelivery(trackingId, date);
    return JSON.stringify({ scheduled: true });
  },
});

export const agent = new Agent<Session>({
  name: "shipment-assistant",
  instructions: "You help one signed-in customer with their own packages.",
  model: aisdk(anthropic("claude-opus-5-5")),
  tools: [requestRedelivery],
});

export async function startRun(runId: string, session: Session, question: string) {
  const result = await run(agent, question, { context: session });
  if (result.interruptions.length > 0) await pausedRuns.save(runId, result.state.toString());
  return result;
}

// Later, possibly in another process. The snapshot stays on your server, and the
// customer ID comes from the current session, never from the snapshot.
export async function resumeRun(runId: string, session: Session, approved: boolean) {
  const saved = await pausedRuns.load(runId);
  const state = await RunState.fromStringWithContext(agent, saved, new RunContext(session), { contextStrategy: "replace" });
  for (const item of state.getInterruptions()) {
    if (approved) state.approve(item);
    else state.reject(item);
  }
  return run(agent, state);
}
```

```python
import json
from dataclasses import dataclass
from typing import Any, Protocol

from agents import Agent, RunContextWrapper, Runner, RunResult, RunState, function_tool
from agents.extensions.models.litellm_model import LitellmModel
from pydantic import BaseModel, ConfigDict


@dataclass
class Session:
    customer_id: str


# Records, booking, and server-side storage for paused runs, defined elsewhere in the app.
class Shipments(Protocol):
    def owner_of(self, tracking_id: str) -> str | None: ...
    def book_redelivery(self, tracking_id: str, date: str) -> None: ...


class PausedRuns(Protocol):
    async def save(self, run_id: str, state: str) -> None: ...
    async def load(self, run_id: str) -> str: ...


shipments: Shipments | None = None  # set at startup


class RedeliveryArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)  # unknown arguments are an error
    tracking_id: str
    date: str


@function_tool(needs_approval=True)  # the run stops before the function until the customer decides
def request_redelivery(ctx: RunContextWrapper[Session], args: RedeliveryArgs) -> str:
    """Redeliver one of the signed-in customer's packages."""
    if shipments is None or shipments.owner_of(args.tracking_id) != ctx.context.customer_id:
        return json.dumps({"error": "not_found"})
    shipments.book_redelivery(args.tracking_id, args.date)
    return json.dumps({"scheduled": True})


agent = Agent[Session](
    name="shipment-assistant",
    instructions="You help one signed-in customer with their own packages.",
    model=LitellmModel(model="anthropic/claude-opus-5-5"),
    tools=[request_redelivery],
)


async def start_run(paused_runs: PausedRuns, run_id: str, session: Session, question: str) -> RunResult:
    result = await Runner.run(agent, question, context=session)
    if result.interruptions:
        await paused_runs.save(run_id, result.to_state().to_string())
    return result


# Later, possibly in another process. The snapshot stays on your server, and the
# customer ID comes from the current session, never from the snapshot.
async def resume_run(paused_runs: PausedRuns, run_id: str, session: Session, approved: bool) -> Any:
    state = await RunState.from_string(
        agent, await paused_runs.load(run_id), context_override=RunContextWrapper(session)
    )
    for item in state.get_interruptions():
        if approved:
            state.approve(item)
        else:
            state.reject(item)
    return await Runner.run(agent, state)
```

</div>

The Python version calls Claude through LiteLLM; the TypeScript version through the AI SDK's Anthropic provider. Both are adapters the Agents SDK ships for non-OpenAI models.

| | Hand-written baseline | LangGraph | OpenAI Agents SDK |
| --- | --- | --- | --- |
| How the run pauses | The handler awaits the approval prompt in the same process | `interrupt()` inside the tool | `needsApproval` on the tool; the run stops before it |
| Where the paused run lives | In memory, for up to 30 seconds | The checkpointer, in memory or in a database through a separate Postgres or SQLite package | A string that you store |
| Survives a restart | No | Yes, with a durable checkpointer | Yes, if you store the string |
| Tool code on resume | Not applicable | Runs again from the top; the handler started twice in every test | Runs once, after approval |
| Customer ID on resume | Not applicable | Comes from your resume call; the checkpoint doesn't supply it | Comes from the snapshot unless you pass your own: `fromStringWithContext` in TypeScript, `context_override` in Python |
| Tampered saved run | Not applicable | The checkpoint stays on your server; resuming another customer's thread gave `not_found` | Without your own context, the tool ran as the forged customer; with it, `not_found` |

Table 2. Evaluated November 16, 2026, at the versions listed above.

The last row is the most important result in this article. A saved Agents SDK run contains the run context, including the customer ID. In a test, editing that ID in a saved run and resuming it made the tool run as the other customer, and the ownership check passed. That happened in TypeScript even when the correct context was passed to `run()` on resume, and in Python with a plain dictionary as the context. The SDK documents the risk: its TypeScript source says snapshot checks "detect routing changes, not snapshot tampering", and its Python docstring says not to pass client-supplied state to `from_string`, and to keep snapshots on the server. The examples above do both: they keep the snapshot server-side, and they replace its context with the current session's when they load it.

## Use case 3: Running it: tracing, stored data, and dependencies

| | Hand-written baseline | LangGraph | OpenAI Agents SDK |
| --- | --- | --- | --- |
| Tracing by default | None; your own structured logs | Off; LangSmith tracing starts only when `LANGSMITH_TRACING` is set to `true` | On; the default exporter sends traces to OpenAI's trace endpoint when an OpenAI API key is available, and model and tool data are included by default |
| Turning tracing off | Not applicable | Leave the variable unset | `OPENAI_AGENTS_DISABLE_TRACING=1`, or disable it in the run config |
| Stored state | A trimmed conversation per customer, in memory | Every checkpoint of every thread, until you delete the thread; one short approval run left 5 checkpoints | Whatever you store; one paused approval was about 3,700 characters in TypeScript and 9,000 in Python, context included |
| Using Claude | Direct | `@langchain/anthropic` or `langchain-anthropic` | The AI SDK adapter in TypeScript, LiteLLM in Python |
| Packages installed | 8 npm, 16 PyPI | 31 npm, 43 PyPI | 40 npm, 74 PyPI |
| Version line | Not applicable | 1.x | 0.x |

Table 3. Evaluated November 16, 2026, at the versions listed above. Package counts are fresh installs of the listed packages, including them, on that date.

Two of these rows are easy to miss. The Agents SDK traces by default and includes model and tool data unless you set `traceIncludeSensitiveData` (TypeScript) or `trace_include_sensitive_data` (Python) to false. In a Claude-only deployment with no OpenAI key, the exporter skipped sending, as its own log line said; if an OpenAI key is in the environment for another reason, your customers' conversations go to a second provider. And LangGraph keeps every checkpoint, which includes the full conversation at each step, until you call `deleteThread` or `delete_thread`, so retention is something you schedule.

## Choosing for the shipment assistant

None of this produces a winner. It shows what each option asks of you:

- The hand-written agent is the smallest and the easiest to audit, and it has no way to pause for hours. It fits while approvals happen in the same session.
- LangGraph fits when you want the control flow drawn explicitly and runs that survive restarts, and you're prepared to set the recursion limit, schedule checkpoint deletion, and keep side effects after `interrupt()`.
- The Agents SDK fits when you want a compact run loop with approvals built in, and you're prepared to disable or redirect tracing, keep run state server-side with your own context, and track a 0.x API.

Whichever you pick, run the Stage 4 evaluation suite and the Stage 5 control tests against it before switching, using the framework's limits in place of the tutorial's.

## Security implications

- Every framework is a supply-chain dependency. In this comparison, the frameworks added 23 to 58 packages beyond the model SDK. The OWASP Top 10 for Agentic Applications (2026) lists Agentic Supply Chain Vulnerabilities as ASI04; pin versions with a lockfile and review updates, as for any dependency that runs with your agent's permissions.
- Keep identity out of anything the model or the customer can edit. Run config and run context keep the customer ID away from the model, but a saved Agents SDK run carries it too, which is why the examples replace it on resume. Acting as someone other than the signed-in customer is Identity and Privilege Abuse, ASI03.
- Make tool schemas strict. Default schemas in both frameworks drop unknown arguments silently, which hides attempts to misuse a tool (ASI02).
- Set your own limits. Framework defaults range from 10 model turns to about 5,000 model calls for the same agent, and a runaway agent is how one fault cascades into cost and outages (ASI08).
- Decide where traces go before the first production run. Tracing is useful and contains the same customer data as your conversations, so its destination and retention are data protection decisions.
- An approval only protects you if the code enforces it. Both frameworks enforce it in code: nothing booked until the customer said yes, in every test.

## What to learn next

The comparison showed how differently frameworks bound a runaway agent. The next stage of the roadmap, starting with Reliability, Cost, and Runaway Loops, covers step, time, token, and spend budgets in production, circuit breakers, and what to return when a limit is hit.
