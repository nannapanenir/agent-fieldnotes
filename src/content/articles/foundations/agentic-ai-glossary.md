---
title: Agentic AI Glossary
description: Plain definitions of the agent and agent-security terms used across Agent Fieldnotes, from tool call and context window to prompt injection, least privilege, and agent identity.
topic: Foundations
level: Beginner
publishedAt: 2026-11-05
order: 2
readingMinutes: 10
tags: [glossary, agents, fundamentals, security, terminology]
featured: false
draft: false
---

This page defines the terms used across Agent Fieldnotes. Other articles link here the first time they use a term instead of defining it again.

Most definitions are this site's working conventions. Vendors and frameworks often use the same words a little differently. When a term comes from a specific standard or product, such as the OWASP Top 10 lists, NIST, the Model Context Protocol, or Microsoft Azure, the entry says so, and that source's own definition wins.

If you're new to agents, read [What Is an AI Agent?](/learn/foundations/what-is-an-agent/) first.

## The basics

### Agent

A model-enabled system that chooses actions toward a goal, usually in a loop that uses tools and state, within limits the application enforces. On this site, "agent" means the running system, with the model as one part of it. The definition is this site's own; no official one exists.

### Agentic system

The whole application around an agent: the model, tools, data, policies, runtime, and human oversight. Security reviews look at the agentic system, because most of the controls live outside the model.

### Model (LLM)

The large language model that reads text and produces text, including requests to call tools. A model only proposes. Running tools, reading databases, and remembering earlier calls are all the application's job.

### Model call

One request to a model and one response back. A single model call with no tools and no loop is the simplest way to use a model, and often the right one.

### Workflow

A system where your code defines the steps in advance and the model fills in one or more of them, such as extracting a field or writing a reply. The path is the same every time. Compare with an agent, where the model chooses the next step.

### Chatbot

A conversational interface where the user and the model take turns. A plain chatbot only talks. When a chat product can also call tools to look things up or take actions, this site treats it as an agent.

## How an agent runs

### Agent loop

The repeating cycle at the center of an agent: send the model the current context, receive a proposal, check it, run any allowed tool, add the result to the context, and repeat until a stop condition. [The Agent Loop, Step by Step](/learn/architecture/the-agent-loop/) walks through one full turn.

### Turn and step

A turn starts when the user sends a message and ends when the agent replies. A step is one pass through the loop inside a turn. A single turn can take many steps if the agent calls several tools.

### Instructions (system prompt)

Text the application sends with every model call to set the agent's role, tone, and rules. Instructions guide the model's behavior but can't enforce anything. A rule that must hold, such as "only show the signed-in user's orders," belongs in code.

### Tool

A capability the application offers the model, described by a name, a plain-language description, and an input schema. The model sees the description and can ask to use the tool. The application decides whether the request is allowed and runs the code. Some providers also offer hosted tools, such as web search, that run on the provider's side, outside your application's direct control.

### Tool call (function calling)

The model's structured request to use a tool, for example `getShipmentStatus` with `{ "trackingId": "1Z999" }`. The application checks the request before anything runs. Many providers call this function calling.

### Tool result

What the application sends back to the model after running a tool. Treat tool results as untrusted input: they can contain errors, sensitive data, or text written to manipulate the model.

### Stop condition

The rule that ends the loop. Common stop conditions: the model gives a final answer, a step or time limit is reached, the cost budget runs out, or a human needs to approve something before work continues. The application enforces these, so the model can't talk its way past them.

### Budget (limits)

Caps on how much an agent can do in one run: number of steps, elapsed time, tokens, cost, or tool calls. Budgets keep a confused or manipulated agent from looping forever or running up a large bill.

### Orchestration

The logic that decides how steps, tools, and agents fit together: what runs in what order, what runs in parallel, and who hands work to whom. Orchestration can be fixed code, a model's choices, or a mix of both.

### Multi-agent system and handoff

A multi-agent system splits work between several agents, each with its own instructions and tools. A handoff is when one agent passes control of a task to another. More agents mean more boundaries to secure, so start with one agent unless the task clearly needs more.

## Context and state

### Token

The unit a model reads and writes, roughly a short word or part of a word. Models are priced and limited in tokens.

### Context window

The maximum amount of text, measured in tokens, that a model can take in for one call. Everything the model knows about the current task has to fit: instructions, conversation history, tool definitions, and tool results.

### Context

What the application actually sends to the model on a given call. Choosing what goes into the context, and what stays out, is one of the main jobs of the application.

### Session state

What the application stores for the current conversation or task, such as the message history and tool results so far. The model forgets everything between calls, so the application sends the relevant state back each time.

### Memory (long-term memory)

Information the application saves across sessions, such as a user's preferences, and adds to the context in later conversations. Memory is a database the application controls, with the same access rules as any other user data. See [The Parts of an AI Agent](/learn/architecture/agent-components-model-tools-state/) for how session state and memory differ.

### Retrieval (RAG)

Looking up relevant documents or records and adding them to the context before the model answers. RAG stands for retrieval-augmented generation. Retrieved text comes from outside the conversation, so treat it as untrusted input.

### Confabulation (hallucination)

When a model states something false or made up as if it were true. NIST's Generative AI Profile calls this confabulation; most people say hallucination.

## Connecting tools and data

### Model Context Protocol (MCP)

An open protocol for connecting AI applications to tools and data. An MCP host is the AI application, an MCP client is the connector inside it that talks to one server, and an MCP server exposes capabilities. Servers offer three kinds of capability: tools the model can call, resources the application can read as context, and prompts, which are reusable templates. These are protocol terms from the MCP specification.

### Provider-hosted tool and client-side tool

A client-side tool runs in your application: you write the code, and you check every call. A provider-hosted tool runs on the model provider's infrastructure, and you configure it rather than run it. The two sit on different sides of a trust boundary and need different controls.

## Control and oversight

### Guardrail

Any check that limits what an agent can see, say, or do. Examples include input filters, output checks, tool allowlists, and spending limits. A guardrail that exists only in the instructions is guidance the model can ignore; one enforced in code is a control.

### Human-in-the-loop

A design where a person reviews or approves some actions before the agent completes them. It's most useful for actions that are hard to undo, such as payments, deletions, or messages sent on someone's behalf.

### Approval gate

A specific point in the loop where the application pauses and waits for a person to approve a proposed action. The application enforces the gate, so the model can't skip it.

## Security terms

### Trust boundary

A line between parts of a system that trust each other differently, such as between the user and your application, or between your application and a third-party tool. Data that crosses a boundary needs checking. [Trust Boundaries for Agent Systems](/learn/security/trust-boundaries-for-agents/) shows where these lines fall in a typical agent.

### Untrusted input

Any text the agent receives that you didn't write and haven't verified: user messages, web pages, emails, documents, retrieved records, and tool results. Untrusted input can contain instructions aimed at the model.

### Prompt injection (direct and indirect)

An attack where text manipulates a model into ignoring its instructions or taking actions it shouldn't. In direct prompt injection, the attacker types the text into the conversation. In indirect prompt injection, the text is hidden in content the agent reads, such as a web page, email, or document. Indirect injection matters most for agents, because they read content and then act. The OWASP Top 10 for LLM Applications lists prompt injection as a top risk.

### Goal hijack

An attack that redirects an agent's objective or decision path, usually through content the agent reads, so it pursues the attacker's goal. This term comes from the OWASP Top 10 for Agentic Applications (2026), where it's listed first, as ASI01.

### Authorization

Deciding whether a specific action is allowed for a specific user. When a model picks a tool, nothing has been authorized yet: the application still has to check, on every call, that the action is permitted for the person the agent is working for.

### Least privilege

Giving each part of a system only the access its task needs. For an agent, that means read-only access when it only needs to read, and per-user access instead of one powerful shared account.

### Least agency

OWASP's extension of least privilege to agents: give an agent only the autonomy the task requires. An agent that drafts emails for review needs less autonomy than one that sends them.

### Excessive agency

An OWASP term, listed as LLM06 in the Top 10 for LLM Applications (2025), for an agent that can do more damage than its task requires. OWASP names three root causes: excessive functionality (tools it doesn't need), excessive permissions (more access than the task needs), and excessive autonomy (high-impact actions with no check or approval).

### Sandbox

An isolated environment where untrusted code or commands run with limited access to files, the network, and other systems. Agents that write and run code need a sandbox, so a bad command can't reach anything important.

### Managed identity

A Microsoft Azure feature that gives an Azure resource, such as a container app, its own identity in Microsoft Entra ID, so it can reach other Azure services without stored passwords or keys. A managed identity represents the resource running the agent, not the agent itself.

### Agent identity

An identity that represents an agent itself, so its access can be granted, limited, logged, and revoked separately. In Microsoft Entra Agent ID, an agent identity is a special kind of service principal created from an agent identity blueprint. Other platforms handle agent identity in their own ways.
