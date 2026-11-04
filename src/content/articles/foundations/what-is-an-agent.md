---
title: What Is an AI Agent?
description: A clear starting point for understanding agents, ordinary model calls, and the systems that connect models to tools.
topic: Foundations
level: Beginner
publishedAt: 2026-11-03
order: 1
readingMinutes: 6
tags: [agents, fundamentals, llms]
featured: true
draft: false
---

An AI agent is a software system that uses a model to decide what to do next in pursuit of a task. Depending on the design, it may call tools, inspect their results, and continue until it reaches a stopping condition.

That sounds simple, but the word **agent** is used for systems with very different capabilities. This guide gives us a working definition and a mental model for the rest of the series.

## Start with a familiar model call

A basic language model interaction takes input and returns output:

```text
question → model → answer
```

This is useful for summarizing, explaining, or drafting. The application chooses the prompt and the model responds. The model does not, by itself, take actions in your software environment.

## Add tools and a bounded loop

An agentic system can be given tools, such as a search function or a way to look up an order. The application decides which tools exist and what each tool is allowed to do. A model can select a tool, receive its result, and use that result to choose a next step.

```text
request → model chooses → application checks → tool runs
              ↑                            ↓
              └──────── tool result ────────┘
```

The application should control the loop and decide when it ends. A useful agent therefore has more than a model: it has instructions, available context, tools, state, limits, and rules for stopping or asking a person for help.

## A practical example

Imagine an assistant that answers, “Where is my package?” A simple version can ask the model to explain a tracking response already provided by the application. A tool-using version might call an authorized `getShipmentStatus` function, then explain the returned status.

The second system is more capable, but it also has more responsibilities. The application must authenticate the user, check that the shipment belongs to them, validate the tool arguments, and handle errors. The model's decision to call a function is not an authorization check.

## Agent, workflow, or model call?

| Approach | Who chooses the next step? | Good fit |
| --- | --- | --- |
| Model call | The surrounding application | One request and one response |
| Fixed workflow | Explicit application logic | Predictable steps and strict rules |
| Agentic loop | A model selects among bounded actions | Tasks where the next step depends on new information |

These are design choices along a spectrum. An application can combine a fixed workflow with one or two agentic decisions. Many useful systems are deliberately constrained instead of being fully autonomous.

## A working definition for this blog

We will use **agent** to mean a model-enabled system that can select actions toward a goal, often in a loop that uses tools and state. We will use **agentic system** for the full application around it: the model, tools, data, policies, runtime, and human oversight.

This distinction keeps discussions of capability and security grounded in the whole system rather than the model alone.

## What to learn next

Next, follow the agent loop through its decision, tool call, result, and stop condition in [The Agent Loop, Step by Step](/learn/architecture/the-agent-loop/). Then compare agents with fixed workflows before choosing a framework.

## Sources and further reading

- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) — practical distinctions between workflows and agents, with examples of common patterns.
- [Building agents](https://developers.openai.com/tracks/building-agents) — an overview of models, tools, state, and orchestration as agent-building primitives.

The comparison above is an editorial mental model. Implementations differ, and the term “agent” does not have one universally enforced definition.
