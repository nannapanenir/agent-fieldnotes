---
title: "What Is Microsoft Foundry? The Five Parts, the Names, and the Resource Model"
description: A map of Microsoft Foundry before you deploy an agent to it. The five parts (models, Agent Service, tools, Foundry IQ, and governance), what each one used to be called, and how the Foundry resource, projects, and connected services fit together.
topic: Deployment
level: Beginner
publishedAt: 2026-11-18
order: 3
stage: 8
stageOrder: 1
readingMinutes: 11
tags: [deployment, foundry, azure, microsoft-foundry]
featured: false
draft: false
---

Microsoft Foundry is Microsoft's Azure platform for building and running AI agents and the models behind them. It bundles model access, agent hosting, tools, retrieval over your own data, and governance under one Azure resource, with one set of access controls, networking settings, and policies.

This is the first article in the Microsoft Foundry track. The earlier tracks built the shipment assistant by hand and wrote a release checklist that works on any platform ([Deploying an Agent](/learn/deployment/deploying-an-agent/)). This track shows where each item on that checklist lives in Foundry. Before any tutorial, it helps to know what the platform's parts are called, because several of them have been renamed more than once, and older blog posts, answers, and samples still use the old names.

Foundry changes often. Everything here was checked against Microsoft Learn on 2026-11-18, and the article says where a feature was still in preview on that date.

## The names, old and new

Most confusion about Foundry comes from names. Microsoft's own "What is Microsoft Foundry?" page includes a table of previous concepts and their current equivalents. These are the ones you'll run into most:

| What it is | Older name | Current name |
| --- | --- | --- |
| The platform | Azure AI Studio, then Azure AI Foundry | Microsoft Foundry |
| Prebuilt AI services such as Speech, Language, and Vision | Azure AI Services | Foundry Tools (for example, Azure Speech in Foundry Tools) |
| Search and retrieval over your data | Azure AI Search | Foundry IQ |
| Fleet-wide management and policy | Foundry Control Plane | Foundry governance |
| The agent API | Assistants API (Agents v0.5 and v1) | Responses API (Agents v2) |
| Agent vocabulary | Threads, Messages, Runs, Assistants | Conversations, Items, Responses, Agent Versions |
| The resource model | A hub, plus separate Azure OpenAI and Azure AI Services resources | One Foundry resource, with projects inside it |
| The portal | Hub-based projects | Foundry (classic), kept for hub-based projects |

Two of these need care. "Foundry Tools" is the new name for the prebuilt AI services, while the tools an agent calls (web search, MCP servers, and so on) are managed through a separate feature called Toolbox. And the Learn docs themselves were mid-rename on the day this was checked: the governance overview says "Foundry governance, previously known as Foundry Control Plane", while the capability map still says "Foundry control plane". Treat both as the same thing.

Microsoft Learn also keeps separate "Foundry (classic)" pages for the older hub-based model. If a page's URL contains `foundry-classic`, it describes the old model, not the one this track uses.

## The five parts

Foundry has more features than any one article can cover, but most of them belong to one of five parts. The numbers match the diagram below.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Diagram of the five parts of Microsoft Foundry and where they live. Scrolls horizontally on small screens.">

![A Foundry resource, the Azure resource of type Microsoft.CognitiveServices/accounts with kind AIServices. Across its top is part 5, Foundry governance, covering identity, access policies, cost, and guardrails. Below it is part 1, model deployments from Foundry Models, shared by every project in the resource. Inside the resource are two projects, A and B, each a development boundary with its own assets. Each project holds part 2, Agent Service, with prompt agents, voice-based prompt agents, and hosted agents, and part 3, Toolbox, with tools such as web and file search, MCP servers, and OpenAPI tools. Outside the resource, drawn dashed as separate Azure resources with their own networking and access settings, are part 4, Foundry IQ, formerly Azure AI Search, with knowledge bases and agentic retrieval, plus Azure Storage and Azure Key Vault. The projects reach these through connections.](../../../assets/diagrams/deployment/foundry-five-parts.svg)

</div>
<figcaption>The five parts of Foundry. Parts 1, 2, 3, and 5 live in the Foundry resource; Foundry IQ is a separate resource the projects connect to.</figcaption>
</figure>

**How to read the diagram.** The solid green box is one Foundry resource. Governance (5) and the model deployments (1) sit at the resource level, so every project shares them. Each project has its own agents (2) and tools (3). Everything in the dashed boxes on the right is a separate Azure resource, including Foundry IQ (4), so its network and access settings are configured on that resource, not on Foundry.

### 1. Foundry Models

Foundry Models is the catalog of models you can deploy. Microsoft's overview describes it as more than 10,000 models from Microsoft, OpenAI, Anthropic, Meta, and others. You don't call a catalog entry directly: you create a deployment of a model in your Foundry resource, and your agents and applications call that deployment. Deployments live at the resource level, so every project in the resource can reuse them. The Foundry Models article later in this track covers choosing a model, deployment types, quotas, and cost.

### 2. Foundry Agent Service

Agent Service is the part that runs agents. On 2026-11-18, Learn describes three agent types:

- A prompt agent is defined entirely by configuration: instructions, a model, and tools. Foundry runs it for you, with no application code or containers to maintain. You can create one in the portal, or define it with the SDKs or REST API so it lives in source control.
- A voice-based prompt agent is a prompt agent that speaks and listens in real time. Foundry manages the voice orchestration, and you connect to it through a service called Voice Live (in preview on that date).
- A hosted agent is your own code, in any framework, packaged as a container. Foundry runs it with a managed endpoint, scaling, an identity, and observability.

If you already run agent code somewhere else, you can also skip the agent resource entirely and call Foundry models and tools through the Responses API.

Workflows, the visual builder for chaining agents, are in preview and are being retired. Microsoft's workflow page says Foundry is retiring workflows on December 1, 2026, and recommends Microsoft Agent Framework for new orchestration code. After that date, workflow definitions in YAML can still run when deployed as a hosted agent.

### 3. Tools, through Toolbox

An agent's tools are the actions it can take: searching the web or uploaded files, running code, calling an MCP server, calling an API described by an OpenAPI document, calling another agent, or calling your own functions. Toolbox lets a team define a curated set of tools once and expose them through a single MCP-compatible endpoint, with credentials, governance, and versioning managed in one place. Learn lists Toolboxes as generally available, and says to check the label on each individual tool in the catalog, because some are still in preview.

### 4. Foundry IQ

Foundry IQ is retrieval over your own data. Its Learn page opens with "Azure AI Search is now Foundry IQ." You build a knowledge base from knowledge sources such as Blob Storage, SharePoint, OneLake, or the public web, and agents query it. Foundry IQ uses agentic retrieval, where a model plans the queries, picks sources, runs searches in parallel, and merges the results, then returns content with citations. It can enforce the caller's permissions at query time for supported sources. On 2026-11-18, Learn listed Foundry IQ as partly generally available: the APIs are GA and the portal experience is still in preview.

Foundry IQ is the one part that isn't inside the Foundry resource. It's a separate Azure resource under the `Microsoft.Search` provider, so you secure and network it on its own.

### 5. Foundry governance

Governance is how a platform team sets boundaries for every project at once. Learn groups its built-in controls into four areas:

- Agent identity: agents get Microsoft Entra agent identities, and can call other services on behalf of a signed-in user.
- Agent access: policies for which models can be deployed, which agent kinds and container images are allowed, which tools are approved, and where hosted agents may send network traffic.
- Cost management: monitoring, model quotas, and cost controls (in preview) with spending or token budgets that can alert or block.
- Safety: guardrails on inputs, outputs, and agent interactions.

The governance page makes a point worth repeating: "The management experience isn't a substitute for enforcement." The portal shows you policies and compliance results, but each control is enforced by Azure Policy or by the service that owns it, and not every control applies the same way to every agent type. You still have to configure each control your workload needs.

## Resources and projects

Two Azure objects hold most of this together.

The Foundry resource is the top-level Azure resource, of type `Microsoft.CognitiveServices/accounts` with kind `AIServices`. That's the same resource provider as Azure OpenAI, Speech, Language, and Vision, which is why an Azure OpenAI resource can be upgraded to a Foundry resource in place, keeping its endpoint, keys, and existing policies. The resource is where you manage the settings that apply to everything inside it: networking, security, connections to other services, and model deployments.

A project is a subresource of the Foundry resource, of type `Microsoft.CognitiveServices/accounts/projects`. Learn calls it a "development boundary": a team builds and evaluates its use case in a project, reusing the resource's model deployments and connections without asking IT to set them up again. Agents, files, evaluations, and conversations belong to a project. Most new APIs work at the project scope, and Microsoft's unified project client (`azure-ai-projects` 2.x) talks to a single project endpoint.

For the shipment assistant, a sensible starting layout is one Foundry resource per environment (for example, staging and production, matching the separate keys from the release checklist), each with one project for the assistant. Learn recommends a single resource with one project as the default for one developer exploring.

The split matters for access control. Azure role-based access control (RBAC) separates control plane actions, such as creating deployments and projects, from data plane actions, such as building agents, running evaluations, and uploading files, and you can assign roles at the resource or the project scope. Learn suggests the Foundry User role for each developer and for each project's managed identity as a least-privilege starting point. The built-in Foundry roles were renamed recently: Foundry User, Foundry Owner, Foundry Account Owner, and Foundry Project Manager were previously Azure AI User, Azure AI Owner, Azure AI Account Owner, and Azure AI Project Manager. Learn notes that the role IDs and permissions didn't change, and that you may still see the old names while the rename rolls out. The identity article later in this track goes through the roles in detail.

## What's generally available

Foundry is a mix of generally available and preview features, and the mix changes month to month. Preview features come without a service-level agreement, and Microsoft doesn't recommend them for production workloads. On 2026-11-18, Learn's general availability overview listed, among others:

| Generally available | In preview |
| --- | --- |
| Agents (core), models, fine-tuning | Voice Live agents |
| Toolboxes (individual tools vary) | Workflows (retiring December 1, 2026) |
| Tracing for prompt, hosted, and external agents | Memory |
| Evaluations (some evaluators are preview) | Cost controls |
| Foundry IQ APIs | Foundry IQ in the portal |

Check the current table before you design around a feature, and record the date you checked, as this article does.

## Security implications

A managed platform moves a lot of work off your plate, and it moves some risks to new places:

- Connected resources keep their own security settings. Storage, Key Vault, and Foundry IQ are separate Azure resources, so locking down the Foundry resource's network doesn't lock down theirs. The networking article later in this track covers configuring each one.
- Governance views aren't enforcement. A compliant policy dashboard doesn't prove that every runtime action is allowed or blocked as you expect, as Microsoft's own governance page says. Keep the tests from [Evaluating Agent Security](/learn/security/evaluating-agent-security/) running against the deployed agent.
- Identities and roles are the main lever. Every agent and project gets an identity, and anything that identity can reach, a successful prompt injection can try to reach. The OWASP Top 10 for Agentic Applications (2026) covers misuse of those permissions as Identity and Privilege Abuse (ASI03). Start from Foundry User and add only what each identity needs.
- The platform is part of your supply chain. A model from the catalog, a tool from the Toolbox catalog, and an MCP server are all third-party components that your agent depends on. OWASP lists this as Agentic Supply Chain Vulnerabilities (ASI04), and NIST's Generative AI Profile (NIST AI 600-1) covers it under Value Chain and Component Integration. Pin model versions, review tools before approving them, and use the governance policies for approved models and tools as one layer among several.

## What to learn next

The next article, Choose an Azure Agent Hosting Option, compares the three ways to run the shipment assistant on Azure: a Foundry prompt agent, a Foundry hosted agent, or your own container on Azure Container Apps, with what you manage and what Azure manages in each.
