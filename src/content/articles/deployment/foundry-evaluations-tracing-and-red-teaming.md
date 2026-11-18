---
title: "Foundry Evaluations, Tracing, and Red Teaming: Measuring an Agent You've Deployed"
description: How Microsoft Foundry's built-in evaluators, OpenTelemetry tracing, and the AI Red Teaming Agent fit with the shipment agent's own evaluation and security suites, what was generally available or in preview on the date checked, and how to keep traces from becoming a data leak.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-18
order: 13
stage: 8
stageOrder: 11
readingMinutes: 7
tags: [deployment, foundry, azure, evaluation, tracing, red-teaming, observability]
featured: false
draft: false
---

The shipment agent already has two test suites: the behavior cases from [Evaluate Agent Behavior Locally](/learn/architecture/evaluate-agent-behavior-locally/) and the adversarial cases and control tests from [Evaluating Agent Security](/learn/security/evaluating-agent-security/). They run before a release. Once the agent is deployed on Microsoft Foundry, you also want to know how it behaves on real traffic, and to probe it in ways a fixed list of cases doesn't. Foundry's observability features cover three parts of that: evaluation, tracing, and monitoring, plus the AI Red Teaming Agent for adversarial probing.

This article explains what each one does, what was generally available on 2026-11-18, and how they fit with the suites you already have. It was checked against Microsoft Learn on that date.

## What's available

| Capability | Status on 2026-11-18 | What it gives you |
| --- | --- | --- |
| Tracing | Generally available for prompt, hosted, and external agents; preview for workflow agents | A record of each run: model calls, tool calls, timings |
| Evaluations | Generally available, with some evaluators in preview | Scores for quality, safety, and agent behavior on datasets or traces |
| Red teaming | Generally available; agent-specific risk categories run in the cloud only | Automated adversarial probing, scored as an attack success rate |
| Monitoring dashboards | Preview | Operational and quality metrics over production traffic |

Check each feature's own page before relying on it. The status of individual evaluators and risk categories changes faster than the overview.

## Tracing

A trace is the record of one agent run, made of nested spans: the request, each model call, each tool call. Foundry's tracing is built on OpenTelemetry and stored in Azure Monitor Application Insights, so you query it alongside your other telemetry. Foundry uses the OpenTelemetry GenAI semantic conventions for span names and attributes. Learn notes those conventions have Development status and might change.

Traces answer questions your logs can't: which tool the agent called, with what arguments, how long each step took, and where a failed run went wrong. That's also the risk. Learn's tracing page lists attributes such as `gen_ai.tool.call.arguments` and `gen_ai.tool.call.result`, and warns that tracing "can capture sensitive information, such as user inputs, model outputs, and tool arguments and results." For the shipment agent, that means tracking numbers, delivery addresses, and conversation text. Learn's advice is to redact or minimize personal data before it reaches telemetry, treat trace data as production telemetry with the same access controls and retention as logs, and route sensitive content to a separate table with restricted access.

The Stage 4 logs took the opposite approach: event names and numbers, never content. Keep both, deliberately. Use logs for alerts and dashboards, which many people can see. Use traces, with content restricted, for debugging by the few people who need it. Application Insights also charges by data volume and retention, which Learn points out, so sample production traces rather than keeping everything.

What a trace shows depends on the hosting option. A prompt agent's model and tool calls run inside Foundry and appear in its traces. A hosted agent's protocol library sets up OpenTelemetry for the request, but calls your own code makes directly, such as the shipment agent's calls to Claude and to its tools, appear only if that code is instrumented. Check what your traces actually contain before relying on them for an investigation.

## Evaluations

An evaluator scores an output. Some are deterministic calculations; AI-assisted evaluators use a judge model and can explain their score. Learn's agent evaluators fall into two groups:

| Evaluator | What it checks | Status on 2026-11-18 |
| --- | --- | --- |
| Task completion | Did the agent finish the task with a usable result? | Preview |
| Task adherence | Did its actions follow its instructions and policies? | Preview |
| Intent resolution | Did it understand what the user wanted? | Preview |
| Customer satisfaction | Helpfulness, completeness, clarity, tone, and more across a conversation | Preview |
| Tool call accuracy | Right tool calls, with correct parameters | Generally available |
| Tool selection | Right tools, without unnecessary ones | Generally available |
| Tool input accuracy | Parameters correct across strict criteria | Generally available |
| Task navigation efficiency | Efficient tool use compared with an expected sequence (needs ground truth) | Generally available |

You can run evaluators on a dataset, generate responses from test inputs, evaluate stored production traces, or simulate conversations. In production, Learn describes continuous evaluation of sampled traffic and scheduled evaluation against test datasets to catch drift.

These complement the shipment agent's suites rather than replacing them. The local suite checks tool calls and arguments deterministically, which is exact and free, and uses a model grader only for qualities that need judgment. Foundry's evaluators add judged measures you'd otherwise build yourself, such as intent resolution, and they can run on real traffic, which a fixed suite never sees. Keep the deterministic checks in CI as the release gate from [Deploying an Agent](/learn/deployment/deploying-an-agent/), and treat AI-assisted scores as trends to watch, with the judge model's own limits in mind.

## Red teaming

The AI Red Teaming Agent automates adversarial probing. Learn describes it as built on PyRIT, Microsoft's open-source Python Risk Identification Tool, and combined with Foundry's risk and safety evaluations. It sends attacks at a model or agent, scores each attack-response pair, and reports an attack success rate (ASR) by risk category and attack technique.

Most risk categories, such as harmful content, run both locally and in the cloud. Three agent-specific categories run only in the cloud: prohibited actions (the agent using disallowed tools or actions, based on a policy you provide), sensitive data leakage (leaking financial, medical, or personal data from knowledge bases and tool calls, tested with synthetic data and mock tools), and task adherence. On 2026-11-18, Learn listed cloud red teaming in four regions: East US 2, France Central, North Central US, and Sweden Central. Only text scenarios are supported.

A few operational details from Learn are worth planning around:

- Red teaming runs against a hosted agent are transient, so harmful data isn't logged by Agent Service and chat completions aren't stored. Learn recommends running red teaming in a separate environment from production.
- Cloud results redact the adversarial inputs, so people reading the report aren't exposed to the harmful prompts.
- Learn recommends human review alongside automated runs. An automated scan finds what its attack library contains.

For the shipment agent, the categories that matter most are prohibited actions (booking without approval, reading another customer's package) and sensitive data leakage. Describe those as the policy for the prohibited-actions category, so the scan probes the controls you care about.

## How it fits together

| Question | Tool |
| --- | --- |
| Does this change break known behavior? | The local evaluation suite, deterministic, in CI |
| Do the security controls hold against known attacks? | The adversarial cases and control tests, in CI |
| What do new attacks find? | The AI Red Teaming Agent, before release and on a schedule |
| How is the agent doing on real traffic? | Continuous evaluation on sampled traces, plus the Stage 7 alerts |
| What happened in this one bad run? | Traces, with content access restricted |

Each finding from red teaming or production should end up in the threat register from [Threat Modeling an Agent](/learn/security/threat-modeling-an-agent/) and, where possible, as a new deterministic case in the suite, so the next release is tested against it automatically.

## Security implications

- Traces are a data store. Tool arguments and results contain customer data. Restrict who can read trace content, set retention, and redact what you don't need. NIST's Generative AI Profile (NIST AI 600-1) lists Data Privacy among the main risks for generative AI, and traces are one of the less obvious places it applies.
- Scores are evidence, not certification. A low attack success rate means the attacks that were tried mostly failed. NIST's AI Risk Management Framework puts this kind of testing under its Measure function, and the result should be reported as evidence about specific scenarios.
- Red team where it can't hurt. Run probes against a separate environment with mock tools or test data, so a successful attack doesn't book a real redelivery or read a real customer's data.
- Judge models can be wrong. AI-assisted evaluators inherit the limits of the model doing the judging. Pair them with deterministic checks for anything security-relevant.

## What to learn next

Measuring tells you what the agent does. The next article, Azure Networking and Private Access, covers who can reach the agent, its model, and its tools over the network, and what changes when you take them off the public internet.
