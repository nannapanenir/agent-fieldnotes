---
title: "Foundry IQ: Knowledge Bases, Agentic Retrieval, and Keeping Retrieved Content in Its Place"
description: What Foundry IQ (formerly Azure AI Search) does for an agent, how knowledge bases, knowledge sources, and agentic retrieval fit together, and how to keep retrieved documents from leaking data or steering the agent.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-18
order: 10
stage: 8
stageOrder: 8
readingMinutes: 6
tags: [deployment, foundry, azure, retrieval, rag, security]
featured: false
draft: false
---

A model only knows what it was trained on and what you put in its context. Foundry IQ is how a Microsoft Foundry agent gets the rest: your documents, policies, and other organizational content, retrieved at the moment a question needs them. Microsoft Learn's Foundry IQ page opens with the rename: "Azure AI Search is now Foundry IQ." The service underneath is the same search service, with knowledge-retrieval features built for agents on top.

[Context, Memory, and Retrieval](/learn/architecture/context-memory-and-retrieval/) explains retrieval in general. This article covers what Foundry IQ adds, where it fits for the shipment assistant, and how to stop retrieved content from leaking data or poisoning the agent's context. It was checked against Microsoft Learn on 2026-11-18.

## The three parts

| Part | What it is |
| --- | --- |
| Knowledge source | A connection to content. It can be indexed, where Foundry IQ copies, chunks, and embeds the content, or remote, where it queries the content in place. Learn lists sources such as Azure Blob Storage, SharePoint, OneLake, and the public web |
| Knowledge base | The resource an agent queries. It names one or more knowledge sources and the settings for retrieval, including a "retrieval reasoning effort" of minimal, low, or medium |
| Agentic retrieval | The query pipeline. A model breaks the question into subqueries, picks sources, runs searches in parallel, reranks the results, and returns content with citations |

For indexed sources, Foundry IQ handles ingestion: chunking documents, generating embeddings, extracting metadata, and re-indexing on a schedule so content stays current. Queries can be keyword, vector, or hybrid. Several agents can share one knowledge base, and Foundry Agent Service, Microsoft Agent Framework, and your own applications can all query it.

Agentic retrieval is the main difference from classic search. Classic retrieval embeds the question and returns the nearest chunks. Agentic retrieval uses a model to plan: for "Can I get my parcel redelivered to a different address, and is there a fee?", it might search the redelivery policy and the fee schedule separately and combine the results. Learn says the query-planning model is optional and comes from Azure OpenAI in Foundry Models. Planning means another model call per question, so it adds cost and latency, which is what the reasoning effort setting trades off.

## Where it fits for the shipment assistant

The shipment assistant's tools answer questions about one customer's packages. Foundry IQ answers questions whose answers are the same for everyone: "How many times will the courier try to deliver?", "Can I change the delivery address?", "What happens if I'm not home?" Those answers live in help-center articles and policy documents, which make a good indexed knowledge source.

Keep the two apart. Package status and bookings stay in tools that check ownership against the signed-in customer, as in [Foundry Tools](/learn/deployment/foundry-tools/). Policy answers come from the knowledge base. Don't index per-customer data, such as order history or support tickets, into a knowledge base that every conversation can query. If you do need per-user documents in retrieval, use Foundry IQ's permission enforcement, described next, and test it.

## Permissions at query time

Learn describes two ways Foundry IQ keeps users from seeing content they shouldn't:

- It can synchronize access control lists (ACLs) for supported sources and honor Microsoft Purview sensitivity labels, enforcing them at query time so the agent gets only authorized content.
- It can run queries under the caller's Microsoft Entra identity, so permissions are checked for the actual user end to end.

Both depend on the caller being identified. As with tools, if the agent queries with a shared identity, every user sees what that identity can see. And both are only as good as the permissions on the source: a SharePoint library shared too widely stays too widely shared once it's indexed.

## What's generally available

On 2026-11-18, Learn's general availability overview listed Foundry IQ as "Partial GA": the APIs are generally available and the portal experience is in preview. The Foundry IQ page adds that which features are generally available depends on the Search REST API version you use, and points to a migration guide with the details. If you build on Foundry IQ, pin the API version and check that guide for the features you rely on.

## Network boundaries

Learn makes a point that's easy to miss: Foundry IQ "has separate inbound and outbound network boundaries." A private connection from the agent to Foundry IQ doesn't protect Foundry IQ's own connections to your content sources, the embedding model, the query-planning model, remote knowledge sources, or asset storage. Learn adds that managed identity and RBAC control access, not network isolation. Each of those paths needs its own configuration, which the networking article later in this track covers.

## Security implications

Retrieval puts external content directly into the model's context, so it's an injection path and a data exposure path at once:

- Retrieved content is untrusted input. Any document in a knowledge source can contain instructions aimed at the model. If customers can influence indexed content (product reviews, forum posts, uploaded files, a public web source), an attacker can plant text that the agent later retrieves and follows. OWASP's Top 10 for Agentic Applications (2026) lists this as Memory and Context Poisoning (ASI06). The defenses are layered: index only content you control or have reviewed, keep customer-generated content in separate sources you can exclude, keep the agent's instructions clear that retrieved text is reference material and not instructions, and keep the tool-side controls (ownership checks, approvals) so that a poisoned answer can't turn into an unauthorized action. [Prompt Injection in Agent Systems](/learn/security/prompt-injection-in-agent-systems/) covers why no filter fully prevents this.
- Ingestion is a write path. Whoever can write to a knowledge source can change what the agent says. Treat write access to indexed storage, SharePoint libraries, and indexer configuration with the same care as access to the agent's instructions, and log changes.
- Citations help people check answers. Foundry IQ returns content with citations. Showing them lets a customer, or a reviewer, see where an answer came from and spot one that came from somewhere it shouldn't.
- Data leaves through the query path too. Agentic retrieval sends the question to a query-planning model, and retrieved content goes to the agent's model. NIST's Generative AI Profile (NIST AI 600-1) lists Data Privacy among the main risks for generative AI. Index only what the agent needs to answer, and check which models and regions each step uses. [Agent Memory and Data Exposure](/learn/security/agent-memory-and-data-exposure/) covers the general controls.

## What to learn next

Tools, retrieval, and models each run under an identity. The next article, Configure Azure Agent Identity, RBAC, and Secrets, maps every identity in the three hosting options, the narrowest role each one needs, and where secrets belong.
