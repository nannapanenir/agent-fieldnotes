---
title: "Orchestration Patterns: Chaining, Routing, Parallel Steps, and More"
description: Five common ways to arrange model calls, code, and agents, when each one fits, and where untrusted data enters, where authority is used, and where human checkpoints belong.
topic: Architecture
level: Intermediate
publishedAt: 2026-11-09
order: 9
readingMinutes: 11
tags: [architecture, orchestration, workflows, multi-agent, security]
featured: false
draft: true
---

Orchestration is how you arrange the steps of an AI system: which model calls happen, in what order, what your code checks between them, and when a person gets a say. A handful of shapes cover most real systems, and each one has its own places where things can go wrong.

This article walks through five patterns, using the shipment assistant from earlier articles for every example. For each one, it shows where untrusted data enters, where the system uses real authority, and where a human checkpoint belongs. It builds on [Single Agent vs. Multi-Agent](/learn/architecture/single-agent-vs-multi-agent/).

## Workflows and agents use the same building blocks

Anthropic's "Building effective agents" splits these patterns into two families. In workflows, your code decides the path ahead of time. In agents, the model decides its next step as it goes. The first four patterns below are usually workflows. Orchestrator and workers sits between the two, because a model plans the subtasks at run time.

Microsoft Agent Framework ships similar shapes as ready-made orchestrations under different names: sequential, concurrent, handoff, group chat, and Magentic. Sequential is chaining, concurrent is parallelization, and the other three are variations on routing and orchestration.

Every diagram in this article uses the same labels:

- "Model:" is a model call. Its output is a proposal and needs checking.
- "Code:" is a step your application runs and enforces.
- "Human checkpoint" is where a person approves, corrects, or takes over.
- Dashed outlines mark untrusted input.

## Prompt chaining

A fixed sequence of steps, where each model call works on the output of the one before it, with code checks in between.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Prompt chaining diagram. Scrolls horizontally on small screens.">

![Left to right: an untrusted customer email goes to a model step that extracts the order and issue. A code step checks the fields; if the check fails, the run stops and is logged. If it passes, a second model step drafts a reply, and a human checkpoint approves it before it is sent.](../../../assets/diagrams/architecture/pattern-chaining.svg)

</div>
<figcaption>Chaining: each step works on the last one's output, with a code check in between.</figcaption>
</figure>

A customer emails about a missing package. The first step extracts the order number and the problem. Code checks that the order number has the right format and belongs to this customer. A second step drafts a reply, and a person approves it before it goes out.

Use chaining when the task splits into clear steps that always happen in the same order. Each step gets a smaller, easier job, which usually makes it more accurate, at the cost of extra latency.

Watch for:

- Untrusted data enters at the first step and can travel down the whole chain. The code checks between steps are where you catch it.
- Authority is used only at the last step, when something is sent or saved. That's where the human checkpoint goes.
- A failed check should stop the chain and log it, not pass a half-valid result to the next step.

## Routing

A classifier step reads the input and sends it down one of several specialized paths.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Routing diagram. Scrolls horizontally on small screens.">

![Left to right: an untrusted customer message goes to a model that returns one label. A code step accepts only allowed labels and routes the message to one of three paths: a tracking path with read-only tools, a redelivery path with a write tool that asks for confirmation first, or a human checkpoint when the label is unknown or the classifier is unsure.](../../../assets/diagrams/architecture/pattern-routing.svg)

</div>
<figcaption>Routing: a classifier step picks one specialized path.</figcaption>
</figure>

Customer messages go to a model that labels each one as tracking, redelivery, or something else. Tracking questions go to a path with read-only tools. Redelivery requests go to a path that can change bookings but asks the customer to confirm first. Anything else goes to a person.

Use routing when inputs fall into distinct groups that need different instructions or tools. Each path stays focused, and the riskiest tools live only on the paths that need them.

The classifier's label is model output, so your code should treat it as untrusted:

```ts
const ROUTES = ["tracking", "redelivery"] as const;
type Route = (typeof ROUTES)[number] | "human";

// The model's label is a suggestion. Code decides which path actually runs.
export function chooseRoute(label: string, confidence: number): Route {
  const known = (ROUTES as readonly string[]).includes(label);
  if (!known || confidence < 0.8) return "human";
  return label as Route;
}
```

Watch for:

- A crafted message can try to steer the classifier toward a path with more power. Keep write tools on as few paths as possible, and have those paths check authorization themselves.
- Send unknown labels and low-confidence results to a person or a safe default, never to the most capable path.
- One bad routing decision affects one request, so failures here stay small if each path does its own checks.

## Parallelization

Several model calls run at the same time and code combines their outputs. It comes in two forms. In sectioning, each call handles a different part of the task. In voting, several calls answer the same question and code compares the answers.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Parallelization diagram. Scrolls horizontally on small screens.">

![Left to right: an untrusted request goes to a code step that splits it into fixed parts. Three model calls handle part A, part B, and part C at the same time. A code step combines their outputs, or takes a vote when all three answered the same question, and returns one result.](../../../assets/diagrams/architecture/pattern-parallelization.svg)

</div>
<figcaption>Parallelization: fixed parts run at once, and code combines or votes.</figcaption>
</figure>

Before a reply goes out, three checks run at the same time: one checks that the facts match the shipment record, one checks the tone, and one checks it against the redelivery policy. Code combines the results, and the reply is sent only if all three pass. That's sectioning. For voting, you might ask three calls whether a message looks like a refund scam and act only if at least two agree.

Use parallelization when the parts are independent and you want speed, or when you want more confidence from several independent answers.

Watch for:

- Every parallel call sees the same untrusted input, so an injection reaches all of them at once. Voting helps against random mistakes, much less against an attack that fools every call the same way.
- Combining is done by code, with clear rules for disagreement and failure, such as what happens when one of three checks times out.
- Parallel calls multiply cost. Set limits per call and for the whole request.

## Orchestrator and workers

A model looks at the task, decides at run time what subtasks it needs, hands them to workers, and combines their results. It looks like parallelization, but the subtasks aren't fixed in advance.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Orchestrator and workers diagram. Scrolls horizontally on small screens.">

![Left to right: an untrusted task goes to an orchestrator model that plans subtasks at run time. A code step checks each subtask brief for permissions and limits before two read-only worker models run. Their results return as untrusted input to a model that combines them, and a human checkpoint approves any write before it happens.](../../../assets/diagrams/architecture/pattern-orchestrator-workers.svg)

</div>
<figcaption>Orchestrator and workers: a model plans the subtasks, and code checks every brief before a worker runs.</figcaption>
</figure>

The monthly carrier report from [Single Agent vs. Multi-Agent](/learn/architecture/single-agent-vs-multi-agent/) is this pattern. The orchestrator decides which carriers and data sources to look at, read-only workers research them, and the orchestrator writes the report. If the report triggers any change, such as dropping a carrier, a person approves it first.

Use it when the task is too open-ended to split in advance, and the parts can run without agreeing with each other.

Watch for:

- The orchestrator's plan is model output. Check every brief in code before a worker starts: allowed tools, permissions no wider than the caller's, and a step limit.
- Worker results come back as untrusted input, and a poisoned source read by one worker can reach the final result.
- Failures spread through the orchestrator, so give the whole job a budget and stop it when workers keep failing.

## Evaluator-optimizer

One model call generates a result, another evaluates it against written criteria, and the feedback goes back for another round until it passes or hits a limit.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Evaluator-optimizer diagram. Scrolls horizontally on small screens.">

![Left to right: a task goes to a model that generates a draft. A second model evaluates it against written criteria, and a code step checks the score and the number of rounds. If it passes, the result is returned. If it fails, the evaluator's feedback goes back to the generator for another round. After three failed rounds, the run stops at a human checkpoint.](../../../assets/diagrams/architecture/pattern-evaluator-optimizer.svg)

</div>
<figcaption>Evaluator-optimizer: generate, evaluate, and revise until it passes or hits the round limit.</figcaption>
</figure>

A model drafts a delay notice for customers. A second model checks it against a short list of criteria: it gives the new date, it apologizes once, it doesn't promise a refund, and it's under 120 words. Failed checks go back to the drafter as feedback. After three failed rounds, a person takes over.

Use it when you can write down what "good" looks like and a second pass reliably improves the result.

Watch for:

- The loop needs a hard round limit in code. Without one, a generator and an evaluator that disagree can run up cost indefinitely.
- An evaluator is a model too. It can be fooled by the same content that fooled the generator, so keep hard rules, like "never promise a refund," as code checks wherever you can.
- Log each round, so you can see why a result passed or why the loop gave up.

## Choosing a pattern

| If the task... | Start with |
| --- | --- |
| Has fixed steps in a fixed order | Prompt chaining |
| Falls into a few distinct types | Routing |
| Splits into fixed, independent parts, or needs several opinions | Parallelization |
| Needs subtasks you can't predict in advance | Orchestrator and workers |
| Has clear criteria and improves with feedback | Evaluator-optimizer |
| Needs open-ended steps that depend on what it finds | A single agent with tools |

Real systems combine these. The support assistant might route messages first, run a short chain on the redelivery path, and finish with parallel checks on the reply. Start with the simplest pattern that handles the task, and add another only when you can measure the improvement.

## Security across the patterns

| Pattern | Where untrusted data enters | Where authority is used | Where a failure spreads | Human checkpoint |
| --- | --- | --- | --- | --- |
| Prompt chaining | The first input | The final step | Down the chain, unless a check stops it | Before the final action |
| Routing | The input and the label | Inside the chosen path | Usually one request | Unknown or unsure labels, and risky paths |
| Parallelization | Every parallel call at once | Usually only after combining | To every call that saw the same input | Before acting on the combined result |
| Orchestrator and workers | The task, and every worker result | The orchestrator, and any worker with write tools | Through the orchestrator to the whole job | Before any write |
| Evaluator-optimizer | The task and the draft | Only after the loop ends | Across rounds, until the limit | After the round limit |

Two rules apply to every pattern. Model output never decides on its own what runs next or with what permissions: code checks the label, the plan, the brief, or the score. And every loop and fan-out has a limit enforced by the application. For the boundaries themselves, see [Trust Boundaries for Agent Systems](/learn/security/trust-boundaries-for-agents/), and for the terms used here, the [Agentic AI Glossary](/learn/foundations/agentic-ai-glossary/).

## What to learn next

This completes the architecture series. The next stage turns to security in practice, starting with tool permissions and excessive agency: how to give an agent only the access its task needs.
