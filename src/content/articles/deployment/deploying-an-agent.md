---
title: "Deploying an Agent: A Release Checklist for Any Platform"
description: What has to be true before an agent reaches real customers, whatever it runs on. A release checklist, a release path with gates and a rollback route, an evaluation gate, and a kill switch, in TypeScript and Python.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-17
order: 2
readingMinutes: 15
tags: [deployment, release, supply-chain, kill-switch, typescript, python]
featured: false
draft: false
---

Deploying an agent looks like deploying any web service: build an artifact, give it a key, put it behind an endpoint. The difference is what a bad release can do. A regression in an ordinary service returns wrong pages. A regression in an agent can book things, spend money, or leak data, because the model decides what to do at run time and the release changed how it decides. A new prompt, a new model version, or a new tool description is a behavior change even when no code changed.

This article is the checklist that sits between "it works on my machine" and real customers. It doesn't depend on a hosting platform: the same items apply on a virtual machine, a container service, or a managed agent platform. It uses the shipment assistant from the earlier tutorials as the example, and it adds the two pieces of code a release needs that the agent doesn't have yet: a gate that reads the evaluation results, and a kill switch.

It builds on [Evaluating Agent Security](/learn/security/evaluating-agent-security/) and [Reliability, Cost, and Runaway Loops](/learn/deployment/reliability-cost-and-runaway-loops/), and it refers back to the threat model in [Threat Modeling an Agent](/learn/security/threat-modeling-an-agent/).

## The release checklist

Every item has a check you can run or a document you can point to, so the answer to each one is evidence, never a feeling.

1. Evaluations pass on the model you ship. The suite is the current version, it ran against the model ID in the release config, every case passed every trial, and there were at least three trials. Step 1 below turns this into a script.
2. Security tests pass. The adversarial cases and the control tests from [Evaluating Agent Security](/learn/security/evaluating-agent-security/) pass, and the threat-register check reports no problems.
3. The threat model was reviewed for this change. If the release adds a tool, a data source, or a new kind of user, the register has new rows. Every residual risk has an owner and a dated decision to reduce, accept, or move it.
4. Limits are enforced in code. Steps, time, tokens, and spend per question; spend per customer per day; call limits per tool; capped read retries; and a circuit breaker on each external service. The model can't change any of them.
5. Approvals are enforced in code. Every write goes through an approval prompt that shows values from your records, and no code path skips it.
6. Secrets are out of code. The model API key and the carrier credentials live in your platform's secret store, never in the repository, the image, the logs, or the prompt. Staging and production use different keys. You know how to rotate each key, and if your provider supports a spend limit per key or per workspace, it's set as a backstop to the limits in code.
7. The agent runs with a least-privilege identity. Its runtime identity can read shipments and call the carrier's status and booking APIs, and nothing else. It can't read other tables, change its own configuration, or reach admin endpoints. Staging has its own identity.
8. Dependencies are pinned and reviewed. Packages install from a lockfile, updates go through review, and the model ID is pinned in config instead of following an alias that can move. Third-party tools and MCP servers count as dependencies too.
9. Logs and alerts are in place. Logs hold event names and numbers, not conversation text. The alert rules from [Reliability, Cost, and Runaway Loops](/learn/deployment/reliability-cost-and-runaway-loops/) are live, and each one has an owner.
10. There's a rollback plan, and it was rehearsed. The previous artifact and its configuration are kept, the conversation state format works with both versions, and someone has rolled back in staging.
11. There's a kill switch, and it was tested. It can put the agent into read-only mode or turn it off without a deploy. Step 2 below builds one.
12. Someone owns incidents. A named person or rotation is on call, with a short runbook: how to flip the kill switch, how to roll back, how to rotate a key, how to contact the model provider, and what to tell customers.

The order matters a little. Items 1 to 5 are about whether this change is safe to ship. Items 6 to 12 are about whether you can operate it, and most of them only need setting up once.

## The release path

The checklist runs as a sequence of gates. Automated gates run on every change, a person signs off before production, and the rollout starts small:

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Flowchart of the release path for an agent change. Scrolls horizontally on small screens.">

![Flowchart from a change to full rollout. A change to the code, the prompt, the model, or a dependency goes through three gates. Gate 1 runs on every pull request: install from the lockfile, type checks, evaluations with the fake model, control tests, and the threat-model check. Gate 2 runs on the release candidate: real-model evaluations with at least three trials, checked by the release gate. Gate 3 is a human checkpoint where the owner signs off on threat changes and residual risk. A failure at any gate leads by a dashed arrow to Blocked, which says to fix the change and start again, and from there back to the change. After the gates, the same artifact and configuration deploy to staging with staging keys, then roll out to 5% of customers while the team watches the budget_breach, circuit_open, and spend alerts, then to 100% of customers, with alerts and an on-call owner. From the staged rollout a dashed arrow leads to a roll back, in code, to the previous artifact, prompt, and model. From full rollout a dashed arrow leads to the kill switch, which sets read_only or off with no deploy.](../../../assets/diagrams/deployment/release-path.svg)

</div>
<figcaption>The release path. Solid arrows promote a change; dashed arrows block it or roll it back.</figcaption>
</figure>

**How to read the diagram.** Follow the center column from top to bottom; that's a change that passes everything. The dashed arrows on the right are the ways out. A failed gate sends the change back to the start, and once real customers are using it, the way back is a rollback or the kill switch, never a hotfix that skips the gates.

Gate 1 is cheap, so it runs on every pull request; the evaluation suite runs with the fake model there, as in [Evaluate Agent Behavior Locally](/learn/architecture/evaluate-agent-behavior-locally/). Gate 2 costs real money, because it calls the model, so it runs once per release candidate. Gate 3 is a person, because a script can tell you the tests pass but not whether the threat model still describes the system.

The staged rollout is where you find what the evaluations missed. Send a small share of customers to the new version, say 5%, and compare its alert rates with the current version's for long enough to see normal traffic, often a day. Decide the rollback triggers before you start: for example, a budget breach rate or a spend per question clearly above the current version's. Without triggers decided in advance, a rollout tends to continue because nobody wants to be the one to stop it.

## Step 1: Gate releases on evaluation results

The evaluation harness writes a results file for every run. The gate reads that file and lists every reason it can't approve a release. It checks that the suite is the current version, that the run tested the model the release uses, that there were enough trials, and that every case in the suite ran and passed every trial:

<div class="code-tabs">

```ts
// evals/release-gate.ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { MODEL } from "../src/config.ts";
import { CASES, SUITE_VERSION } from "./cases.ts";

// The fields of an evaluation results file that the gate reads. Other fields are ignored.
const Results = z.object({
  suite: z.string(),
  model: z.string(),
  trials: z.number().int(),
  results: z.array(z.object({ id: z.string(), passes: z.number().int(), trials: z.number().int() })),
});

export type Expected = { suite: string; model: string; minTrials: number; caseIds: readonly string[] };

// Lists every reason this evaluation run can't approve a release. An empty list means it can.
export function releaseProblems(raw: unknown, expected: Expected): string[] {
  const parsed = Results.safeParse(raw);
  if (!parsed.success) return ["unreadable results file"];
  const run = parsed.data;

  const problems: string[] = [];
  if (run.suite !== expected.suite) problems.push(`suite ${run.suite} is not the current suite ${expected.suite}`);
  if (run.model !== expected.model) problems.push(`tested model ${run.model}, but the release uses ${expected.model}`);
  if (run.trials < expected.minTrials) problems.push(`${run.trials} trial(s), need at least ${expected.minTrials}`);

  const ran = new Map(run.results.map((result) => [result.id, result]));
  for (const id of expected.caseIds) {
    const result = ran.get(id);
    if (!result) problems.push(`${id}: not run`);
    else if (result.passes < result.trials) problems.push(`${id}: passed ${result.passes} of ${result.trials}`);
  }
  return problems;
}

// Usage: node evals/release-gate.ts evals/results/<file>.json
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  const raw: unknown = file ? JSON.parse(await readFile(file, "utf8")) : null;
  const problems = releaseProblems(raw, {
    suite: SUITE_VERSION,
    model: MODEL,
    minTrials: 3,
    caseIds: CASES.map((testCase) => testCase.id),
  });
  for (const problem of problems) console.log(`BLOCK  ${problem}`);
  console.log(problems.length === 0 ? "Release gate passed." : `Release gate failed: ${problems.length} problem(s).`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
```

```python
# evals/release_gate.py
import json
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel, ConfigDict, ValidationError

from agent.config import MODEL
from evals.cases import CASES, SUITE_VERSION


# The fields of an evaluation results file that the gate reads. Other fields are ignored.
class CaseResult(BaseModel):
    model_config = ConfigDict(strict=True)
    id: str
    passes: int
    trials: int


class Results(BaseModel):
    model_config = ConfigDict(strict=True)
    suite: str
    model: str
    trials: int
    results: list[CaseResult]


@dataclass(frozen=True)
class Expected:
    suite: str
    model: str
    min_trials: int
    case_ids: Sequence[str]


# Lists every reason this evaluation run can't approve a release. An empty list means it can.
def release_problems(raw: object, expected: Expected) -> list[str]:
    try:
        run = Results.model_validate(raw)
    except ValidationError:
        return ["unreadable results file"]

    problems: list[str] = []
    if run.suite != expected.suite:
        problems.append(f"suite {run.suite} is not the current suite {expected.suite}")
    if run.model != expected.model:
        problems.append(f"tested model {run.model}, but the release uses {expected.model}")
    if run.trials < expected.min_trials:
        problems.append(f"{run.trials} trial(s), need at least {expected.min_trials}")

    ran = {result.id: result for result in run.results}
    for case_id in expected.case_ids:
        result = ran.get(case_id)
        if result is None:
            problems.append(f"{case_id}: not run")
        elif result.passes < result.trials:
            problems.append(f"{case_id}: passed {result.passes} of {result.trials}")
    return problems


# Usage: python -m evals.release_gate evals/results/<file>.json
def main() -> int:
    raw: object = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")) if len(sys.argv) > 1 else None
    problems = release_problems(raw, Expected(SUITE_VERSION, MODEL, 3, [case.id for case in CASES]))
    for problem in problems:
        print(f"BLOCK  {problem}")
    print("Release gate passed." if not problems else f"Release gate failed: {len(problems)} problem(s).")
    return 0 if not problems else 1


if __name__ == "__main__":
    sys.exit(main())
```

</div>

Run against a results file from the fake model, the gate blocks the release, which is what you want, because a fake-model run tests the harness and says nothing about the model:

<div class="code-tabs">

```bash
node evals/release-gate.ts evals/results/<results-file>.json
```

```bash
python -m evals.release_gate evals/results/<results-file>.json
```

</div>

```text
BLOCK  tested model fake, but the release uses claude-opus-5-5
BLOCK  1 trial(s), need at least 3
Release gate failed: 2 problem(s).
```

A real-model run with one flaky case and one case that didn't run is blocked for both:

```text
BLOCK  malformed-tracking-number: passed 2 of 3
BLOCK  customer-declines: not run
Release gate failed: 2 problem(s).
```

Both versions print the same lines and exit with status 1 on failure, so CI can use the exit code. Requiring every trial to pass is strict on purpose: a case that fails one time in three is a case that fails for one customer in three. If a case is genuinely flaky because of how it's graded, fix the case. Don't lower the bar in the gate.

Two details make the gate hard to fool. It checks for every case in the suite, so deleting a failing case from the results file blocks the release instead of passing it. And the expected values come from the code being released: the model ID from `config`, the suite version and case IDs from `cases`. A results file from an older suite or another model can't approve this release.

## Step 2: Add a kill switch

A kill switch changes what the agent is allowed to do without a deploy. Deploys take minutes and go through the gates; during an incident you need seconds. The shipment agent's switch has three modes:

| Mode | Questions | Bookings | When to use it |
| --- | --- | --- | --- |
| `on` | Answered | Allowed, with approval | Normal operation |
| `read_only` | Answered | Refused with `writes_paused` | A problem with bookings, or anything you're not sure about yet |
| `off` | Not started | Not possible | The agent itself is the problem, or spend is out of control |

The switch reads its mode from outside the deployment, from a feature-flag service, a configuration store, or here, as a stand-in, a small JSON file. It caches the value for 10 seconds, so it doesn't read the flag store on every call, and a change takes effect within 10 seconds:

<div class="code-tabs">

```ts
// src/switch.ts
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { toolError } from "./errors.ts";
import { log } from "./log.ts";
import { TOOLS, type ToolOutput } from "./tools.ts";

// on: normal. read_only: answer questions, book nothing. off: don't start new questions.
const Mode = z.enum(["on", "read_only", "off"]);
export type Mode = z.infer<typeof Mode>;

// Reads the switch from outside the deployment, so you can flip it without a release.
export class KillSwitch {
  private last: Mode | null = null;
  private readAt = -Infinity;
  private readonly read: () => Promise<unknown>;
  private readonly maxAgeMs: number;
  private readonly now: () => number;

  constructor(read: () => Promise<unknown>, maxAgeMs = 10_000, now: () => number = Date.now) {
    this.read = read;
    this.maxAgeMs = maxAgeMs;
    this.now = now;
  }

  async mode(): Promise<Mode> {
    if (this.last !== null && this.now() - this.readAt < this.maxAgeMs) return this.last;
    try {
      this.last = Mode.parse(await this.read());
      this.readAt = this.now();
    } catch {
      log("kill_switch_unreadable", { using: this.last ?? "off" });
    }
    return this.last ?? "off"; // never read successfully: stay off
  }
}

// A stand-in for your flag service: a small JSON file such as {"mode": "read_only"}.
export function readModeFromFile(path: string): () => Promise<unknown> {
  return async () => JSON.parse(await readFile(path, "utf8")).mode;
}

type RunTool = (name: string, input: unknown) => Promise<ToolOutput>;

// Checked on every tool call, so read_only takes effect in the middle of a run too.
export function guardWrites(runTool: RunTool, killSwitch: KillSwitch): RunTool {
  return async (name, input) => {
    const isWrite = Object.hasOwn(TOOLS, name) && TOOLS[name].access === "write";
    if (isWrite && (await killSwitch.mode()) !== "on") return toolError("denied", "writes_paused");
    return runTool(name, input);
  };
}
```

```python
# agent/switch.py
import json
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Literal

from pydantic import TypeAdapter, ValidationError

from .budget import now_ms
from .errors import ToolOutput, tool_error
from .log import log
from .tools import TOOLS, RunTool

# on: normal. read_only: answer questions, book nothing. off: don't start new questions.
type Mode = Literal["on", "read_only", "off"]
MODE: TypeAdapter[Mode] = TypeAdapter(Mode)


# Reads the switch from outside the deployment, so you can flip it without a release.
class KillSwitch:
    def __init__(
        self, read: Callable[[], Awaitable[object]], max_age_ms: int = 10_000, now: Callable[[], int] = now_ms
    ) -> None:
        self._read, self._max_age_ms, self._now = read, max_age_ms, now
        self._last: Mode | None = None
        self._read_at = 0

    async def mode(self) -> Mode:
        if self._last is not None and self._now() - self._read_at < self._max_age_ms:
            return self._last
        try:
            self._last = MODE.validate_python(await self._read())
            self._read_at = self._now()
        except (OSError, ValueError, KeyError, TypeError, ValidationError):
            log("kill_switch_unreadable", {"using": self._last or "off"})
        return self._last or "off"  # never read successfully: stay off


# A stand-in for your flag service: a small JSON file such as {"mode": "read_only"}.
def read_mode_from_file(path: str) -> Callable[[], Awaitable[object]]:
    async def read() -> object:
        value: object = json.loads(Path(path).read_text(encoding="utf-8"))["mode"]
        return value

    return read


# Checked on every tool call, so read_only takes effect in the middle of a run too.
def guard_writes(run_tool: RunTool, kill_switch: KillSwitch) -> RunTool:
    async def guarded(name: str, tool_input: object) -> ToolOutput:
        tool = TOOLS.get(name)
        if tool is not None and tool.access == "write" and await kill_switch.mode() != "on":
            return tool_error("denied", "writes_paused")
        return await run_tool(name, tool_input)

    return guarded
```

</div>

The switch fails safe. If the flag store can't be read, it keeps the last mode it read successfully. If it has never read one, it stays `off`: an agent that can't confirm it's allowed to run shouldn't run. Choose that deliberately, because it means an outage of your flag store at startup becomes an outage of the agent. The other choice, defaulting to `on`, means you can't stop the agent while the flag store is down, which is often when you most need to.

`guardWrites` checks the mode on every write call, so flipping to `read_only` stops bookings in runs that are already in progress. It refuses with an error the model already knows how to handle: the Stage 4 system prompt tells it to say what it couldn't do.

To wire it in, create one `KillSwitch` when `main.ts` starts, with `readModeFromFile("flags/shipment-agent.json")` or a reader for your flag service. Before each question, call `mode()`, and if it's `off`, reply that the assistant is paused and skip the run. Then wrap the runner: `runTool: guardWrites(createToolRunner(session, askInTerminal), killSwitch)`. The Python version is the same with `read_mode_from_file` and `guard_writes`.

These are the cases the two versions were tested against with a scripted flag store, and they behave the same way in each:

- The first read fails: the mode is `off`.
- The flag says `read_only`: questions are answered, and a booking returns `{"error":"writes_paused","kind":"denied","retryable":false}`.
- The flag holds an invalid value such as `"sideways"`, isn't valid JSON, or the file is missing: the switch keeps its last good mode, or `off` if it has none, and logs `kill_switch_unreadable`.
- Within 10 seconds of a read, the flag store isn't read again.

## Plan the rollback

A rollback puts the previous version back: the artifact, and everything that changes the agent's behavior with it. For an agent that means the code, the system prompt, the tool definitions, and the model ID. Keep all four in the release, versioned together, so "the previous version" means one thing. If the prompt lives in a database that's edited separately, a code rollback leaves the new prompt in place.

Check three things before the release, not during the incident:

- State compatibility. The previous version must be able to read conversation state written by the new one, or the rollback breaks every conversation in progress. Add new fields in a way older code ignores, and remove old ones only after a release that no longer needs them.
- Side effects. A rollback doesn't undo what the new version did. Bookings it made are real, and its log entries and spend stay recorded. This is why `read_only` comes first in most incidents: it stops new side effects within seconds, while the rollback runs.
- Model availability. If the previous version uses an older model ID, check that the provider still serves it. Providers retire older models, so a rollback target can stop working while nobody is looking.

## Security implications

The release process decides what goes into the agent and who can change it, so it's a security control in its own right:

- The agent's supply chain includes more than packages. The OWASP Top 10 for Agentic Applications (2026) lists Agentic Supply Chain Vulnerabilities as ASI04, covering the third-party code, tools, and services an agent depends on. NIST's Generative AI Profile (NIST AI 600-1, July 2024) lists Value Chain and Component Integration among its risks, which includes third-party components such as models and data whose origins and quality you may not control. For the shipment agent, that means the npm or PyPI packages, the model and its provider, the carrier API, and any MCP server or hosted tool you add later. Pin each one, review changes to it, and treat a model upgrade as a release that goes through every gate.
- The kill switch is a powerful control, so protect it like one. Anyone who can flip it can take the agent offline, and anyone who can stop it being flipped can prevent you from containing an incident. Limit who can write the flag, log every change, and make sure the agent's own identity can only read it.
- The gates only work if they can't be skipped. Run the release gate from the protected main branch, require it before deployment, and keep the deploy credentials away from pull requests from forks, as in the CI setup from [Evaluate Agent Behavior Locally](/learn/architecture/evaluate-agent-behavior-locally/).
- Least privilege limits the blast radius of everything else. If an injected instruction gets past every other control, what the agent's identity can reach is what an attacker can reach. The OWASP list covers misuse of an agent's identity and permissions as Identity and Privilege Abuse (ASI03).

What the checklist gives you is an explicit decision: each item is a question someone answered with evidence before customers were exposed, and the owner's sign-off records who decided the remaining risk was acceptable.

## What to learn next

This is the last platform-neutral article in the deployment track. Stage 8 applies the checklist to a specific platform, starting with What Is Microsoft Foundry, which explains the parts of Microsoft's agent platform before the hosting tutorials show where each checklist item lives there.
