---
title: The Agent Loop, Step by Step
description: Follow a bounded agent from a user request through action selection, tool execution, observation, and a safe stop.
topic: Architecture
level: Beginner
publishedAt: 2026-11-03
order: 2
readingMinutes: 7
tags: [architecture, tools, control-flow]
featured: false
draft: false
---

An agent loop is the control flow that lets a model choose an action, receive an observation, and decide whether more work is needed. The application surrounding the model must define the available actions and enforce when the loop can continue.

## The basic sequence

1. **Receive a task.** The application validates the request and establishes who is asking.
2. **Prepare context.** Include only the information the model needs for this step.
3. **Choose an action.** The model may respond directly or request one of the tools it was shown.
4. **Check the request.** The application validates the tool name and arguments, checks authorization, and applies limits.
5. **Run the tool.** Execute the operation outside the model and capture a bounded result.
6. **Observe and continue.** Return a concise result to the model so it can finish, request another allowed action, or ask a person.
7. **Stop.** End on a final answer, a limit, a refusal, an error, or a handoff.

```text
Task → Context → Model decision → Application checks → Tool
          ↑                                           ↓
          └──── bounded observation ← Result ────────┘
```

## Why the application owns the loop

The model can propose an action, but the application executes it. Keeping those roles separate makes it possible to enforce permissions, validate arguments, set a maximum number of steps, control time and cost, and record what happened.

Treat tool output as data. A web page or retrieved document can contain instructions that conflict with the application’s policy. Passing that content back to the model does not make it trustworthy.

## Add explicit stop conditions

Never depend on the model to stop reliably on its own. Define limits such as:

- A maximum number of model and tool steps.
- A request deadline and per-tool timeout.
- A maximum token or cost budget.
- A maximum response size for tool output.
- A human approval or handoff requirement for consequential actions.
- A clear outcome for repeated tool errors or invalid arguments.

When a limit is reached, return a safe partial result or ask a person to continue. Do not silently retry a write operation unless it is safe to repeat.

## Example: package tracking

For a shipment lookup, the model can select `getShipmentStatus` and provide a tracking identifier. Before the call, the server should validate the identifier and confirm that the signed-in user can access that shipment. The tool should return only the fields needed to answer the question. If the service is unavailable, the loop should stop with a clear explanation instead of inventing a status.

## A design checklist

- Which actions are available, and which are read-only or write-capable?
- Where does authorization happen?
- What does a tool receive and return?
- Which results are untrusted?
- What are the step, time, and cost limits?
- Which actions require human approval?
- How does the system stop safely after an error?

The next useful topic is how to choose between a fixed workflow and an agentic loop. Add it under `foundations/` so its URL and navigation follow the same content structure.
