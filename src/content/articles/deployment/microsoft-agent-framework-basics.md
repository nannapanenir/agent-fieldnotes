---
title: "Microsoft Agent Framework Basics: Agents, Workflows, and Running on Foundry"
description: What Microsoft Agent Framework is, which languages it supports, how its agents, tools, workflows, and built-in orchestrations fit together, and how it runs as a Foundry hosted agent, with the shipment agent's tools wrapped in Python.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-18
order: 8
stage: 8
stageOrder: 6
readingMinutes: 8
tags: [deployment, foundry, agent-framework, frameworks, orchestration, python]
featured: false
draft: false
---

Microsoft Agent Framework is Microsoft's open-source code framework for building agents and multi-agent workflows. It's the framework Microsoft points to for code-first agents on Foundry: the hosted-agent quickstart uses its samples, it has its own Foundry hosting package, and Learn's workflow page recommends it for new orchestration code now that Foundry's visual workflows are being retired on December 1, 2026.

This article covers what the framework gives you, how it maps to the patterns in [Orchestration Patterns](/learn/architecture/orchestration-patterns/), and how it relates to the hand-written loop from the Stage 4 tutorials. It was checked against Microsoft Learn on 2026-11-18. The example was type-checked with `agent-framework-core` 1.26.0 and `agent-framework-anthropic` 1.0.0b261112, a prerelease.

## Languages

Learn's overview shows Agent Framework for .NET, Python, and Go, with Go in public preview and some features, such as declarative agents and functional workflows, not implemented there. There's no TypeScript or JavaScript version. So the example in this article is Python only. A TypeScript team that wants a framework on Foundry has to pick another one, such as those compared in [Framework Comparison by Use Case](/learn/frameworks/framework-comparison-by-use-case/), or keep its own loop.

## What's in it

Learn groups the framework into four areas:

| Area | What it gives you |
| --- | --- |
| Agents | An agent wraps a model client, instructions, tools, and MCP servers. Clients exist for Microsoft Foundry, Anthropic, Azure OpenAI, OpenAI, Ollama, and others |
| Harness agent | An agent with more built in, for long multi-step tasks: planning and to-do tracking, context compaction, file access and memory, tool approval, and observability |
| Workflows | Explicit execution paths that connect agents and functions, with checkpoints and human input |
| Integrations | Model providers, tools, context providers, middleware, evaluation, and UI frameworks |

Underneath are the building blocks: model clients, an agent session for conversation state, context providers for memory, middleware that can intercept agent actions, and MCP clients.

## An agent with the shipment tools

The framework can run Claude through `AnthropicFoundryClient`, which calls a Claude deployment in your Foundry resource, the same deployment as in [Foundry Models](/learn/deployment/foundry-models/). Tools are Python functions with the `@tool` decorator. The framework builds each tool's argument schema from the function's type hints and validates arguments with pydantic before calling it.

The easiest way to keep the shipment agent's security checks is to have each tool call the Stage 4 tool runner instead of reimplementing it. The runner still checks ownership against the signed-in customer, applies per-question call limits and read retries, and goes through the Stage 7 circuit breaker:

```python
# maf/shipment_agent.py
from typing import Annotated

from agent_framework import Agent, FunctionTool, tool
from agent_framework.anthropic import AnthropicFoundryClient
from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider

from agent.config import MODEL, SYSTEM_PROMPT
from agent.runner import create_tool_runner
from agent.tools import ApprovalRequest, Session


async def no_approver(request: ApprovalRequest) -> bool:
    return False


# One agent per signed-in customer and question, like one Stage 4 runner per question.
def shipment_agent(resource: str, session: Session) -> Agent:
    run_tool = create_tool_runner(session, no_approver)  # ownership checks, call limits, retries, breaker

    @tool(approval_mode="never_require")
    async def get_shipment_status(
        tracking_id: Annotated[str, "Carrier tracking number: capital letters and digits, no spaces."],
    ) -> str:
        """Get the live status of one of the signed-in customer's packages."""
        return (await run_tool("get_shipment_status", {"tracking_id": tracking_id})).content

    @tool(approval_mode="never_require")
    async def list_my_shipments() -> str:
        """List the signed-in customer's recent shipments."""
        return (await run_tool("list_my_shipments", {})).content

    tools: list[FunctionTool] = [get_shipment_status, list_my_shipments]
    client = AnthropicFoundryClient(
        model=MODEL,  # the Claude deployment's name in your Foundry resource
        resource=resource,
        azure_ad_token_provider=get_bearer_token_provider(DefaultAzureCredential(), "https://ai.azure.com/.default"),
    )
    return Agent(client=client, instructions=SYSTEM_PROMPT, tools=tools)
```

This version includes only the two read tools. Calling `get_shipment_status` through the framework for customer `c-100` returned the package's status for `1Z999AA10123456784` and `{"error": "not_found", "kind": "denied", "retryable": false}` for `1Z999AA10123456786`, which belongs to another customer. That's the same result as the hand-written runner, because it is the hand-written runner. To run it: `await shipment_agent(resource, Session("c-100")).run("Where is package 1Z999AA10123456784?")`.

For the booking tool, the framework's own approval feature is the better fit. Marking a tool `approval_mode="always_require"` makes the framework pause before running it and hand an approval request back to your application, which asks the customer and resumes the run with the answer. Learn's tools page notes this works for tools your application runs locally; tools hosted by a provider follow that provider's approval behavior. The framework's samples use `approval_mode="never_require"` only "for sample brevity" and recommend `"always_require"` in production for tools with side effects.

Two things the framework doesn't do for you, compared with the Stage 4 and Stage 7 code: it doesn't know about your spend budget or your kill switch. Its middleware can intercept agent and function calls, which is where those checks would go, or you keep them in the code that calls the agent.

## Workflows

A workflow is an explicit graph of steps: agents, functions, and points where a person provides input. Learn describes two Python APIs over the same runtime: a graph API (`WorkflowBuilder`), with executors joined by edges and conditions, fan-out and fan-in, and checkpoints at each "superstep"; and an experimental functional API (`@workflow`), where ordinary Python control flow describes the steps. .NET and Go use the graph API.

Workflows support checkpointing, so a long-running process can resume after a restart, and human-in-the-loop steps that pause for input. Those are the properties that matter for agent work that waits on people, like a redelivery that needs a customer's confirmation.

## Built-in orchestrations

For common multi-agent setups, the framework ships five orchestrations:

| Orchestration | What it does | Closest pattern in Orchestration Patterns |
| --- | --- | --- |
| Sequential | Agents run one after another, in a fixed order | Prompt chaining |
| Concurrent | Agents run in parallel on the same input | Parallelization |
| Handoff | Agents pass control to each other based on the conversation | Routing |
| Group chat | Agents work in a shared conversation | No direct equivalent; a multi-agent conversation |
| Magentic | A manager agent coordinates specialist agents as it goes | Orchestrator and workers |

Learn notes that orchestrations support human-in-the-loop steps through tool approval and requests for information. The advice from [Single Agent vs. Multi-Agent](/learn/architecture/single-agent-vs-multi-agent/) still applies: the shipment assistant is one agent with three tools, and adding agents adds cost, latency, and places for errors to compound. Reach for an orchestration when the task really splits into parts with different instructions or permissions.

## Running on Foundry

An Agent Framework agent runs on Foundry as a hosted agent. Learn's "Host Microsoft Agent Framework agents" page uses a hosting package, `agent-framework-foundry-hosting`, which wraps an agent in a server for either the Responses protocol (`ResponsesHostServer`) or the Invocations protocol (`InvocationsHostServer`). It replaces the hand-written handler from [Deploy a Hosted Agent to Foundry](/learn/deployment/deploy-a-hosted-agent-to-foundry/): you build the agent, wrap it, and deploy with `azd` as before. The rest of that tutorial applies unchanged, including the agent identity, the role grants, and the cost model.

One detail to plan for: Learn's sample builds a single agent when the server starts. The shipment agent is built per customer, because the customer decides which packages the tools may see. When you host it, keep that per-request: take the customer from the trusted caller, as the hosted-agent tutorial does, and build the tools for that customer on each request. Don't take the customer from anything the model or the conversation says.

The framework also replaces Foundry's visual workflows. Learn's workflow page says Foundry is retiring them on December 1, 2026, recommends Agent Framework for new orchestration, and says existing YAML workflow definitions can keep running when deployed as a hosted agent.

## When to use it

Compared with the hand-written loop from Stage 4, Agent Framework gives you a tested tool-calling loop, argument validation, sessions, approval handling, middleware, workflows with checkpoints, and the Foundry hosting integration. You give up some control over the loop's details, and you add a dependency that updates often: several of its packages were prereleases on 2026-11-18.

It's a strong choice for a Python or .NET team that's deploying to Foundry anyway, especially once you need workflows or human-in-the-loop steps. For a TypeScript team, or one that wants to run anywhere, the hand-written loop or another framework fits better. The method in [How to Choose an Agent Framework](/learn/frameworks/choosing-an-agent-framework/) applies: build the same task in each candidate and run the same evaluations.

## Security implications

- Model output is untrusted, framework or not. Learn's own Anthropic provider page warns: treat model output and model-generated tool calls as untrusted input, and validate them before code performs side effects. Pydantic validation of arguments covers their shape. The ownership check still has to happen inside each tool, as it does here through the Stage 4 runner.
- Approvals must be enforced. `approval_mode="always_require"` makes the framework stop before the tool runs, which is enforcement in code. Use it for every tool with side effects, and show the customer the exact values from your records, as in [Human Approval for Sensitive Actions](/learn/security/human-approval-for-sensitive-actions/). OWASP's Top 10 for Agentic Applications (2026) lists the misuse of tools as Tool Misuse (ASI02).
- Multi-agent setups add trust boundaries. In a handoff or group chat, one agent's output becomes another agent's input. Treat it as untrusted, and give each agent only the tools its role needs. OWASP lists Insecure Inter-Agent Communication (ASI07) and Cascading Failures (ASI08) for these setups.
- A framework is a dependency. Agent Framework and its provider packages run with your agent's permissions. Pin versions, especially for prereleases, and review updates (OWASP ASI04).

## What to learn next

Tools are where an agent's power and risk both come from. The next article, Foundry Tools, covers the tools Foundry can attach to an agent (built-in tools, MCP servers, OpenAPI tools, and Toolbox) and how to choose among them with least privilege.
