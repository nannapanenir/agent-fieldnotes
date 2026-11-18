---
title: "Foundry Models: The Catalog, Deployments, Quotas, and Cost"
description: How models work in Microsoft Foundry before an agent calls one. The two kinds of catalog model, deployment types and where they process data, quota tiers, model lifecycles, and pointing the shipment agent at a Claude deployment, in TypeScript and Python.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-18
order: 5
stage: 8
stageOrder: 3
readingMinutes: 10
tags: [deployment, foundry, azure, models, cost, typescript, python]
featured: false
draft: false
---

Every hosting option in [Choose an Azure Agent Hosting Option](/learn/deployment/choose-an-azure-agent-hosting-option/) ends up calling a model, and in Foundry you call a model through a deployment. This article covers what you need to know before creating one: what's in the catalog and who stands behind each model, which deployment type to pick and where it processes data, how quota works, when models retire, and what it costs. It ends by pointing the shipment agent from the earlier tutorials at a Claude deployment in Foundry.

Facts here were checked against Microsoft Learn on 2026-11-18. Quotas, prices, and model availability change often, so recheck them for your subscription and region.

## Two kinds of model in the catalog

Microsoft's Foundry Models overview describes a catalog of more than 10,000 models, with about 50 new ones published each month. It splits them into two groups, and the split decides who supports the model and which terms apply.

Models sold by Azure are hosted and sold by Microsoft under the Microsoft Product Terms. They include all the Azure OpenAI models and selected models from other providers. Microsoft supports them, they carry Azure service-level agreements, and Microsoft reviews them under its Responsible AI process before listing.

Models from partners and community make up most of the catalog. The provider supports the model, and its own license or commercial terms apply. Anthropic's Claude models are in this group. To deploy one, your subscription subscribes to the offer through Azure Marketplace, and Learn points to Anthropic's own data processing addendum and commercial terms for how data is handled. Claude has a few extra requirements on Learn's "Deploy and use Claude models" page: a paid Azure subscription with a pay-as-you-go billing method, a billing account in a country or region where Anthropic sells the models, and not a Cloud Solution Provider, free trial, or credit-only subscription.

Claude models come in two versions in Foundry, and Learn notes that not every model has both. "Hosted on Azure" runs in Azure, and "Hosted on Anthropic infrastructure" runs on Anthropic's. The version decides which features work. For example, Anthropic's platform availability table lists code execution, Agent Skills, and the Files API as available on Foundry only for deployments hosted on Anthropic's infrastructure.

## Deployments and deployment types

A deployment is a named instance of one model version in your Foundry resource. Your code sends the deployment's name in the `model` field, which is why the name you choose matters: if you name the deployment `claude-opus-5-5`, the shipment agent's `MODEL` constant doesn't change.

Most catalog models, including Claude, use the serverless API option, which Learn calls the "preferred and most capable deployment path". Some open models instead run on managed compute, with dedicated GPU capacity, and Learn notes those currently need a hub-based project in the classic portal. There's also an "instant access" preview that calls supported models by name with no deployment, which is handy for trying a model but not something to build a production agent on.

Within the serverless API option, the deployment type sets where your prompts are processed and how you pay:

| Deployment type | Where inference runs | How you pay | Good for |
| --- | --- | --- | --- |
| Global Standard | Any Azure region | Per token | The default: newest models, lowest price, broadest regions |
| Data Zone Standard | Within one data zone (US, EU, or Asia Pacific) | Per token | Data that must stay in a zone |
| Standard | Within your Azure geography | Per token | Geography requirements at low volume |
| Global, Data Zone, or Regional Provisioned | Same split as above | Reserved capacity (provisioned throughput units) | Predictable, high throughput |
| Global or Data Zone Batch | Same split as above | 50% discount, results within 24 hours | Large jobs that can wait |
| Developer | Any Azure region | Per token | Evaluating fine-tuned models only (24-hour lifetime, no SLA) |

Learn's advice is to start with Global Standard and move only for a specific reason. The shipment agent answers customers while they wait, so Batch is out, and at modest volume per-token billing is simpler than reserved capacity. The real question is data residency: Global types may process a prompt in any Azure region. Data stored at rest stays in your resource's geography either way. If customer conversations have to stay within the EU or the US, use a Data Zone type, and check that the model you want offers it there. For Claude, Learn lists Global Standard for every model and Data Zone Standard (US) for some models hosted on Azure.

Serverless API deployments also include built-in Azure AI Content Safety filters, with configurable settings. A later article in this track covers guardrails and what they can and can't do.

## Quota

Quota limits how much a deployment can use, measured in tokens or requests per minute. Two recent changes affect how it works.

First, Learn says quota is moving to the subscription level, starting with some models after May 7, 2026 "and soon all models". Deployments of the same model and version share one quota pool across all regions for Global Standard, or one pool per data zone for Data Zone Standard. Two Foundry resources in the same subscription, say staging and production, can therefore draw on the same pool. Keep that in mind when a load test in staging slows down production.

Second, there are seven quota tiers, Free and Tiers 1 to 6. Subscriptions move up automatically as usage grows, based on consumption, payment history, and agreements such as an Enterprise Agreement. Some models need a minimum tier before you can deploy them at all. You can request more quota within your tier, or opt out of automatic upgrades by setting the subscription's tier upgrade policy to `NoAutoUpgrade`.

Learn also notes that some customers use quota to cap spending, and says quota "isn't the recommended tool for managing costs". It's a rate limit for the whole subscription, so it can't tell one customer from another. Spend limits belong in your application, as in [Reliability, Cost, and Runaway Loops](/learn/deployment/reliability-cost-and-runaway-loops/), and in Foundry's cost controls, which were in preview on 2026-11-18.

## Model lifecycle

Models in Foundry move from preview or generally available, to legacy, to deprecated, to retired. Deprecated means existing customers can keep deploying but new customers can't. Retired means the model stops working. Learn's lifecycle page states the standard lifecycle as 18 months for generally available models, and 12 months for models from Anthropic, DeepSeek, Fireworks, and Mistral AI. It also says Microsoft can retire a model early, with shortened notice, if it has security or compliance problems.

This matters for rollbacks. [Deploying an Agent](/learn/deployment/deploying-an-agent/) asks you to version the model ID with the code, so that a rollback restores the model as well. If that older model has since retired, the rollback breaks. Check retirement dates on Learn's model retirement schedule when you plan a release, and treat a model change as a release that goes through every gate.

## Cost basics

You pay for a pay-per-token deployment by input and output tokens, at the rate on the Azure pricing page for that model and deployment type. Provisioned deployments charge for reserved capacity whether you use it or not, and Batch is half the Standard price. A hosting option can add its own compute costs on top, such as the per-session CPU and memory billing of hosted agents.

Two practical points for the shipment agent:

- The prices in `budget.ts` from Stage 7 come from Anthropic's own price list. Prices on Foundry come from the Azure pricing page, and can differ by deployment type. Update the price table when you move the agent, or the spend budget will measure the wrong number.
- Foundry offers fast mode for Claude Opus 5.5 as a separate deployment (`claude-opus-5-5-fast` in Learn's model table) at a higher price, according to Anthropic's platform availability table. Treat it as a different model for budgeting.

## Point the shipment agent at a Foundry deployment

The Stage 4 loop takes a `createMessage` function, so moving the model to Foundry changes only that function. Anthropic publishes Foundry clients for both languages: `AnthropicFoundry` in the `@anthropic-ai/foundry-sdk` package for TypeScript, and `AsyncAnthropicFoundry` in the `anthropic` package for Python. Both use the same request and response types as the main SDK. With Microsoft Entra ID, the client gets a token for the `https://ai.azure.com/.default` scope from whatever identity is running the code: your Azure CLI sign-in on a laptop, or the managed or agent identity in Azure. There's no API key to store.

Install the extra packages first:

<div class="code-tabs">

```bash
npm install @anthropic-ai/foundry-sdk @azure/identity
```

```bash
pip install azure-identity aiohttp
```

</div>

The Python version uses the asynchronous credential in `azure.identity.aio`, which needs `aiohttp`. Without it, creating the credential fails with "aiohttp package is not installed".

<div class="code-tabs">

```ts
// src/foundry-model.ts
import AnthropicFoundry from "@anthropic-ai/foundry-sdk";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import type { CreateMessage } from "./loop.ts";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

// Sends the agent's model calls to a Claude deployment in a Foundry resource, signed in with Microsoft Entra ID.
export function foundryCreateMessage(resource: string): CreateMessage {
  const client = new AnthropicFoundry({
    resource, // calls https://<resource>.services.ai.azure.com/anthropic/
    azureADTokenProvider: getBearerTokenProvider(new DefaultAzureCredential(), "https://ai.azure.com/.default"),
  });

  return (params, { timeoutMs }) => {
    // Foundry doesn't support server-side fallbacks, so drop them before sending.
    const { fallbacks: _fallbacks, betas, ...rest } = params;
    const kept = (betas ?? []).filter((beta) => beta !== FALLBACK_BETA);
    return client.beta.messages.create({ ...rest, ...(kept.length > 0 ? { betas: kept } : {}) }, { timeout: timeoutMs });
  };
}
```

```python
# agent/foundry_model.py
from anthropic import AsyncAnthropicFoundry
from anthropic.types.beta import BetaMessage
from anthropic.types.beta.message_create_params import MessageCreateParamsNonStreaming
from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider

from .loop import CreateMessage

FALLBACK_BETA = "server-side-fallback-2026-07-01"


# Sends the agent's model calls to a Claude deployment in a Foundry resource, signed in with Microsoft Entra ID.
def foundry_create_message(resource: str) -> CreateMessage:
    client = AsyncAnthropicFoundry(
        resource=resource,  # calls https://<resource>.services.ai.azure.com/anthropic/
        azure_ad_token_provider=get_bearer_token_provider(DefaultAzureCredential(), "https://ai.azure.com/.default"),
    )

    async def create_message(params: MessageCreateParamsNonStreaming, timeout_s: float) -> BetaMessage:
        # Foundry doesn't support server-side fallbacks, so drop them before sending.
        request = params.copy()
        request.pop("fallbacks", None)
        betas = [beta for beta in request.pop("betas", []) if beta != FALLBACK_BETA]
        if betas:
            request["betas"] = betas
        return await client.beta.messages.create(**request, timeout=timeout_s)

    return create_message
```

</div>

Then, where `main` builds the agent's dependencies, use `foundryCreateMessage(process.env.FOUNDRY_RESOURCE)` in place of the Stage 4 `createMessage`, or `foundry_create_message(os.environ["FOUNDRY_RESOURCE"])` in Python. The resource name isn't a secret, so an environment variable is fine. Everything else, including the budgets, the breaker, and the evaluation suite, stays the same.

The function removes one thing from every request: the server-side fallback the Stage 4 loop asks for. Anthropic's platform availability table lists server-side fallbacks as not supported on Foundry, so the request has to go without them. Both versions were checked against a stubbed client: with the fallback beta alone, the request is sent with no `betas` and no `fallbacks`; with the fallback beta plus another beta, only the other beta remains; and the timeout is passed through. Check that table for any other feature you rely on. On Foundry, web search and web fetch on models hosted on Azure are limited to their basic versions, for example.

The identity that runs this code needs a role that allows calling the model. For a developer, the starting point from [What Is Microsoft Foundry?](/learn/deployment/what-is-microsoft-foundry/) is Foundry User. Learn's Claude page also notes that Entra ID access may need extra configuration on the resource. The identity article later in this track covers the roles for each runtime identity.

## Security implications

- Where data is processed is a deployment decision. A Global deployment may process prompts in any Azure region. If conversations contain personal data with residency rules, choose a Data Zone or Standard deployment, and record why. NIST's Generative AI Profile (NIST AI 600-1) lists Data Privacy among the main risks for generative AI.
- A partner model brings the partner's terms. For Claude on Foundry, Learn points to Anthropic's data processing addendum and commercial terms, and the "Hosted on" version decides whose infrastructure runs the model. Read those terms as part of the review for item 8 on the release checklist. Models are third-party components, and OWASP lists them under Agentic Supply Chain Vulnerabilities (ASI04).
- Prefer Entra ID to keys. Deployments accept both, and Learn recommends Entra ID. Keys are long-lived secrets that work from anywhere until rotated, while a token is tied to an identity you can scope, audit, and disable.
- Built-in content filters are a mitigation layer. They reduce some harmful inputs and outputs, and they don't stop a prompt injection from steering tool calls. The controls from the security track still apply.

## What to learn next

With a model deployed, the next article, Deploy a Prompt Agent to Foundry, turns the shipment assistant's instructions and tool definitions into a managed prompt agent and calls it from code.
