---
title: "Deploy a Prompt Agent to Foundry: The Shipment Assistant Without a Server"
description: Turn the shipment assistant's instructions and tools into a Microsoft Foundry prompt agent, call it from code with a least-privilege identity, and keep the ownership checks and approval step in your application. TypeScript and Python.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-18
order: 6
stage: 8
stageOrder: 4
readingMinutes: 14
tags: [deployment, foundry, azure, prompt-agent, tutorial, typescript, python]
featured: false
draft: false
---

A prompt agent is the lightest way to run an agent on Microsoft Foundry: you store its instructions, model, and tool descriptions in a Foundry project, and Foundry runs the loop. This tutorial deploys the shipment assistant that way and calls it from a small chat program.

The shipment tools are code with security checks in them: the ownership check and the approval prompt from [Add Tools and Permissions](/learn/architecture/add-tools-and-permissions/). A prompt agent can't run your code, so this tutorial uses function tools: Foundry stores each tool's name, description, and argument schema, and when the agent wants to call one, it hands the call back to your application. Your application runs the same Stage 4 tool runner, with the same checks, and returns the result. [Choose an Azure Agent Hosting Option](/learn/deployment/choose-an-azure-agent-hosting-option/) explains why that matters for this choice.

Everything here was checked against Microsoft Learn on 2026-11-18, and the code was type-checked with `@azure/ai-projects` 2.11.0 and `openai` 7.59.0 on npm, and `azure-ai-projects` 2.11.0 and `openai` 3.54.0 on PyPI. It wasn't run against a live Azure subscription: the function-call loop was tested against a scripted stand-in for Foundry, described in step 7.

## Which model

The shipment agent in the earlier tutorials uses Claude. A Foundry prompt agent can't, at least on 2026-11-18. Learn's Agent Service page says it "supports Azure OpenAI models and several Foundry models sold by Azure", and its table of models that agents can use with tools lists no Claude models. Claude is a partner model, sold through Azure Marketplace (see [Foundry Models](/learn/deployment/foundry-models/)).

So this tutorial uses `gpt-5-mini`, the model in Microsoft's own quickstarts. The instructions and tools are the same ones the Claude agent uses, but a different model will behave differently with them, so run the evaluation suite against the new model before relying on it. If you need Claude on Foundry, use a hosted agent, which the next tutorial covers.

## What you'll add

| File | What it does |
| --- | --- |
| `foundry/definition.ts` | The agent definition: instructions, model, and the three tools as function tools |
| `foundry/create-agent.ts` | Creates a version of the agent in your project. Run by whoever deploys |
| `foundry/turn.ts` | Sends one question and runs every function call the agent asks for |
| `foundry/chat.ts` | An interactive chat for one signed-in customer |

The Python files have the same names with underscores (`create_agent.py`), in a `foundry` package with an empty `__init__.py`. Nothing under `src/` or `agent/` changes. In TypeScript, add `"foundry"` to the `include` list in `tsconfig.json` so `tsc` checks the new files.

## Prerequisites

- An Azure subscription, and a role that can create resources and assign roles on a resource group, such as Owner. Learn notes that Contributor can create the resources but can't assign roles.
- The Azure CLI, version 2.80.0 or later, signed in with `az login`.
- The shipment agent project from the Stage 4 tutorials, in TypeScript or Python.
- A region where Foundry Agent Service and `gpt-5-mini` are both available. This tutorial uses `eastus`, as Learn's quickstart does. Check Learn's Agent Service "limits, quotas, and regions" page for yours.

Install the extra packages:

<div class="code-tabs">

```bash
npm install @azure/ai-projects @azure/identity openai
```

```bash
pip install "azure-ai-projects>=2.3.0" azure-identity aiohttp openai
```

</div>

## The deployment flow

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Flow of deploying and calling the shipment assistant as a Foundry prompt agent. Scrolls horizontally on small screens.">

![Two columns: your side on the left and the Foundry project on the right. Step 1: the admin, using the Azure CLI with Owner on the resource group, creates the resources and the gpt-5-mini model deployment with Global Standard. Step 2: the admin assigns roles, Foundry User to the deployer, who is you or CI. Step 3: the deployer creates the agent shipment-assistant, which stores instructions, the model name, and three function tool descriptions. Step 4: your chat app, whose identity has Foundry Agent Consumer and which takes the customer ID from sign-in, sends a question to a conversation, where Foundry runs the loop and calls the model. Step 5: a function call or answer comes back; it's model output and untrusted. Step 6: your app's Stage 4 tool runner, with the ownership check, limits, and approval prompt, reads or books against your records and the carrier, which only your code touches. Step 7: your app sends the function output back. Step 8: verify, checking traces, then delete the resource group.](../../../assets/diagrams/deployment/prompt-agent-flow.svg)

</div>
<figcaption>Where each step happens. The numbers match the steps below.</figcaption>
</figure>

**How to read the diagram.** Follow the numbered markers. Steps 1 to 3 happen once, when you deploy. Steps 4 to 7 happen on every question, and they cross between the two columns twice: once to ask the agent and once to return a tool's result. The tool itself (step 6) never runs in Foundry. It stays in the left column, in your code.

## Step 1: Create the resources and deploy a model

These commands follow Learn's "Set up Microsoft Foundry resources" quickstart, with names for this project. They create a resource group, a Foundry resource (kind `AIServices`) with a managed identity, a project, and a Global Standard deployment of `gpt-5-mini` named after the model:

```bash
az group create --name shipment-agent-rg --location eastus

az cognitiveservices account create \
  --name shipment-foundry --resource-group shipment-agent-rg \
  --kind AIServices --sku S0 --location eastus \
  --custom-domain shipment-foundry --assign-identity --allow-project-management true

az cognitiveservices account project create \
  --name shipment-foundry --resource-group shipment-agent-rg \
  --project-name shipment-assistant --location eastus

az cognitiveservices model list --location eastus \
  --query "[?model.name=='gpt-5-mini'].{version:model.version,skus:join(',',model.skus[].name)}" --output table

az cognitiveservices account deployment create \
  --name shipment-foundry --resource-group shipment-agent-rg \
  --deployment-name gpt-5-mini --model-name gpt-5-mini --model-version "2025-08-07" \
  --model-format OpenAI --sku-capacity 10 --sku-name GlobalStandard
```

Use a version from the `model list` output: `2025-08-07` is the one in Learn's quickstart on 2026-11-18. If the last command fails with `DeploymentModelNotSupported`, that model, version, or SKU isn't available in the region.

Get the project endpoint, which the code reads from `FOUNDRY_PROJECT_ENDPOINT`:

```bash
az cognitiveservices account project show \
  --name shipment-foundry --resource-group shipment-agent-rg --project-name shipment-assistant \
  --query 'properties.endpoints."AI Foundry API"' --output tsv
```

It looks like `https://shipment-foundry.services.ai.azure.com/api/projects/shipment-assistant`.

## Step 2: Separate building from calling

Two identities do different jobs here, and they get different roles:

| Identity | Job | Role, at the project scope |
| --- | --- | --- |
| The deployer: you, or a CI pipeline | Creates and updates agent versions | Foundry User (`53ca6127-db72-4b80-b1b0-d745d6d5456d`) |
| The chat application | Calls the agent | Foundry Agent Consumer (`eed3b665-ab3a-47b6-8f48-c9382fb1dad6`) |

Learn describes Foundry Agent Consumer as least-privilege access for principals that only interact with agents. Learn also recommends assigning by role ID rather than name while the Foundry role rename rolls out, which is why the commands use the IDs:

```bash
PROJECT_ID=$(az cognitiveservices account project show \
  --name shipment-foundry --resource-group shipment-agent-rg --project-name shipment-assistant \
  --query id --output tsv)

az role assignment create --role "53ca6127-db72-4b80-b1b0-d745d6d5456d" \
  --assignee "<deployer sign-in or object ID>" --scope "$PROJECT_ID"

az role assignment create --role "eed3b665-ab3a-47b6-8f48-c9382fb1dad6" \
  --assignee-object-id "<app identity object ID>" --assignee-principal-type ServicePrincipal --scope "$PROJECT_ID"
```

On a laptop, the "app identity" is usually you, signed in with the Azure CLI, so for a quick test you can run both programs as yourself. In production, the chat application runs under its own managed identity with only the second role. Role assignments can take a few minutes to apply.

## Step 3: Describe the agent and create it

The definition reuses the instructions from `config` and the tool definitions from `tools`, converted to Foundry's function tool format. Foundry gets each tool's name, description, and argument schema, and nothing else:

<div class="code-tabs">

```ts
// foundry/definition.ts
import type { FunctionTool, PromptAgentDefinition } from "@azure/ai-projects";
import { SYSTEM_PROMPT } from "../src/config.ts";
import { toolDefinitions } from "../src/tools.ts";

export const AGENT_NAME = "shipment-assistant";

// The same three tools, described to Foundry as function tools. Foundry stores only the descriptions:
// when the agent wants a tool, it asks your application to run it.
export const functionTools: FunctionTool[] = toolDefinitions.map((tool) => ({
  type: "function",
  name: tool.name,
  description: tool.description ?? "",
  parameters: tool.input_schema,
  strict: true,
}));

export function shipmentAgent(modelDeployment: string): PromptAgentDefinition {
  return { kind: "prompt", model: modelDeployment, instructions: SYSTEM_PROMPT, tools: functionTools };
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  return value;
}
```

```python
# foundry/definition.py
import os

from azure.ai.projects.models import FunctionTool, PromptAgentDefinition, Tool

from agent.config import SYSTEM_PROMPT
from agent.tools import TOOL_DEFINITIONS

AGENT_NAME = "shipment-assistant"

# The same three tools, described to Foundry as function tools. Foundry stores only the descriptions:
# when the agent wants a tool, it asks your application to run it.
FUNCTION_TOOLS: list[Tool] = [
    FunctionTool(
        name=tool["name"],
        description=tool.get("description", ""),
        parameters=dict(tool["input_schema"]),
        strict=True,
    )
    for tool in TOOL_DEFINITIONS
]


def shipment_agent(model_deployment: str) -> PromptAgentDefinition:
    return PromptAgentDefinition(model=model_deployment, instructions=SYSTEM_PROMPT, tools=FUNCTION_TOOLS)


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Set {name}")
    return value
```

</div>

`strict: true` asks the model for arguments that match the schema exactly. That works for the default prompt agent. Learn notes that the optional Microsoft Copilot harness rejects strict schemas, so leave it out if you use the harness. The runner checks every argument anyway.

Creating the agent stores a new, numbered version each time you run it, so the same script both creates and updates the agent:

<div class="code-tabs">

```ts
// foundry/create-agent.ts
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import { AGENT_NAME, requireEnv, shipmentAgent } from "./definition.ts";

// Run by whoever deploys the agent, with a role that can build agents (such as Foundry User).
const project = new AIProjectClient(requireEnv("FOUNDRY_PROJECT_ENDPOINT"), new DefaultAzureCredential());
const agent = await project.agents.createVersion(AGENT_NAME, shipmentAgent(requireEnv("FOUNDRY_MODEL_DEPLOYMENT")));
console.log(`Created ${agent.name}, version ${agent.version}`);
```

```python
# foundry/create_agent.py
import asyncio

from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import DefaultAzureCredential

from .definition import AGENT_NAME, require_env, shipment_agent


# Run by whoever deploys the agent, with a role that can build agents (such as Foundry User).
async def main() -> None:
    async with (
        DefaultAzureCredential() as credential,
        AIProjectClient(endpoint=require_env("FOUNDRY_PROJECT_ENDPOINT"), credential=credential) as project,
    ):
        definition = shipment_agent(require_env("FOUNDRY_MODEL_DEPLOYMENT"))
        agent = await project.agents.create_version(agent_name=AGENT_NAME, definition=definition)
        print(f"Created {agent.name}, version {agent.version}")


if __name__ == "__main__":
    asyncio.run(main())
```

</div>

Run it as the deployer:

<div class="code-tabs">

```bash
FOUNDRY_PROJECT_ENDPOINT="https://shipment-foundry.services.ai.azure.com/api/projects/shipment-assistant" \
FOUNDRY_MODEL_DEPLOYMENT=gpt-5-mini node foundry/create-agent.ts
```

```bash
FOUNDRY_PROJECT_ENDPOINT="https://shipment-foundry.services.ai.azure.com/api/projects/shipment-assistant" \
FOUNDRY_MODEL_DEPLOYMENT=gpt-5-mini python -m foundry.create_agent
```

</div>

Keep this script in source control and run it from your release pipeline, so the agent's instructions and tools go through the same review and gates as code. That's item 1 on the [Deploying an Agent](/learn/deployment/deploying-an-agent/) checklist, applied to configuration.

## Steps 4 to 7: Call the agent and run its tools

Each question runs a small loop on your side. Send the question to the agent (step 4). If the response contains function calls (step 5), run each one with the Stage 4 tool runner (step 6) and send the outputs back (step 7). Repeat until the agent answers in text, up to 8 rounds, the same step limit as the Stage 4 loop:

<div class="code-tabs">

```ts
// foundry/turn.ts
import type OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { ToolOutput } from "../src/tools.ts";
import { AGENT_NAME } from "./definition.ts";

const MAX_ROUNDS = 8; // the same step limit as the Stage 4 loop
const AGENT = { agent_reference: { name: AGENT_NAME, type: "agent_reference" } };

type RunTool = (name: string, input: unknown) => Promise<ToolOutput>;

function parseArguments(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined; // the runner rejects it as invalid_arguments
  }
}

// One question: send it to the agent, run each function call it asks for, and repeat until it answers.
export async function askAgent(openai: OpenAI, conversationId: string, question: string, runTool: RunTool): Promise<string | null> {
  let input: ResponseInputItem[] = [{ type: "message", role: "user", content: question }];
  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    const response = await openai.responses.create({ conversation: conversationId, input }, { body: AGENT });
    const calls = response.output.filter((item) => item.type === "function_call");
    if (calls.length === 0) return response.output_text;

    input = [];
    for (const call of calls) {
      // Your code runs the tool, with the ownership checks, call limits, and approval from Stage 4.
      const output = await runTool(call.name, parseArguments(call.arguments));
      input.push({ type: "function_call_output", call_id: call.call_id, output: output.content });
    }
  }
  return null; // round limit reached
}
```

```python
# foundry/turn.py
import json
from collections.abc import Awaitable, Callable

from openai import AsyncOpenAI
from openai.types.responses import ResponseInputItemParam

from agent.errors import ToolOutput

from .definition import AGENT_NAME

MAX_ROUNDS = 8  # the same step limit as the Stage 4 loop
AGENT = {"agent_reference": {"name": AGENT_NAME, "type": "agent_reference"}}

type RunTool = Callable[[str, object], Awaitable[ToolOutput]]


def parse_arguments(text: str) -> object:
    try:
        value: object = json.loads(text)
    except json.JSONDecodeError:
        return None  # the runner rejects it as invalid_arguments
    return value


# One question: send it to the agent, run each function call it asks for, and repeat until it answers.
async def ask_agent(openai: AsyncOpenAI, conversation_id: str, question: str, run_tool: RunTool) -> str | None:
    items: list[ResponseInputItemParam] = [{"type": "message", "role": "user", "content": question}]
    for _ in range(MAX_ROUNDS):
        response = await openai.responses.create(conversation=conversation_id, input=items, extra_body=AGENT)
        calls = [item for item in response.output if item.type == "function_call"]
        if not calls:
            return response.output_text

        items = []
        for call in calls:
            # Your code runs the tool, with the ownership checks, call limits, and approval from Stage 4.
            output = await run_tool(call.name, parse_arguments(call.arguments))
            items.append({"type": "function_call_output", "call_id": call.call_id, "output": output.content})
    return None  # round limit reached
```

</div>

The request names the agent with an `agent_reference` field in the request body. Microsoft's samples differ on this: the prompt-agent quickstart uses `agent_reference`, while the function-calling article's TypeScript sample uses `agent` with `type: "agent_reference"`. This tutorial uses `agent_reference` in both languages, which matches the quickstart and what the Python SDK's tracing reads. If the service rejects it, check the current samples.

The chat program supplies the customer from sign-in and a fresh tool runner for each question, as `main` did in Stage 4:

<div class="code-tabs">

```ts
// foundry/chat.ts
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import { createInterface } from "node:readline/promises";
import { askInTerminal } from "../src/approval.ts";
import { CUSTOMERS } from "../src/data.ts";
import { createToolRunner } from "../src/runner.ts";
import { requireEnv } from "./definition.ts";
import { askAgent } from "./turn.ts";

// Stand-in for sign-in, as in src/main.ts. The customer ID never comes from the model.
const [flag, customerId] = process.argv.slice(2);
if (flag !== "--customer" || !customerId || !Object.hasOwn(CUSTOMERS, customerId)) {
  console.error("Usage: node foundry/chat.ts --customer c-100");
  process.exit(1);
}

// Run with an identity that only needs to call agents (Foundry Agent Consumer).
const project = new AIProjectClient(requireEnv("FOUNDRY_PROJECT_ENDPOINT"), new DefaultAzureCredential());
const openai = project.getOpenAIClient();
const conversation = await openai.conversations.create();

try {
  console.log("Ask about your packages. Press Enter on an empty line to quit.");
  while (true) {
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    const question = (await terminal.question("\n> ").catch(() => "")).trim();
    terminal.close();
    if (!question) break;
    const runTool = createToolRunner({ customerId }, askInTerminal); // fresh limits per question
    const answer = await askAgent(openai, conversation.id, question, runTool);
    console.log(answer ?? "Sorry, I couldn't finish that.");
  }
} finally {
  await openai.conversations.delete(conversation.id);
}
```

```python
# foundry/chat.py
import asyncio
import sys

from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import DefaultAzureCredential

from agent.approval import ask_in_terminal
from agent.data import CUSTOMERS
from agent.runner import create_tool_runner
from agent.tools import Session

from .definition import require_env
from .turn import ask_agent


async def read_question() -> str:
    try:
        return (await asyncio.to_thread(input, "\n> ")).strip()
    except EOFError:
        return ""


async def main() -> int:
    # Stand-in for sign-in, as in agent/main.py. The customer ID never comes from the model.
    args = sys.argv[1:]
    if len(args) != 2 or args[0] != "--customer" or args[1] not in CUSTOMERS:
        print("Usage: python -m foundry.chat --customer c-100", file=sys.stderr)
        return 1
    session = Session(customer_id=args[1])

    # Run with an identity that only needs to call agents (Foundry Agent Consumer).
    async with (
        DefaultAzureCredential() as credential,
        AIProjectClient(endpoint=require_env("FOUNDRY_PROJECT_ENDPOINT"), credential=credential) as project,
        project.get_openai_client() as openai,
    ):
        conversation = await openai.conversations.create()
        try:
            print("Ask about your packages. Press Enter on an empty line to quit.")
            while question := await read_question():
                run_tool = create_tool_runner(session, ask_in_terminal)  # fresh limits per question
                answer = await ask_agent(openai, conversation.id, question, run_tool)
                print(answer or "Sorry, I couldn't finish that.")
        finally:
            await openai.conversations.delete(conversation.id)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

</div>

Run it with the app identity:

<div class="code-tabs">

```bash
FOUNDRY_PROJECT_ENDPOINT="https://shipment-foundry.services.ai.azure.com/api/projects/shipment-assistant" \
node foundry/chat.ts --customer c-100
```

```bash
FOUNDRY_PROJECT_ENDPOINT="https://shipment-foundry.services.ai.azure.com/api/projects/shipment-assistant" \
python -m foundry.chat --customer c-100
```

</div>

Learn notes that a run expires 10 minutes after it's created, so tool outputs have to come back within that time. The approval prompt waits for the customer, so a customer who walks away mid-booking ends that question with an expired run. Treat it like any other failed question.

### What the loop does, tested without Azure

Both versions of `askAgent` were run against the same scripted stand-in for Foundry, with the real Stage 4 tool runner and customer `c-100`, and produced the same requests (Python with its snake_case names):

- The agent asks for two statuses at once: `1Z999AA10123456784`, which belongs to `c-100`, and `1Z999AA10123456786`, which belongs to `c-200`. The first output is the package's status. The second is `{"error":"not_found","kind":"denied","retryable":false}`. The ownership check ran in your code, so no instruction to the agent could get around it.
- The agent sends arguments that aren't valid JSON. The output is `invalid_arguments`, and nothing runs.
- The agent keeps asking for `listMyShipments`. The first three calls succeed, the next ones return `tool_limit_reached` from the per-question call limit, and after 8 rounds `askAgent` returns `null`, so the chat prints "Sorry, I couldn't finish that."

## Step 8: Verify, then clean up

Ask "Where is package 1Z999AA10123456784?" and then "And my other one?" to check that the agent answers from the tools and remembers the conversation. Then ask about `1Z999AA10123456786`, which belongs to another customer. The answer should say it can't find that package.

To see what happened inside each run, connect Application Insights to the project and look at the agent's traces in the Foundry portal, as Learn's quickstart prerequisites describe. Traces show the model calls and the function calls the agent requested. They don't show what your tool runner did, so keep the Stage 4 logs too.

When you're done, delete the resource group. That removes the Foundry resource, the project, the agent, and the model deployment:

```bash
az group delete --name shipment-agent-rg --yes --no-wait
```

The Python and TypeScript chat programs also delete their conversation when they exit.

## Cost, region, and permission caveats

- Cost. Microsoft's agent comparison table describes a prompt agent's cost as "per-call inference + tool usage". Every round in step 5 is a model call, and the conversation history is sent again each time, so a question that needs three tool calls costs roughly four model calls. There's no container to pay for. The step and spend budgets from [Reliability, Cost, and Runaway Loops](/learn/deployment/reliability-cost-and-runaway-loops/) can't run inside Foundry's loop, so `askAgent` keeps the round limit, and Foundry's own cost controls (in preview on 2026-11-18) are the backstop.
- Region. The project's region needs Agent Service and the model deployment type you chose. Learn's region tables also show that some tools aren't available everywhere.
- Permissions. Creating resources needs Contributor or Owner; assigning roles needs Owner or another role with role-assignment rights. The deployer needs Foundry User. The chat application needs only Foundry Agent Consumer.

## Security implications

- The ownership check stays in your code. Function calls come back to your application, and the Stage 4 runner checks the customer from the session, never an ID from the model. A prompt-injected agent can ask for another customer's package. It gets `not_found`.
- Treat function calls as untrusted input. Learn's function-calling guidance says to treat tool arguments and outputs as untrusted and validate them, which the runner does with its argument check before anything runs. OWASP's Top 10 for Agentic Applications (2026) lists the misuse of tools as Tool Misuse (ASI02).
- Building and calling are separate roles. If the chat application's identity is compromised, Foundry Agent Consumer lets it call agents but not change their instructions or tools. Keep Foundry User for the deployer.
- Instructions are configuration with security weight. Changing the system prompt or a tool description changes what the agent does, so changes go through review and the release gates like code. A prompt agent's definition is also visible to anyone who can read it in the project, so don't put secrets in the instructions.
- Conversations are stored in Foundry. They contain customer data, so plan their retention and who can read them. The memory and data exposure guidance in [Agent Memory and Data Exposure](/learn/security/agent-memory-and-data-exposure/) applies to them.

## What to learn next

If you need Claude, your own loop, or the Stage 7 budgets inside the agent, the next tutorial, Deploy a Hosted Agent to Foundry, runs the shipment agent's own code as a Foundry hosted agent.
