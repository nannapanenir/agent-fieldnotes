---
title: "Configure Azure Agent Identity, RBAC, and Secrets: Every Principal, Its Role, Its Scope"
description: Map every identity involved in running the shipment agent on Azure, as a Foundry prompt agent, a hosted agent, or on Container Apps. Give each the narrowest role at the narrowest scope, and replace stored secrets with Microsoft Entra ID wherever it works.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-18
order: 11
stage: 8
stageOrder: 9
readingMinutes: 9
tags: [deployment, foundry, azure, identity, rbac, secrets, security]
featured: false
draft: false
---

An agent on Azure involves more identities than it first appears. In the [hosted agent tutorial](/learn/deployment/deploy-a-hosted-agent-to-foundry/) alone there were five: you, the release pipeline, the application that calls the agent, the agent's own identity, and the project's managed identity. Each one needs some access, and each one is something an attacker would like to borrow. [Tool Permissions and Excessive Agency](/learn/security/tool-permissions-and-excessive-agency/) made the case for least privilege. This article applies it to every principal in an Azure deployment of the shipment agent. It was checked against Microsoft Learn on 2026-11-18.

## The kinds of principal

A principal is anything that can be granted access. Four kinds show up here:

| Kind | Examples | How it signs in |
| --- | --- | --- |
| Human | Developers, administrators | Microsoft Entra sign-in, ideally with multifactor authentication and just-in-time elevation for admin roles |
| Workload identity | A CI/CD pipeline | Federated credentials from the pipeline, so there's no secret to store |
| Managed identity | A web app, a Container Apps app, a Foundry project | Azure issues tokens to the resource itself. There's no credential you can see or leak |
| Agent identity | Each Foundry agent | A special kind of Entra service principal, created by Foundry for each agent |

Agent identities are new, so they're worth a closer look. Learn's agent identity concepts page describes an agent identity as "a special service principal in Microsoft Entra ID", created under an "agent identity blueprint" that Foundry provisions per agent. The blueprint's credential is a federated credential that Foundry manages. Learn states that no client secret or certificate is needed, and that "Foundry projects, agent code, and the project managed identity never hold the credential." Two other details from that page matter for least privilege:

- "A newly created agent identity starts without resource permissions." Foundry doesn't grant it downstream access. You grant what it needs, on the target service.
- In a hosted agent, "the project managed identity isn't available to your hosted-agent code." The code gets tokens for its own agent identity, through a token service outside its sandbox.

## Every principal, its role, and its scope

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Diagram of each principal, its role, and the scope of that role. Scrolls horizontally on small screens.">

![Three columns: principal with its type, role, and scope. Developer, human, holds Foundry User on the Foundry project. Release pipeline, workload identity, holds Foundry Project Manager on the Foundry project. Chat application, managed identity, holds Foundry Agent Consumer on one agent, shipment-hosted. shipment-hosted, an agent identity, holds Foundry User on the Foundry resource, for Claude. shipment-hosted, agent identity, holds a Shipments.Read app role on your shipment API. Project identity, managed identity, holds Container Registry Repository Reader on the container registry. Project identity, managed identity, holds Log Analytics Data Reader on the Log Analytics workspace. Administrator, human, just in time, holds Role Based Access Control Administrator on the resource group.](../../../assets/diagrams/deployment/agent-identity-roles.svg)

</div>
<figcaption>The principals for the shipment agent as a hosted agent. Each row reads: who, which role, where.</figcaption>
</figure>

**How to read the diagram.** Each row is one role assignment, read left to right. The left column says what kind of principal it is, so you can tell a person from a pipeline from an agent without relying on color. The right column is the scope, and the narrower it is, the better: notice that the chat application's role covers one agent, not the project.

The diagram shows the hosted-agent option, which has the most principals. The table covers all three options. Role names are from Learn on 2026-11-18. The Foundry roles were recently renamed (Foundry User was Azure AI User, for example), so assign them by role ID in scripts, as Learn recommends.

| Principal | Option | Role | Scope | Why |
| --- | --- | --- | --- | --- |
| Developers | All | Foundry User | Project | Build and test agents, call models |
| Release pipeline | Prompt agent | Foundry User | Project | Create agent versions |
| Release pipeline | Hosted agent | Foundry Project Manager | Project | Create agent versions, and assign Foundry User to the new agent identity |
| Release pipeline | Container Apps | Contributor, or a narrower custom role, plus AcrPush | Resource group, registry | Deploy revisions and push images |
| Calling application | Prompt or hosted agent | Foundry Agent Consumer | One agent | Call the agent and nothing else |
| Agent identity | Hosted agent calling Claude | Foundry User | Foundry resource | The `/anthropic` endpoint is at the account level, outside the agent's default project access |
| Agent identity | Any, calling your APIs or Azure data | The target service's own least-privilege role | That service only | Agent identities start with no downstream access |
| Project managed identity | All | Foundry User | Foundry resource | Learn's recommended role for the project identity |
| Project managed identity | Hosted agent | Container Registry Repository Reader; Log Analytics Data Reader | Registry; workspace | Pull images; read telemetry for evaluations |
| Project managed identity | OpenAPI tool with managed identity auth | The target API's least-privilege role | That API | The tool calls the API as the project, not as the agent |
| App's managed identity | Container Apps | Foundry User, or Cognitive Services OpenAI User for OpenAI models only; Key Vault Secrets User; AcrPull | Foundry resource; one vault; registry | Call the model, read its secrets, pull its image |
| Administrators | All | Owner or Role Based Access Control Administrator, only when needed | Resource group | Assign roles; keep this access just in time |

A few of Learn's warnings are easy to trip over:

- Owner and Contributor don't include Foundry's data-plane permissions. Learn's hosted-agent permissions reference notes that an agent granted Owner or Contributor on the project can't run model inference with them. Broad doesn't mean sufficient.
- Don't use the Azure AI Developer role for Foundry projects. Learn says it's scoped to Azure Machine Learning workspaces and Foundry hubs, and is insufficient for hosted agents.
- Apart from Cognitive Services Usages Reader for quota visibility, Learn advises against roles whose names start with "Cognitive Services" for Foundry scenarios.
- Learn notes that Foundry User is the least-privilege built-in role for model inference, but includes more than inference needs. A custom role with only the required data actions is tighter.

## Assign roles at the narrowest scope

Azure role assignments apply at a scope: a subscription, a resource group, a resource, a Foundry project, or a single agent. Learn supports agent-scope assignments for endpoint access, which is how the calling application gets access to one agent:

```bash
AGENT_SCOPE="/subscriptions/<subscription>/resourceGroups/shipment-agent-rg/providers/Microsoft.CognitiveServices/accounts/shipment-foundry/projects/shipment-assistant/agents/shipment-hosted"

az role assignment create --role "eed3b665-ab3a-47b6-8f48-c9382fb1dad6" \
  --assignee-object-id "<chat app managed identity object ID>" --assignee-principal-type ServicePrincipal \
  --scope "$AGENT_SCOPE"
```

That role ID is Foundry Agent Consumer. Learn notes that at the agent scope, role assignments are currently evaluated only for endpoint access and don't grant management permissions, which is what you want for a caller.

Review assignments regularly. `az role assignment list --scope <scope> --output table` lists who holds what at a scope. Look for leftovers from testing, broad roles at the subscription level, and identities for agents that no longer exist.

## Where secrets belong

The best secret is one that doesn't exist. With Entra ID, the shipment agent needs no stored secrets for Azure services:

- Model calls use the agent's or the app's identity, as in [Foundry Models](/learn/deployment/foundry-models/), with no API key.
- Once nothing uses keys, you can turn off key authentication on the Foundry resource. Learn's "Disable local authentication" page describes the `disableLocalAuth` property and an Azure Policy, "Azure AI Services resources should have key access disabled", that enforces it across a subscription or resource group. Learn notes the change takes a few minutes to reach the gateway, and suggests testing an old key until it returns 401.
- Pipelines use federated credentials instead of client secrets.

Some secrets remain, such as an API key for a third-party carrier or an MCP server that only accepts keys. Put each one where its consumer can read it without code or prompts ever containing it:

| Consumer | Where the secret lives |
| --- | --- |
| A Foundry tool (MCP, OpenAPI) | A project connection. The agent definition references the connection, never the value |
| A hosted agent's code | A project connection referenced from `azure.yaml`, as in Learn's example `${{connections.<name>.credentials.<key>}}` |
| A Container Apps app | Azure Key Vault, referenced from the app's secrets, which Learn recommends over storing values directly in production |
| Anything | Never instructions, tool descriptions, source code, logs, or traces |

Learn's Container Apps secrets page also warns that some built-in Container Apps roles can read secret values through wildcard permissions, even when the role's name suggests narrower access. Check what a role grants before assigning it to anyone who shouldn't read secrets. Rotate the secrets that remain, and keep a list of who can read each one.

## Security implications

- An agent's identity is what a hijacked agent can use. If prompt injection steers the agent, it acts with exactly the permissions its identity holds. OWASP's Top 10 for Agentic Applications (2026) calls the misuse of those permissions Identity and Privilege Abuse (ASI03). Least privilege for the agent identity is the control that limits the damage.
- Separate building from calling from running. A compromised calling application with Foundry Agent Consumer can call the agent but not change its instructions or tools. A compromised pipeline with Foundry Project Manager can change agents, so protect it like production.
- Watch the delegation points. Where one principal vouches for a user, like the calling application passing `customer_id` to a hosted agent, the vouching principal's access must be the narrowest of all, because it effectively speaks for every customer.
- Prefer Entra to keys everywhere, and remove keys you don't need. A key works for anyone who has it, from anywhere, until it's rotated. A role assignment is tied to one identity and can be reviewed, scoped, and revoked.
- Review access as part of every release. The checklist in [Deploying an Agent](/learn/deployment/deploying-an-agent/) includes least-privilege identity. Here that means the role assignments listed above, checked against what's actually assigned.

## What to learn next

Identity limits what an agent may do. The next article, Foundry Guardrails and Content Safety, covers the controls Foundry applies to an agent's inputs, outputs, and tool calls, and why they're a mitigation layer and not a boundary.
