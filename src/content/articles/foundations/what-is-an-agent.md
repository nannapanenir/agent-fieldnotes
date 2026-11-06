---
title: What Is an AI Agent?
description: Model call, chatbot, workflow, or agent? Learn the one question that tells them apart, see each applied to the same task, and decide when an agent is worth it.
topic: Foundations
level: Beginner
publishedAt: 2026-11-03
updatedAt: 2026-11-05
order: 1
readingMinutes: 8
tags: [agents, fundamentals, llms, workflows, chatbots]
featured: true
draft: true
---

An AI agent is a software system in which a language model chooses the next step toward a goal: which tool to call, what to look at next, and when the task is done. The application around the model sets the limits and carries out every action.

The word "agent" gets attached to almost anything that uses a model. The quickest way to tell these systems apart is to ask who chooses the next step. The answer tells you how predictable the system will be and how much of the control has to live in your code.

## One task, four ways to build it

Take a single request: a customer asks, "Where's my package?" Here are four ways to answer it, from least to most autonomous.

### 1. A model call

Your code looks up the shipment, then sends the tracking data to the model with a prompt like "Explain this status in one friendly sentence." The model returns one answer, and that's the end.

The application chose every step, and the model only turned data into words. This is the simplest and most predictable option, and it's often enough.

### 2. A chatbot

The customer chats with a model across several turns. The application keeps the conversation history and sends it back each turn, so the model can follow the thread. A plain chatbot can only talk, though. It answers from what's in the conversation and what the model already knows, so it can't look up this customer's package.

The user drives the conversation forward one turn at a time. "Chatbot" names the back-and-forth interface. Many chat products can also call tools, and when they do, they count as agents in this guide.

### 3. A fixed workflow

Your code defines the steps, and the model fills in one of them:

1. Code extracts the tracking ID from the message, perhaps with a model call.
2. Code calls the shipping API with that ID.
3. A model writes the reply from the API result.

The path is the same every time. If the API fails, your code decides what happens. Workflows are predictable, easy to test, and cheap, which makes them the right choice whenever you can write the steps down in advance.

### 4. An agent

The application gives the model a goal, instructions, and a set of tools, such as `getShipmentStatus` and `requestRedelivery`. The model decides what to do: look up the shipment, notice it's held at a depot, check redelivery options, then answer. The application checks every proposed action before running it and stops the loop when the task is done or a limit is reached.

The model chooses the next step, but only from the actions the application allows. Use an agent for requests where the right next step depends on what the last step returned.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Diagram of four ways to use a model. Scrolls horizontally on small screens.">

![Four side-by-side lanes. Model call: the application sends one request and gets one answer. Chatbot: user message, model, reply, repeating each turn without taking actions. Fixed workflow: code step, model task, code step, answer, the same path every time. Agent: the model proposes, the application checks, a tool runs, and the application decides whether it is done, looping until a stop condition.](../../../assets/diagrams/foundations/agent-spectrum.svg)

</div>
<figcaption>Four designs for the same task, labeled by who chooses the next step.</figcaption>
</figure>

**How to read the diagram.** Each lane is one way to answer the same request, and its header names who chooses the next step. Outlined boxes are steps your application or code controls. In the model call and the workflow, the code controls every step. In the agent lane, the application still checks each action and decides when to stop, while the model chooses what to try next. Dashed arrows show repetition: a chatbot repeats once per user turn, and an agent loops until a stop condition.

## How the four compare

| | Model call | Chatbot | Fixed workflow | Agent |
| --- | --- | --- | --- | --- |
| Who chooses the next step | Your code | The user, turn by turn | Your code | The model, within limits |
| Can it take actions? | No | No | Yes, the actions your code calls | Yes, through allowed tools |
| Remembers the conversation | No | Yes, through stored history | Usually no | Yes, through stored state |
| Predictability | Very high | High | High | Lower; behavior varies by input |
| Good fit | One-shot text tasks | Q&A, drafting, explanations | Known, repeatable processes | Tasks whose steps depend on new information |
| Main thing to watch | Prompt quality | Wrong or made-up answers | Edge cases the steps don't cover | Actions, limits, and what the model is allowed to reach |

Real systems often mix these designs. A support tool might run a fixed workflow for refunds and hand open-ended questions to an agent.

## Which one do I have?

Ask three questions about the system:

1. Does a model choose which action happens next? If no, it's a model call, a chatbot, or a workflow.
2. Can those actions reach outside the conversation, such as reading data or changing something? If no, it's a chatbot at most.
3. Does it keep going until a stop condition, rather than after one fixed pass? If yes, it's an agent.

If all three answers are yes, you're building an agent, and your code is responsible for what it can reach and when it stops.

## When not to build an agent

Start with the simplest design that works, and move toward an agent only when you need to.

- A model call is enough when one prompt and one answer do the job: summarizing, classifying, rewording.
- A workflow fits when you can write the steps down. It's predictable, easy to test, and cheaper to run.
- An agent fits when the steps can't be known in advance, for example when the next lookup depends on what the last one returned and there are too many paths to script.

Agents cost more per task and are harder to test, so the flexibility has to pay for itself.

## What makes up an agent

Every agent has four parts: a model that proposes, instructions that guide it, tools that the application runs on its behalf, and state that the application keeps because the model forgets between calls. [The Parts of an AI Agent](/learn/architecture/agent-components-model-tools-state/) covers each part and which one enforces which rule.

## Why this matters for security

As a system moves from a model call toward an agent, more of the responsibility shifts onto your code.

- When the model picks a tool, that choice is a request. In the package example, the application still has to confirm on every call that the user is signed in and that the shipment belongs to them.
- An agent needs step, time, and cost limits, plus a clear rule for when to stop or hand off to a person.
- A manipulated model could misuse any tool the agent can call, so give it only the tools the task needs.

The design questions in [Trust Boundaries for Agent Systems](/learn/security/trust-boundaries-for-agents/) apply from the first tool you add.

## A working definition for this site

On Agent Fieldnotes, **agent** means a model-enabled system that chooses actions toward a goal, usually in a loop that uses tools and state, within limits the application enforces. **Agentic system** means the whole application around it: the model, tools, data, policies, runtime, and human oversight.

This is an editorial definition. There is no single official one, and vendors use the word differently. We keep the two terms separate because most of the controls this site discusses live in the application around the model.

## What to learn next

Follow one turn of an agent from request to safe stop in [The Agent Loop, Step by Step](/learn/architecture/the-agent-loop/). Then see what each part of the system is responsible for in [The Parts of an AI Agent](/learn/architecture/agent-components-model-tools-state/).
