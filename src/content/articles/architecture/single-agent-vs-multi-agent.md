---
title: "Single Agent vs. Multi-Agent: When One Agent Is Enough"
description: When one agent with good tools does the job, when several cooperating agents are worth the cost, and how to keep every handoff between agents from becoming a security gap.
topic: Architecture
level: Intermediate
publishedAt: 2026-11-07
order: 8
readingMinutes: 10
tags: [architecture, multi-agent, orchestration, a2a, security]
featured: false
draft: true
---

A team of AI agents sounds like a good idea: a planner, a researcher, a writer, and a reviewer, each doing what it's best at. In practice, most tasks go better with one agent that has the right tools. Extra agents cost more, are harder to debug, and add a trust boundary at every handoff.

Some tasks do need more than one agent. This article helps you tell which kind of task you have, and shows how to keep a multi-agent design safe when you need one. It assumes you've read [Tool Calling and Control Flow](/learn/architecture/tool-calling-and-control-flow/) and [Context, Memory, and Retrieval](/learn/architecture/context-memory-and-retrieval/).

## What "multi-agent" means

A multi-agent system is two or more agents, each with its own instructions, tools, and context, working on one job. Two shapes cover most real designs:

- Orchestrator and workers. One agent plans the work, hands subtasks to worker agents, and combines their results. The workers usually look like tools to the orchestrator: it calls one, gets a report back, and carries on. OpenAI's agent guide calls this the manager pattern. When a worker is started for one focused subtask and then discarded, it's often called a subagent.
- Handoffs. Agents pass control to each other with no central manager. A triage agent might hand a customer to a billing agent, which takes over the conversation from there.

Both shapes split one context into several, which explains most of what they gain and most of what goes wrong with them.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Diagram comparing one agent with an orchestrator and two workers. Scrolls horizontally on small screens.">

![Left: one agent connected to three tools: search, orders, and email. Right: an orchestrator agent sends subtasks to two worker agents, each with its own context and one tool, across a dashed line labeled trust boundary, and a second dashed line separates the two workers. Results return to the orchestrator as dashed arrows, treated as untrusted.](../../../assets/diagrams/architecture/single-vs-multi-agent.svg)

</div>
<figcaption>Each added agent adds a trust boundary and a handoff to secure.</figcaption>
</figure>

**How to read the diagram.** On the left, one agent reaches three tools, and every check happens in one application. On the right, the same work is split across an orchestrator and two workers. Each dashed line is a place where one agent's output becomes another agent's input, so each one needs the same checks you'd put on a tool result.

## Start with one agent

One agent with good tools is the default for good reasons:

- It has one context, so it never loses a decision made earlier in the task.
- Every authorization check and limit lives in one place.
- It's cheaper. Each extra agent re-reads instructions and builds its own context, and you pay for those tokens.
- It's easier to debug. When something goes wrong, there's one trace to read.

When a single agent struggles, the cause is usually something other than having too few agents:

| Symptom | Try this first |
| --- | --- |
| The model picks the wrong tool | Fewer tools, clearer descriptions, and no overlapping tools |
| Instructions pull in different directions | Split the work into workflow steps your code controls |
| The context fills up | Summarize old turns, trim tool results, retrieve only what's needed |
| A step needs a different model | Call that model for that one step, as a workflow step |

Move to several agents when these fixes stop helping and the task has the shape described next.

## When several agents earn their cost

Six questions decide most cases:

| Question | Points to one agent | Points to several agents |
| --- | --- | --- |
| Can the task split into independent parts? | Steps depend on each other | Parts can run without talking to each other |
| Do the parts need different specialties? | One set of instructions and tools covers it | Parts need very different instructions or tools |
| Does the material fit in one context? | Yes, with trimming | No, even after trimming and retrieval |
| Does speed matter? | Steps must run in order anyway | Parallel parts would finish much sooner |
| Is the result worth extra cost? | Routine, low-value task | Valuable enough to pay several times the tokens |
| Can you debug it? | One trace is enough | You're ready to trace every handoff |

The strongest signal is the first one. Multi-agent designs work best when the parts are independent, and badly when agents have to keep agreeing on shared decisions.

## What builders have learned

Anthropic and Cognition have both written about this from opposite sides, and their accounts end up agreeing on where the line falls.

Anthropic's account of its Research feature describes an orchestrator that sends several worker agents to search in parallel, each with its own context. On Anthropic's internal research evaluation, that setup beat a single agent using its strongest model by about 90 percent. It also used about 15 times as many tokens as a normal chat. Anthropic says the approach suits broad research questions with many independent directions, and fits poorly where all the agents need the same context or depend heavily on each other.

Cognition, the company behind the Devin coding agent, published "Don't Build Multi-Agents" in June 2025. Its argument is that parallel agents make different unstated assumptions, such as one worker choosing one coding style and another choosing a different one, and the pieces don't fit back together. In an April 2026 follow-up, Cognition said a narrower kind of multi-agent system now works for them: several agents can contribute analysis and review, as long as only one of them writes the result.

The practical rule that falls out of both: let several agents read and research in parallel, and keep one agent responsible for decisions and writes.

## The shipment assistant, both ways

The customer support assistant from earlier articles answers "Where's my package?" and requests redeliveries. That's one agent. The steps depend on each other, the tools are few, and the context fits easily.

Now take a different job: a monthly report on how 20 carriers performed, built from delay data, customer complaints, and each carrier's published service notices. That job splits cleanly. An orchestrator can send workers to research carriers in parallel, each with read-only tools and its own context, and then write the report itself. The workers never need to agree with each other, and only the orchestrator writes anything. A company could reasonably run the support assistant as one agent and the monthly report as several.

## Delegating a subtask well

A worker knows only what its brief tells it. Anthropic found its workers needed four things: an objective, an output format, guidance on which tools and sources to use, and clear task boundaries. Without them, workers duplicated each other's work or wandered off task.

Treat the brief as a contract your code checks before the worker starts. Here's a sketch in TypeScript:

```ts
type Permission = "carriers:read" | "complaints:read" | "orders:read" | "email:send";

type SubtaskBrief = {
  objective: string; // e.g. "Summarize October delays for carrier ACME"
  outputFormat: string; // e.g. "JSON: { carrier, onTimeRate, topIssues[] }"
  allowedTools: string[];
  permissions: Permission[];
  maxSteps: number;
};

const MAX_WORKER_STEPS = 10;

// A worker can never hold a permission its caller doesn't have.
export function prepareDelegation(callerPermissions: Permission[], brief: SubtaskBrief): SubtaskBrief {
  const extra = brief.permissions.filter((p) => !callerPermissions.includes(p));
  if (extra.length > 0) {
    throw new Error(`Subtask requests permissions the caller lacks: ${extra.join(", ")}`);
  }
  return { ...brief, maxSteps: Math.min(brief.maxSteps, MAX_WORKER_STEPS) };
}
```

The check runs in the application, before the worker starts. The orchestrator model can write whatever brief it likes, but it can't hand out access it doesn't have, and every worker gets a step limit.

When the worker reports back, treat the report like any other tool result: validate it against the output format, trim it, and keep it labeled as untrusted. A worker that read a poisoned web page can pass the poison along in its summary.

## When the other agent isn't yours

So far, every agent belonged to one application. Sometimes your agent needs to work with an agent someone else runs, such as a partner's logistics agent. That's what the Agent2Agent protocol (A2A) is for, and it's easy to confuse with MCP.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Diagram comparing MCP and A2A connections. Scrolls horizontally on small screens.">

![Your agent in the middle. On the left, it connects over MCP to an MCP server that exposes tools, files, and APIs; the agent calls a capability and gets a result. On the right, it connects over A2A to another agent from another vendor or team; the agent hands off a task and gets a report back. Both outer boxes have dashed outlines because they sit outside your application.](../../../assets/diagrams/architecture/mcp-vs-a2a.svg)

</div>
<figcaption>MCP connects an agent to tools and data. A2A connects an agent to other agents.</figcaption>
</figure>

**How to read the diagram.** Your agent is the only box you control. Through MCP it calls capabilities, like a tool call. Through A2A it hands a whole task to another agent, which decides its own steps and reports back. Both outer boxes are outside your trust boundary.

An agent across A2A is the least trusted kind of worker. You don't control its instructions, tools, or model, so its reports get the strictest checks, and it should get only the data the task needs.

## Security implications

Every added agent adds a trust boundary. OWASP's Top 10 for Agentic Applications (2026) names two risks that grow with each one.

- Insecure inter-agent communication (ASI07). Messages between agents can be spoofed, tampered with, or simply wrong. Treat every message from another agent as untrusted input, check where it came from, and validate its shape before acting on it.
- Cascading failures (ASI08). One bad result, such as a hallucinated fact, a poisoned document, or a stuck loop, can spread through every agent that uses it. Give each agent its own step and cost limits, put an overall budget on the whole job, and stop the run when workers keep failing.

Two more rules close the common gaps:

- Authority must not grow at a handoff. A worker gets the same or fewer permissions than its caller, scoped to the same user. The `prepareDelegation` check above enforces this in code.
- Keep one trace across all agents. Give the job one ID and log every handoff under it, so you can reconstruct who asked whom to do what.

[Trust Boundaries for Agent Systems](/learn/security/trust-boundaries-for-agents/) applies to each boundary in the diagram, and the [Agentic AI Glossary](/learn/foundations/agentic-ai-glossary/) defines the terms used here.

## Before you add a second agent

Check these first:

1. You've tried fewer tools, clearer descriptions, and workflow steps with one agent.
2. The task splits into parts that don't need to agree with each other.
3. Only one agent writes or acts. The others read and report.
4. Each worker's permissions are a subset of its caller's, checked in code.
5. Every agent has a step limit, and the whole job has a budget.
6. Worker results are validated and labeled as untrusted.
7. One trace ID follows the job across every handoff.

If you can't check most of these yet, stay with one agent.

## What to learn next

The orchestrator and handoff shapes are two of several patterns for arranging agents and workflow steps. The next article covers orchestration patterns, including chaining, routing, and parallel steps, and shows where untrusted data enters and authority is used in each.
