---
title: "The AI Phrasebook: Prompt, Context, Harness, Loop, and the Rest"
description: Plain-language meanings for the AI words you keep hearing, from vibe coding and harness engineering to RAG, MCP, evals, and AGI, with where each term came from.
topic: Foundations
level: Beginner
publishedAt: 2026-11-06
order: 3
readingMinutes: 13
tags: [fundamentals, terminology, prompt-engineering, context-engineering, harness-engineering]
featured: false
draft: false
---

AI picks up new words faster than most people can look them up. Some name real ideas, some rename old ones, and a few are mostly marketing. This phrasebook gives each term a short, plain meaning, says where it came from when that's known, and points to a deeper article when the site has one.

You don't need to read it in order. Jump to a section, read what you're curious about, and skip the rest.

For the building blocks this site uses in every article, such as tool, context window, and trust boundary, the [Agentic AI Glossary](/learn/foundations/agentic-ai-glossary/) has the precise definitions. This page links there instead of repeating them.

Jump to a section:

- [From prompt to loop](#from-prompt-to-loop)
- [How people work with AI](#how-people-work-with-ai)
- [Inside the model](#inside-the-model)
- [How models are shaped](#how-models-are-shaped)
- [Giving AI knowledge](#giving-ai-knowledge)
- [Agent building blocks](#agent-building-blocks)
- [When things go wrong](#when-things-go-wrong)
- [Checking quality](#checking-quality)
- [Words to read with care](#words-to-read-with-care)

## From prompt to loop

Four "engineering" terms arrived one after another between 2022 and 2026. Each one names a wider layer around the model, and each layer still contains the ones before it.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Diagram of four nested engineering layers. Scrolls horizontally on small screens.">

![Four nested boxes. Innermost: prompt engineering, how to phrase one request, from 2022. Inside context engineering, what the model should see at each step, named 2025. Inside harness engineering, what tools, rules, and checks surround the agent, named early 2026. Outermost: loop engineering, what keeps the agent working toward a goal and when it stops, named mid-2026.](../../../assets/diagrams/foundations/engineering-ladder.svg)

</div>
<figcaption>From prompt to loop: each new term names a wider layer around the model.</figcaption>
</figure>

**How to read the diagram.** Start in the middle and move outward. Each box asks a bigger question than the one inside it, and the dates show roughly when each name caught on. Getting the outer layers right still depends on the inner ones: a well-designed loop running badly worded prompts just fails faster.

### Prompt engineering

Writing the instructions and examples you give a model so it does what you want. It took off after ChatGPT's release in late 2022, when getting good answers often depended on phrasing. It still matters, but on its own it covers only one request.

### Context engineering

Deciding everything the model sees on each call: instructions, conversation history, retrieved documents, tool results, and what to leave out. The term spread in mid-2025, after Shopify's CEO Tobi Lütke said he preferred it to "prompt engineering" and Andrej Karpathy agreed. [Context, Memory, and Retrieval](/learn/architecture/context-memory-and-retrieval/) covers the practice.

### Harness engineering

Designing everything around the model that makes an agent reliable: its tools, rules, checks, project files, and the feedback that stops it repeating mistakes. Mitchell Hashimoto, co-creator of Terraform, used the phrase in February 2026 for his habit of fixing an agent's environment instead of re-prompting it. OpenAI and Thoughtworks wrote about it soon after, and the shorthand "agent = model + harness" stuck.

### Loop engineering

Designing the cycle that keeps an agent working toward a goal without a person prompting each step: what starts it, how it checks its own work, what it remembers between runs, and when it stops. The term caught on in mid-2026 through developers such as Peter Steinberger and Addy Osmani, alongside tools that rerun an agent on a schedule or until a goal is met. Every agent already runs a loop, so much of this is a new name for designing [the agent loop](/learn/architecture/the-agent-loop/) well, with more attention to long-running work.

### Agentic engineering

Building software with AI agents doing much of the work while a developer plans, reviews, and stays responsible for the result. Andrej Karpathy used it in early 2026 for the more careful practice that grew out of vibe coding.

### Intent engineering

A newer, loosely defined term for stating goals and success criteria clearly enough that an agent can work toward them. Expect its meaning to shift.

## How people work with AI

### Vibe coding

Building software by describing what you want and accepting what the AI writes, often without reading the code closely. Andrej Karpathy coined it in February 2025, and Collins Dictionary named it Word of the Year for 2025. It's fine for prototypes and personal projects, and risky for code that handles money, data, or security.

### Human in the loop and human on the loop

A human in the loop approves or reviews individual actions before they happen. A human on the loop supervises the system as a whole, watching results and improving the setup, without checking each step. Most real systems mix the two, with approval kept for actions that are costly or hard to undo. See [human-in-the-loop](/learn/foundations/agentic-ai-glossary/#human-in-the-loop) in the glossary.

### Copilot and agent

A copilot suggests and you decide: it completes a line of code or drafts an email for you to edit. An agent takes steps on its own within limits, such as running tests, editing files, or calling tools. Many products now do both, so the label tells you less than asking who chooses the next step. [What Is an AI Agent?](/learn/foundations/what-is-an-agent/) uses that question to sort them.

### AI slop

Low-quality content produced in bulk with AI: filler articles, odd images, padded reports. Merriam-Webster named "slop" its 2025 Word of the Year with roughly this meaning. Inside companies, people also say "workslop" for AI-written documents that look finished but waste the reader's time.

## Inside the model

### LLM

A large language model: a model trained on huge amounts of text to predict what comes next, which turns out to be enough to answer questions, write code, and follow instructions. Most of what people call "AI" in products today is an LLM with other software around it.

### Foundation model

A large, general model trained once at great cost, then adapted for many uses. Most LLMs are foundation models. The term emphasizes that other products are built on top of them.

### Token

The unit a model reads and writes, roughly a short word or part of a word. Prices and limits are counted in tokens, and so is speed. See [token](/learn/foundations/agentic-ai-glossary/#token) in the glossary.

### Context window

The most text, in tokens, a model can take in for one call. See [context window](/learn/foundations/agentic-ai-glossary/#context-window) in the glossary.

### Context rot

The drop in answer quality as the context gets longer and more cluttered. A model can accept a very long input and still lose track of details buried in it, so sending less often gets better answers.

### Reasoning models

Models that work through a problem step by step before answering, often called "thinking" models. They tend to do better on math, code, and multi-step questions, and they take longer and cost more per answer.

### Test-time compute

Spending more computing power when the model answers, for example by letting it think longer or try several approaches, instead of only making the model bigger during training. Reasoning models are the main example.

### Multimodal

A model that handles more than text, such as images, audio, or video, in its input, its output, or both.

### Open-weight models

Models whose trained weights you can download and run yourself. Open-weight isn't always the same as open source: the training data and code are often not released, and licenses vary.

### Small language models

Models small enough to run on a laptop or phone, or cheaply on a server. They're less capable than the largest models, but faster, cheaper, and easier to keep private.

### Mixture of experts

A model design where only some parts of the model, called experts, are used for each token. It lets a model be very large in total while using only a fraction of it at a time, which keeps costs down.

### Inference

Running a trained model to get an answer. Training happens once. Inference happens every time someone uses the model, so it's where most day-to-day cost and speed questions come from.

## How models are shaped

### Pre-training

The first, most expensive stage, where a model learns from a huge amount of general text. It gives the model broad knowledge and language ability, but not yet good manners or a helpful style.

### Fine-tuning

Further training on a smaller, focused set of examples to adapt a model to a task, a tone, or a field. It changes the model itself, unlike prompting or retrieval, which only change what you send it.

### RLHF

Reinforcement learning from human feedback: people compare or rate model answers, and the model is trained toward the answers they prefer. It's a large part of why assistants sound helpful and polite.

### Distillation

Training a smaller model to imitate a larger one, often using the larger model's answers as training data. The result is cheaper to run and keeps much of the larger model's skill.

### System prompt

The standing instructions an application sends with every request, setting the model's role, rules, and tone. Users usually don't see it. It guides behavior but doesn't enforce anything, as [instructions](/learn/foundations/agentic-ai-glossary/#instructions-system-prompt) in the glossary explains.

## Giving AI knowledge

### RAG

Retrieval-augmented generation: looking up relevant documents and adding them to the model's input before it answers, so it can use information it wasn't trained on. See [retrieval](/learn/foundations/agentic-ai-glossary/#retrieval-rag) in the glossary and [Context, Memory, and Retrieval](/learn/architecture/context-memory-and-retrieval/).

### Embeddings

Lists of numbers that represent the meaning of a piece of text, so that texts with similar meanings get similar numbers. They let software find "documents about late deliveries" even when the words don't match exactly.

### Vector database

A database built to store embeddings and quickly find the ones closest to a query. It's the usual search engine behind RAG.

### Agentic RAG

RAG where the agent decides when to search, what to search for, and whether to search again, instead of the application running one search up front. It finds better material for hard questions, at the cost of more steps.

### Grounding

Tying a model's answer to specific sources, such as retrieved documents or tool results, so claims can be checked. A grounded answer can still be wrong if the source is wrong, but you can see where it came from.

### Compaction

Shrinking a long conversation by replacing older parts with a summary, so the agent can keep going without running out of context. Anything the summary leaves out is gone.

## Agent building blocks

### MCP

The Model Context Protocol, an open standard for connecting AI applications to tools and data through MCP servers. Anthropic released it in November 2024 and donated it in December 2025 to the Agentic AI Foundation, part of the Linux Foundation. See [MCP](/learn/foundations/agentic-ai-glossary/#model-context-protocol-mcp) in the glossary.

### A2A

The Agent2Agent protocol, an open standard for agents from different vendors to find each other, share tasks, and report results. Google introduced it in April 2025 and moved it to the Linux Foundation later that year. MCP connects an agent to tools, and A2A connects agents to each other.

### AGENTS.md

A plain Markdown file in a code repository that tells AI coding agents how the project works: how to build it, run tests, and follow its conventions. OpenAI introduced it and donated it to the Agentic AI Foundation in December 2025. Some tools use their own file name for the same idea.

### Skills

Packaged instructions, and sometimes scripts, that an agent loads only when a task needs them, such as "how to build a spreadsheet" or "our release checklist." They keep specialist know-how out of the context until it's useful.

### Subagents

Separate agents that a main agent starts for a focused subtask, each with its own fresh context. The main agent gets back a short result instead of every detail, which keeps its own context clean.

### Computer use

An agent operating a computer the way a person does: looking at screenshots, moving the mouse, clicking, and typing. It works with apps that have no API, and it's slower and more error-prone than calling a tool directly.

### Deep research agents

Agents that spend minutes running many searches, reading sources, and writing a cited report on a question. The quality depends heavily on the sources they find, so the citations are worth checking.

## When things go wrong

### Hallucination

A model stating something false as if it were true, such as a made-up citation or an API that doesn't exist. See [confabulation](/learn/foundations/agentic-ai-glossary/#confabulation-hallucination) in the glossary.

### Prompt injection

Text that tricks a model into ignoring its instructions, often hidden in a web page, email, or document the agent reads. It's the most important security risk for agents that read content and then act. See [prompt injection](/learn/foundations/agentic-ai-glossary/#prompt-injection-direct-and-indirect) in the glossary.

### Jailbreak

A prompt written to get a model past its safety training, for example by role-play or by splitting a forbidden request into harmless-looking parts. A jailbreak is usually the user attacking the model, while prompt injection usually comes from content the model reads.

### Guardrails

Checks that limit what an AI system can see, say, or do, such as filters, allowlists, and spending limits. The ones enforced in code are controls, while the ones written only into instructions are requests. See [guardrail](/learn/foundations/agentic-ai-glossary/#guardrail) in the glossary.

### Sycophancy

A model telling you what you want to hear: agreeing with a wrong claim, praising weak work, or changing a correct answer when you push back. It comes partly from training on human ratings, since people tend to rate agreeable answers higher.

## Checking quality

### Evals

Tests for AI systems: a set of inputs with a way to score the outputs, run every time you change a prompt, model, or tool. They're the closest thing AI has to unit tests, and without them it's hard to tell whether a change helped.

### LLM-as-judge

Using one model to grade another model's answers against a rubric. It scales much better than human review, but the judge has its own biases, so it's worth checking it against human grades on a sample.

### Benchmarks

Standard public test sets used to compare models. They're useful for a rough picture, but models can be tuned to score well on popular benchmarks, and test questions sometimes leak into training data. Your own evals on your own tasks tell you more.

## Words to read with care

These words appear in headlines and pitches more than in engineering docs. Most have a real meaning underneath, so ask what the speaker means before you trust the claim.

### AGI

Artificial general intelligence: AI that can do most intellectual work a person can. There's no agreed definition or test, so claims that AGI is close, or here, depend on whose definition is being used.

### ASI

Artificial superintelligence: AI that is far better than people at nearly everything. It comes up in forecasts and policy debates, a long way from anything you'd configure in a product.

### AI-native

A product or company designed around AI from the start, instead of adding AI to something that already existed. As a marketing phrase, it often means little more than "uses an LLM."

### "Agentic" as a label

"Agentic" is often used to mean "uses AI." A simple test from [What Is an AI Agent?](/learn/foundations/what-is-an-agent/) cuts through it: does a model choose the next action, can it act outside the conversation, and does it keep going until a stop condition? If not, it's a model call, a chatbot, or a workflow, however it's marketed.
