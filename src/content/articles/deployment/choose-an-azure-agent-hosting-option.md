---
title: "Choose an Azure Agent Hosting Option: Prompt Agent, Hosted Agent, or Container Apps"
description: Three ways to run the shipment agent on Azure, compared layer by layer. What you manage and what Azure manages in a Foundry prompt agent, a Foundry hosted agent, and your own container on Azure Container Apps, and how to choose.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-18
order: 4
stage: 8
stageOrder: 2
readingMinutes: 11
tags: [deployment, foundry, azure, container-apps, hosting]
featured: false
draft: false
---

There are three reasonable ways to run the shipment assistant on Azure. You can describe it to Foundry as a prompt agent and let Foundry run it. You can package your own code as a Foundry hosted agent. Or you can run your own container on Azure Container Apps, a general serverless container service, and call Foundry or another provider for the model.

The options differ in who manages each layer: the endpoint and its authentication, the agent loop, the compute, the identity, the network, and the telemetry. This article compares them layer by layer, then works through the choice for the shipment assistant. [What Is Microsoft Foundry?](/learn/deployment/what-is-microsoft-foundry/) introduces the Foundry terms used here. The facts below were checked against Microsoft Learn on 2026-11-18.

## The three options

A Foundry prompt agent is defined entirely by configuration: instructions, a model deployment, and tools. You create it in the Foundry portal, or with the SDK, REST API, or Azure Developer CLI (`azd`) so the definition lives in source control. Foundry runs the agent loop for you, and there's no code or container to maintain. Microsoft's agent comparison table describes its cost as "per-call inference + tool usage".

A Foundry hosted agent is your own agent code, in a container. Learn lists Microsoft Agent Framework, LangGraph, the OpenAI Agents SDK, the Anthropic Agent SDK, and custom code as supported. You push an image to Azure Container Registry, or upload a .zip of your source and let Foundry build the image. When you deploy, Foundry gives the agent its own endpoint and its own Microsoft Entra identity, and runs each session in a separate VM-isolated sandbox with a persistent file system. Cost is inference and tool usage plus container compute.

Azure Container Apps runs any container, with HTTP ingress, scaling rules, revisions, and traffic splitting, and nothing agent-specific. Your agent code is the whole application: it serves requests, runs the loop, and calls a model provider. That can be a model deployed in Foundry, or another provider's API.

## Who manages what

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Grid of who manages each layer in the three hosting options. Scrolls horizontally on small screens.">

![A grid with three columns, Prompt agent, Hosted agent, and Container Apps, and seven rows. Endpoint and auth: Azure for the prompt agent, with Entra ID on the project; Azure for the hosted agent, with Entra ID and a per-agent URL; You for Container Apps, which needs ingress and authentication set up. Orchestration code: Azure for the prompt agent, where you write configuration only; You for the hosted agent and for Container Apps, where it's your container. Runtime and compute: Azure for the prompt agent, fully managed; Azure for the hosted agent, with a sandbox per session; Both for Container Apps, where you set the scale rules. Runtime identity: Azure for the prompt and hosted agents, which get an agent identity; You for Container Apps, with a managed identity. Network: Both for the prompt agent, through the Foundry resource's rules; Both for the hosted agent, which adds your virtual network for outbound traffic; You for Container Apps, through the environment's virtual network. Telemetry: Both for the prompt agent, with Foundry tracing; Both for the hosted agent, with Foundry tracing plus your own OpenTelemetry; You for Container Apps, where you wire it up. Image and patching: Azure for the prompt agent, which has no image; You for the hosted agent and Container Apps, which use your image and dependencies.](../../../assets/diagrams/deployment/hosting-responsibility.svg)

</div>
<figcaption>Who manages each layer. "Both" means Azure provides the feature and you configure it.</figcaption>
</figure>

**How to read the diagram.** Read across a row to compare one layer, or down a column to see everything one option leaves to you. The green "You" cells are work your team owns. The prompt agent column has none, the hosted agent column has two, and Container Apps has nearly all of them.

The same comparison as a table, with the details behind each cell:

| Layer | Foundry prompt agent | Foundry hosted agent | Azure Container Apps |
| --- | --- | --- | --- |
| Endpoint and authentication | Project endpoint, Microsoft Entra ID; callers need a Foundry role | Dedicated per-agent endpoint on the project, Entra ID | You enable ingress, and add built-in authentication ("Easy Auth") or your own |
| Agent loop | Foundry runs it from your instructions and tool list | Your code | Your code |
| Compute | Fully managed, scales with requests | One VM-isolated sandbox per session, 0.5 to 2 vCPU; scales to zero after an idle timeout | Containers in a Container Apps environment; you set scale rules |
| Identity the agent runs as | Agent identity in Entra | A dedicated agent identity, created at deploy time | A system- or user-assigned managed identity you enable and grant roles to |
| Network | Foundry resource network settings | Foundry resource settings, plus your own virtual network for outbound traffic | Your environment's virtual network, external or internal ingress |
| Telemetry | Foundry tracing | Foundry tracing, plus OpenTelemetry from the protocol libraries | Log Analytics and whatever tracing you add |
| Patching | Nothing to patch | Your image and its dependencies | Your image and its dependencies |
| Cost basis | Model and tool usage | Model and tool usage, plus CPU and memory across all active sessions | vCPU-seconds, GiB-seconds, and requests (Consumption plan), plus model usage wherever you call it |

Two details in that table matter more than they look.

Hosted-agent compute follows sessions, not requests. Each session gets its own sandbox, kept alive while requests arrive and released after an idle timeout, which you can set from 2 to 240 minutes with a default of 15. Learn's hosted agents page says billing "is based on CPU + memory consumed across all active sessions, so oversizing multiplies cost by your concurrency." This is the billing model [Reliability, Cost, and Runaway Loops](/learn/deployment/reliability-cost-and-runaway-loops/) warned about: a session that's stuck or looping costs money while it waits, so the time budget is a cost control as well.

Container Apps doesn't authenticate anyone by default. External ingress on an environment with a public inbound IP is reachable from the internet, and built-in authentication is a feature you turn on, not a default. Until you configure it, or check tokens in your own code, the agent's endpoint accepts anonymous requests.

## Where the tools run

For the shipment assistant, the deciding question is where `getShipmentStatus` and `requestRedelivery` run, because that's where the ownership check and the approval step live. In the Stage 4 tutorials they're code: [Add Tools and Permissions](/learn/architecture/add-tools-and-permissions/) checks that the package belongs to the signed-in customer inside each handler, and asks the customer to confirm before booking.

A prompt agent can't run your code inside its loop, so those checks have to live somewhere the agent calls:

- As an API. An OpenAPI tool lets the agent call your HTTP API. The API checks ownership on every request, using the customer's identity, not an ID the model passes in.
- As an MCP server. Same idea, over the Model Context Protocol.
- As function calls your application runs. Learn's Toolbox page lists function calling as "client-side execution": the agent returns the call to your application, which runs it and sends back the result. Your application can show the approval prompt at that point.

The step, time, token, and spend budgets from Stage 7 are harder. A prompt agent's loop is Foundry's, so you can't add a `RunBudget` to it. You rely on Foundry's own limits and the governance cost controls (in preview on 2026-11-18), plus any limits in the application that calls the agent.

A hosted agent or a Container Apps app runs the Stage 4 and Stage 7 code as it is, with its budgets, breaker, approval step, and kill switch. The difference between those two is who runs the container around it.

## Choosing for the shipment assistant

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Decision flowchart for choosing a hosting option. Scrolls horizontally on small screens.">

![Decision flowchart with two questions. Question 1: does the agent need your own code in its loop, such as budgets, an approval step, or custom checks? If no, choose a Foundry prompt agent, with tools as your API or MCP server with its own checks, or functions your application runs. If yes, question 2: should Foundry run that code, with a managed endpoint, an agent identity, sessions, governance, and a supported region? If yes, choose a Foundry hosted agent: your container, run by Foundry in a VM-isolated session sandbox. If no, choose Azure Container Apps: your container, with your own ingress, authentication, identity, and network.](../../../assets/diagrams/deployment/hosting-decision.svg)

</div>
<figcaption>Two questions decide most cases. Each answer box names the condition that leads to it.</figcaption>
</figure>

**How to read the diagram.** Start at question 1 at the top. Each box below a question begins with the answer that leads to it, "If no" or "If yes", so you can follow the path without labels on the arrows. Every path ends in one of the three hosting options.

For the shipment assistant as built in this site's tutorials, the answer to question 1 is yes: the budgets, the circuit breaker, and the kill switch are code in the loop. So the choice is between a hosted agent and Container Apps.

Choose a hosted agent when you want Foundry to own the runtime. You get a per-agent Entra identity without creating one, an endpoint that already requires Entra authentication, sessions with persistent state, Foundry tracing, and the governance policies that cover hosted agents. On 2026-11-18, Learn listed hosted agents in 31 regions, including East US, West Europe, and Sweden Central. Check the current list for yours.

Choose Container Apps when the agent is one part of a larger application you already run there, when you need your own ingress and sign-in (customers signing in to your web app, for example), when your region doesn't have hosted agents, or when you want to keep using another model provider's API directly. You take on authentication, identity, networking, and telemetry yourself, and the Stage 7 checklist applies to all of them.

Choose a prompt agent when the agent's job is mostly instructions plus tools that already enforce their own rules, such as an internal assistant over APIs that check permissions themselves. It's the fastest start and has nothing to patch. If you later need code in the loop, Learn notes you can start declarative and move to code as your needs grow.

There's also a fourth path Learn describes: call the Responses API directly from code you already run, with the agent's definition kept in your application. That's the Container Apps option with Foundry as the model and tool provider, and it doesn't need a persisted agent in Foundry.

## Security implications

Each option puts the main security work in a different place:

- Exposure and authentication. Both Foundry options put the agent behind Entra ID. A caller that only needs to talk to agents should get the Foundry Agent Consumer role, which Learn describes as least-privilege access for principals that only interact with agents, rather than Foundry User, which can also build them. On Container Apps, the endpoint is only as protected as the authentication you add.
- Where secrets live. Foundry agents authenticate to Azure services with their agent identity, so there's no key to store for Azure calls. On Container Apps, use a managed identity where Entra ID works. Learn's secrets guidance says to reference secrets stored in Azure Key Vault instead of putting values directly into the app in production. It also warns that some built-in roles can read secret values through wildcard permissions, so check what a role allows before you assign it.
- Who patches what. A prompt agent has no image. For a hosted agent or Container Apps, the base image and every dependency in it are yours to update, and they're part of your supply chain (OWASP ASI04).
- Untrusted uploads. Hosted-agent sessions keep files in `$HOME` across turns. Learn's guidance is to keep uploads separate from trusted application files and not to load code, configuration, or instructions from paths that uploads can write to. That's the same rule as treating tool output as untrusted, applied to the file system.
- Identity scope. Whatever runs the agent, its identity can reach everything it has been granted, and a successful prompt injection can try to use all of it. OWASP's Top 10 for Agentic Applications (2026) lists this as Identity and Privilege Abuse (ASI03). The identity article later in this track maps every identity in each option and the narrowest roles it needs.

## What to learn next

Whichever option you choose, it calls a model deployment. The next article, Foundry Models, covers the model catalog, deployment types, choosing a model, and the quotas and costs that come with a deployment, before the tutorials deploy the shipment assistant as a prompt agent and as a hosted agent.
