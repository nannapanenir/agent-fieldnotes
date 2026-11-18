---
title: "Deploy a Hosted Agent to Foundry: Run the Shipment Agent's Own Code"
description: Package the shipment agent's own loop, with its budgets, breaker, and ownership checks, as a Microsoft Foundry hosted agent that calls Claude. What the platform runs for you, which identity does each job, and how a client calls it.
topic: Deployment
level: Advanced
publishedAt: 2026-11-18
order: 7
stage: 8
stageOrder: 5
readingMinutes: 15
tags: [deployment, foundry, azure, hosted-agent, tutorial, python, typescript]
featured: false
draft: false
---

A hosted agent is your own agent code in a container, run by Microsoft Foundry. Foundry gives it an endpoint, a Microsoft Entra identity, and a separate VM-isolated sandbox for each session, and it handles scaling and session state. Your code keeps doing everything it did before. For the shipment agent, that means the loop from the Stage 4 tutorials, with the budgets and circuit breaker from [Reliability, Cost, and Runaway Loops](/learn/deployment/reliability-cost-and-runaway-loops/), calling Claude through a Foundry deployment as in [Foundry Models](/learn/deployment/foundry-models/).

This tutorial deploys that code and calls it from a client. It was checked against Microsoft Learn on 2026-11-18. The agent code was type-checked and its request handler was tested against the evaluation suite's stand-in model, but nothing was deployed to a live subscription, so treat the commands as a guide to check against Learn's current quickstart.

## Python for the container, either language for the client

The hosting protocol libraries, `azure-ai-agentserver-responses` and `azure-ai-agentserver-invocations`, exist for Python and .NET. Learn's "Deploy your own code as a hosted agent" quickstart covers those two languages, and on 2026-11-18 there was no TypeScript or JavaScript library. So the code that runs inside the container is Python only in this tutorial. If your agent is in TypeScript, the realistic options are to run it on Azure Container Apps, or to port the handler to Python. The client that calls the deployed agent is in both languages.

## What you'll add

| File | What it does |
| --- | --- |
| `hosted/main.py` | The container's entry point: a Responses protocol handler that runs the Stage 4 loop for one question |
| `requirements.txt` | The Python packages the container installs |
| `azure.yaml` | Created by the Azure Developer CLI; you set two environment variables in it |
| `foundry/ask-hosted.ts` | Calls the deployed agent for a signed-in customer |

The client in Python is `foundry/ask_hosted.py`. The agent reuses `agent/foundry_model.py` from [Foundry Models](/learn/deployment/foundry-models/) and `agent/switch.py` from [Deploying an Agent](/learn/deployment/deploying-an-agent/), and `foundry/definition` from the [prompt agent tutorial](/learn/deployment/deploy-a-prompt-agent-to-foundry/) for its `requireEnv` helper.

## Prerequisites

- An Azure subscription, with Owner on a resource group if you create a new Foundry project, or Foundry Project Manager at the project scope if you use an existing one. Learn recommends Foundry Project Manager for whoever deploys hosted agents, because deploying can also mean assigning roles to the new agent identity.
- A region where hosted agents are available. Learn listed 31 regions on 2026-11-18, including East US, East US 2, West Europe, and Sweden Central.
- A Claude deployment in the same Foundry resource, named `claude-opus-5-5`. Claude is sold through Azure Marketplace, so create the deployment in the Foundry portal as Learn's "Deploy and use Claude models" page describes, and check the subscription requirements in [Foundry Models](/learn/deployment/foundry-models/).
- The Azure Developer CLI (`azd`) 1.36.0 or later, with the Foundry extension (`azd ext install microsoft.foundry`), signed in with `azd auth login`. Learn's quickstart also mentions the "Foundry Dev Pack", which installs these tools.
- Python 3.13 or later, which Learn requires for the Python path.

## The deployment flow

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Flow from local code to a running hosted-agent session. Scrolls horizontally on small screens.">

![Three areas: your machine, the Foundry project, and the resource level. Your machine holds the agent source (hosted/main.py, the agent package from Stages 4 and 7, requirements, and azure.yaml), azd signed in as you with Foundry Project Manager, and your application with Foundry Agent Consumer, which signs the customer in and sends customer_id. The Foundry project holds the agent shipment-hosted with its versions and endpoint using the responses protocol, the agent identity used at run time, the project managed identity used for platform jobs such as image pulls, a session sandbox that is VM-isolated with one per session, running your code with budgets, breaker, ownership check, and read tools, with $HOME persisting across idle, and your records and carrier, reached only by your code. The resource level holds the Claude deployment at /anthropic. Step 1: initialize the source with azd. Step 2: azd provisions the project resources. Step 3: run the agent locally. Step 4: deploy to the agent. Step 5: grant roles, including access for the agent identity to the Claude deployment. Step 6: your application invokes the agent, which runs in a session sandbox and calls Claude and your records. Step 7: invoke, monitor, and read traces. Step 8: azd down.](../../../assets/diagrams/deployment/hosted-agent-flow.svg)

</div>
<figcaption>How the code gets to a running session, and which identity is used where. Numbers match the steps.</figcaption>
</figure>

**How to read the diagram.** The green boxes are your code: the source on your machine, and the same code running in a session sandbox. The cyan boxes are identities, each with the role it needs. Three different identities appear: you (deploying), your application (calling), and the agent identity (running). Only the agent identity calls Claude, which is why step 5 grants it access at the resource level.

## Step 1: Write the handler and initialize the project

The handler receives each request through the Responses protocol library, works out which customer it's for, runs the Stage 4 loop once, and returns the answer as text. The model is reached through `foundry_create_message`, so the agent identity's token is used, and server-side fallbacks are dropped as Foundry requires:

```python
# hosted/main.py
import asyncio
import os

from anthropic.types.beta import BetaMessageParam
from azure.ai.agentserver.responses import ResponseContext, ResponsesAgentServerHost, TextResponse
from azure.ai.agentserver.responses.models import CreateResponse, OutputItem

from agent.data import CUSTOMERS
from agent.foundry_model import foundry_create_message
from agent.log import log
from agent.loop import AgentDeps, Answered, run_agent
from agent.runner import create_tool_runner
from agent.switch import KillSwitch, guard_writes
from agent.tools import TOOL_DEFINITIONS, ApprovalRequest, Session

# Read tools only: this version has no way to ask the customer to approve a booking.
READ_TOOLS = [tool for tool in TOOL_DEFINITIONS if tool["name"] != "request_redelivery"]

app = ResponsesAgentServerHost()
create_message = foundry_create_message(os.environ["FOUNDRY_RESOURCE"])


async def read_only_mode() -> object:
    return "read_only"


writes = KillSwitch(read_only_mode)  # a booking that gets through anyway is refused with writes_paused


async def no_approver(request: ApprovalRequest) -> bool:
    return False


def history_as_messages(items: list[OutputItem]) -> list[BetaMessageParam]:
    # Earlier turns as plain text. Tool calls and results from those turns aren't carried over.
    messages: list[BetaMessageParam] = []
    for item in items:
        if item.get("type") != "message" or item.get("role") not in ("user", "assistant"):
            continue
        text = "\n".join(part["text"] for part in item.get("content", []) if "text" in part)
        if text and item.get("role") == "user":
            messages.append({"role": "user", "content": text})
        elif text:
            messages.append({"role": "assistant", "content": text})
    return messages


@app.response_handler
async def handler(request: CreateResponse, context: ResponseContext, _cancellation: asyncio.Event) -> TextResponse:
    # The calling application signs the customer in and passes their ID. Only it may call this agent.
    customer_id = (request.get("metadata") or {}).get("customer_id")
    if customer_id not in CUSTOMERS:
        log("unknown_customer")
        return TextResponse(context, request, text="Sorry, I can't tell which account this is.")

    question = await context.get_input_text()
    history = history_as_messages(list(await context.get_history()))
    run_tool = guard_writes(create_tool_runner(Session(customer_id), no_approver), writes)
    result, _ = await run_agent(history, question, AgentDeps(create_message, READ_TOOLS, run_tool))

    if isinstance(result, Answered):
        return TextResponse(context, request, text=result.text)
    return TextResponse(context, request, text=result.partial_answer or "Sorry, I couldn't finish that.")


if __name__ == "__main__":
    app.run()
```

Three design decisions are worth reading closely.

The customer comes from the caller, never the model. Your application signs the customer in and passes their ID in the request's `metadata`. The agent accepts it because only your application's identity is allowed to call this agent (step 5). The platform also adds an `x-agent-user-id` header, a per-user key for whoever called, but here the caller is your application, not the customer, so it can't tell customers apart.

This version can't book. The approval prompt from Stage 4 asks a person at a terminal, and a container has no terminal. So the model is given only the two read tools, and as a second layer the runner is wrapped with the kill switch's `guard_writes`, fixed in `read_only` mode, so a booking that gets through anyway returns `writes_paused`. To support bookings, the agent would return a pending approval to your application and finish the booking on a later request after the customer confirms. That's a design change, not a setting.

Earlier turns come back as text. The Responses protocol keeps the conversation for you, and `context.get_history()` returns its earlier items. The handler turns user and assistant messages into plain text messages for Claude, and leaves out the tool calls from earlier turns. That's enough for follow-ups like "and my other package?", and it means old tool output doesn't fill the context.

List the packages the container needs:

```text
anthropic>=2.8.0
pydantic>=2.14
azure-identity>=1.27.0
aiohttp
azure-ai-agentserver-responses>=1.0.0b7
```

These were type-checked with `anthropic` 2.8.0, `azure-identity` 1.27.0, and `azure-ai-agentserver-responses` 2.4.0. Then, from the project directory, create the hosted agent configuration with the Responses protocol, deploying source code rather than a prebuilt image. Name the agent `shipment-hosted` when asked:

```bash
azd ai agent init --protocol responses --deploy-mode code
```

The command writes `azure.yaml`. Check that its startup command runs `python -m hosted.main`, and add two environment variables to the agent's service: the Foundry resource name for the Claude client, and `PYTHONNOUSERSITE`, which Learn says Python hosted agents must set to `"1"`:

```yaml
services:
  shipment-hosted:
    host: azure.ai.agent
    env:
      FOUNDRY_RESOURCE: shipment-foundry
      PYTHONNOUSERSITE: "1"
```

Environment variables in `azure.yaml` are fine for names and settings. For secrets, Learn's examples reference a project connection (`${{connections.<name>.credentials.<key>}}`) instead of a value. This agent doesn't need any secrets: it signs in to Claude with its identity.

## Step 2: Provision

```bash
azd provision
```

This creates what `azure.yaml` declares: the Foundry project if needed, a container registry, Application Insights, and the role that lets the project's managed identity pull images. Learn notes that choosing an existing project doesn't skip this step, and that provisioning can still create resources the file declares, such as a model deployment from a template. Read `azure.yaml` before running it. Then connect Application Insights to the project for agent tracing if it isn't already.

## Step 3: Test locally

```bash
azd ai agent run
```

This installs the dependencies in a virtual environment and starts the agent locally. Learn's quickstart invokes the local agent with `azd ai agent invoke --local "..."`. Locally, `DefaultAzureCredential` uses your own sign-in, so you need a role that can call the Claude deployment.

Before deploying, run the evaluation suite and the control tests from the earlier tutorials against the same code. The handler adds very little to the loop they already test. In this tutorial's own checks, the handler was called directly with the evaluation suite's stand-in model:

| Request | Reply |
| --- | --- |
| Customer `c-100` asks about their package `1Z999AA10123456784` | The package's status |
| No `customer_id` in `metadata`, or an unknown one | "Sorry, I can't tell which account this is." |
| Customer `c-100` asks about `1Z999AA10123456786`, which belongs to `c-200` | "I can't find that package on your account." |
| Customer `c-100` asks for a redelivery | The booking returns `writes_paused`, so no booking is made |

## Step 4: Deploy

```bash
azd deploy
```

According to Learn, `azd deploy` packages the source as a .zip, uploads it, and has Foundry build the image remotely, so you don't need Docker locally. It then creates a new agent version and a dedicated Entra agent identity. Every deploy creates a new version and keeps the old ones. By default the endpoint follows the latest version. Learn describes pinning the endpoint to a version and promoting explicitly, which is the staged rollout from the release checklist, and a later article in this track covers it. `azd ai agent show` prints the agent's name, version, protocols, resources, and environment variables.

## Step 5: Grant the agent and the caller the access they need

By default, a hosted agent's identity can call models "through the project endpoint" and read and write its session storage, and nothing else. The Claude client calls the resource's `/anthropic` endpoint directly, which isn't the project endpoint. Learn's permissions reference says code that calls account-level endpoints directly needs a role at the account scope, and lists Foundry User as covering all data actions on the account. So give the agent identity Foundry User on the Foundry resource:

```bash
FOUNDRY_ID=$(az cognitiveservices account show --name shipment-foundry --resource-group shipment-agent-rg --query id --output tsv)

az role assignment create --role "53ca6127-db72-4b80-b1b0-d745d6d5456d" \
  --assignee-object-id "<agent identity object ID>" --assignee-principal-type ServicePrincipal --scope "$FOUNDRY_ID"
```

Find the agent identity's object ID in the agent's details in the Foundry portal. Learn's tip is that Foundry User grants more than this agent needs, and that a custom role with only the required data actions is tighter. This tutorial couldn't confirm the exact data actions for the Claude endpoint, so it uses Foundry User and records the gap as a residual risk.

Then let your application, and only your application, call this agent. Learn supports role assignments at the scope of a single agent for endpoint access:

```bash
AGENT_SCOPE="$FOUNDRY_ID/projects/shipment-assistant/agents/shipment-hosted"

az role assignment create --role "eed3b665-ab3a-47b6-8f48-c9382fb1dad6" \
  --assignee-object-id "<app identity object ID>" --assignee-principal-type ServicePrincipal --scope "$AGENT_SCOPE"
```

That's Foundry Agent Consumer. This assignment carries real weight here: the agent trusts the `customer_id` in `metadata`, so any identity that can call the agent can claim to be any customer. Keep Foundry Agent Consumer on this agent limited to the application that signs customers in, and check the role assignments on the agent as part of every release.

## Step 6: Call the agent from your application

The client points the OpenAI client at this agent's own endpoint and sends the question with the signed-in customer's ID. To continue a conversation, it passes the previous response's ID:

<div class="code-tabs">

```ts
// foundry/ask-hosted.ts
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import { requireEnv } from "./definition.ts";

// Usage: node foundry/ask-hosted.ts c-100 "Where is package 1Z999AA10123456784?" [previous response ID]
// Run by your application after it signs the customer in. Its identity needs Foundry Agent Consumer on the agent.
const [customerId, question, previousResponseId] = process.argv.slice(2);
if (!customerId || !question) throw new Error("Pass a customer ID and a question");

const project = new AIProjectClient(requireEnv("FOUNDRY_PROJECT_ENDPOINT"), new DefaultAzureCredential());
// Points the client at this agent's own endpoint. The SDK marks that as a preview feature.
const openai = project.getOpenAIClient({ azureConfig: { agentName: "shipment-hosted", allowPreview: true } });

const response = await openai.responses.create({
  input: question,
  metadata: { customer_id: customerId }, // the agent trusts this only because only your app can call it
  previous_response_id: previousResponseId ?? null,
});
console.log(response.output_text);
console.log(`(response ${response.id}: pass it to continue the conversation)`);
```

```python
# foundry/ask_hosted.py
import asyncio
import sys

from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import DefaultAzureCredential

from .definition import require_env


# Usage: python -m foundry.ask_hosted c-100 "Where is package 1Z999AA10123456784?" [previous response ID]
# Run by your application after it signs the customer in. Its identity needs Foundry Agent Consumer on the agent.
async def main(customer_id: str, question: str, previous_response_id: str | None) -> None:
    async with (
        DefaultAzureCredential() as credential,
        # allow_preview: pointing the client at one agent's own endpoint is a preview feature in the SDK.
        AIProjectClient(
            endpoint=require_env("FOUNDRY_PROJECT_ENDPOINT"), credential=credential, allow_preview=True
        ) as project,
        project.get_openai_client(agent_name="shipment-hosted") as openai,
    ):
        response = await openai.responses.create(
            input=question,
            metadata={"customer_id": customer_id},  # the agent trusts this only because only your app can call it
            previous_response_id=previous_response_id,
        )
        print(response.output_text)
        print(f"(response {response.id}: pass it to continue the conversation)")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        raise SystemExit("Pass a customer ID and a question")
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) == 4 else None))
```

</div>

Both SDKs mark the per-agent endpoint as a preview feature: TypeScript needs `allowPreview: true` and Python needs `allow_preview=True`, or they refuse to build the client. Learn's hosted agents page documents the endpoint itself, `{project_endpoint}/agents/{name}/endpoint/protocols/openai/responses`.

<div class="code-tabs">

```bash
FOUNDRY_PROJECT_ENDPOINT="https://shipment-foundry.services.ai.azure.com/api/projects/shipment-assistant" \
node foundry/ask-hosted.ts c-100 "Where is package 1Z999AA10123456784?"
```

```bash
FOUNDRY_PROJECT_ENDPOINT="https://shipment-foundry.services.ai.azure.com/api/projects/shipment-assistant" \
python -m foundry.ask_hosted c-100 "Where is package 1Z999AA10123456784?"
```

</div>

## Step 7: Verify

For a quick check without the client, Learn's quickstart uses `azd ai agent invoke "..."`. Without `metadata`, this agent will answer that it can't tell which account the request is for, which confirms the refusal path. Stream the container's logs while you test with:

```bash
azd ai agent monitor --follow
```

The Stage 4 and Stage 7 log events (`model_response`, `tool_call`, `budget_breach`, `circuit_open`) appear there, alongside Foundry's traces in Application Insights. Then ask the questions from step 3 through the client and check that the answers match.

## Step 8: Clean up

```bash
azd down
```

This removes the resources `azd` provisioned. If you created the Claude deployment or the resource group yourself, delete them too, or delete the whole resource group with `az group delete`.

## Cost, region, and permission caveats

- Cost. A hosted agent costs model usage plus container compute. Learn's hosted agents page says billing "is based on CPU + memory consumed across all active sessions, so oversizing multiplies cost by your concurrency." Sandboxes come in sizes from 0.5 vCPU with 1 GiB to 2 vCPU with 4 GiB. A session's compute stays up until its idle timeout, between 2 and 240 minutes with a default of 15, so a short timeout matters when each session asks one question. The Stage 7 time budget limits how long one question can keep a session busy.
- Region. Hosted agents, the Claude deployment, and the project must all be in supported regions. Claude's availability depends on the deployment type and your billing country.
- Permissions. Deploying needs Foundry Project Manager at the project scope, or Owner to create a project. Step 5's account-scope grant needs a role that can assign roles on the Foundry resource. Learn notes that Foundry Project Manager and Foundry Account Owner can only assign Foundry User.

## Security implications

- Three identities, three jobs. You (or CI) deploy, the project's managed identity pulls images, and the agent identity runs the code. Learn stresses that the project managed identity isn't the agent's runtime identity. Grant each one only what its job needs, and review them together, since OWASP's Top 10 for Agentic Applications (2026) lists the misuse of agent permissions as Identity and Privilege Abuse (ASI03).
- The caller vouches for the customer. Passing `customer_id` from your application is a delegation: the agent trusts your application's sign-in. That trust holds only if no other identity can call the agent, which is why step 5 assigns the role at the scope of this one agent.
- Session files are untrusted. Each session keeps `$HOME` across idle periods. Learn advises keeping uploads separate from trusted application files and never loading code, configuration, or instructions from paths uploads can write to. This agent reads nothing from `$HOME`.
- The image is your supply chain. Foundry builds the image from your source and `requirements.txt`, so a malicious package release becomes part of your agent. Pin versions (the `>=` lines above are minimums for this tutorial, not pins), review updates, and keep the agent deployment policies from Foundry governance as a second layer (OWASP ASI04).
- Keep the Stage 7 controls on. The budgets, breaker, and alerts still run inside the container, and the kill switch can be pointed at a real flag store in place of the fixed `read_only` mode used here.

## What to learn next

Hosted agents can run any framework, and Microsoft's own is the most tightly integrated. The next article, Microsoft Agent Framework Basics, introduces Microsoft's code framework for agents and multi-agent workflows, and how it runs as a Foundry hosted agent.
