---
title: How to Choose an Agent Framework
description: A decision guide for comparing frameworks by control flow, portability, observability, evaluation, and deployment fit.
topic: Frameworks
level: Intermediate
publishedAt: 2026-11-03
order: 3
readingMinutes: 5
tags: [frameworks, architecture, evaluation]
featured: false
draft: false
---

Choose an agent framework after you understand the workflow you need. Framework names and features change quickly; the durable question is whether a tool makes your system easier to control, evaluate, and operate.

## Start with a small baseline

Before comparing products, write down the task, model calls, tools, state, stop conditions, and expected failure cases. Build or sketch the smallest version with the model provider's direct API. This gives you a baseline for what the framework must improve.

## Compare frameworks on the same dimensions

| Dimension | Questions to ask |
| --- | --- |
| Control flow | Can you inspect and bound each step? Can you pause, resume, or hand off? |
| Tool integration | Are tool arguments validated? Can authorization stay in your application? |
| State | How are checkpoints and durable state stored? What data is retained? |
| Evaluation | Can you replay traces and measure task quality, safety, latency, and cost? |
| Observability | Can you see model decisions, tool inputs and outputs, errors, and timing? |
| Deployment | Does it fit your runtime, language, privacy constraints, and operating budget? |
| Portability | How hard is it to change model providers or move off the framework? |
| Maturity | Are the features stable, documented, maintained, and appropriate for production? |

Do not score a framework by the number of integrations in its feature list. Build the same small task with the candidates you are considering, then compare code complexity and behavior under failures.

## When a framework helps

A framework can be valuable when it provides a control-flow model, state handling, tracing, or evaluation support that your team would otherwise build and maintain. It may be a poor fit if it hides important decisions, brings a large runtime for a small task, or encourages a more autonomous design than the use case needs.

## Make the choice testable

Record your task and constraints, list two or three candidates, and run the same representative cases against each. Include invalid requests, tool errors, timeouts, and attempts to exceed permissions. Re-check current official documentation and release notes before writing a version-specific comparison.

This starter article intentionally avoids naming a universal winner. The best fit depends on the system, team, and current framework versions.
