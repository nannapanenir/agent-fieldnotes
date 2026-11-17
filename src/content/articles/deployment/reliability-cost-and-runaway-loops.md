---
title: "Reliability, Cost, and Runaway Loops: Budgets, Breakers, and Partial Answers"
description: Keep an agent from looping, hammering a failing service, or running up a surprise bill. Add a spend budget per question and per customer, a circuit breaker, a wrap-up answer when a limit is hit, and alerts, in TypeScript and Python.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-17
order: 1
readingMinutes: 26
tags: [deployment, reliability, cost, circuit-breaker, typescript, python]
featured: false
draft: false
---

The shipment agent from [Add State and Handle Tool Errors](/learn/architecture/add-state-and-handle-tool-errors/) already stops a question after 8 model calls, 120 seconds, or 80,000 tokens. That's enough on a laptop. In production the same agent answers thousands of questions a day, the carrier's API has bad hours, and a prompt change can leave the model asking for the same tool over and over. Three things go wrong at that scale: a run loops until a limit catches it, retries pile onto a service that's already failing, and the bill grows faster than anyone notices.

This article adds controls for all three. Each question gets a spend budget in dollars next to its step, time, and token limits. Each customer gets a daily spend cap across all of their questions. Calls to the carrier go through a circuit breaker that stops retrying once the carrier is clearly down. When a limit is hit, the agent makes one last call with tools switched off, so the customer gets what the run found instead of a bare error. And every breach writes a log event you can alert on.

The code builds on the project from the Stage 4 tutorials, in TypeScript and Python. The evaluation suite from [Evaluate Agent Behavior Locally](/learn/architecture/evaluate-agent-behavior-locally/) and the control tests from [Evaluating Agent Security](/learn/security/evaluating-agent-security/) still pass after these changes.

## What changes

| File | Change |
| --- | --- |
| `src/budget.ts` | New: prices, the per-question run budget, and the per-customer daily spend ledger |
| `src/breaker.ts` | New: a circuit breaker, and one shared instance for the carrier |
| `src/runner.ts` | Updated: carrier reads go through the breaker, and an open circuit skips the retries |
| `src/loop.ts` | Updated: one budget object replaces the three inline limits, and a breach ends with a wrap-up call |
| `src/main.ts` | Updated: checks the daily spend before each question, and shows partial answers |
| `evals/runaway.ts` | New: a scripted model that never stops, to rehearse the limits |

The Python files have the same names under `agent/` and `evals/`. Nothing else changes, so `tools.ts`, `carrier.ts`, `config.ts`, and the evaluation suite stay as they were.

## Four budgets, and why tokens aren't dollars

A budget is a limit the application checks before it spends anything more on a run. The agent needs four, at two scopes:

| Budget | Limit in this article | What it catches | Scope |
| --- | --- | --- | --- |
| Steps | 8 model calls | A model that keeps calling tools without converging | One question |
| Time | 120 seconds | Slow tools, slow approvals, slow model calls | One question |
| Tokens | 80,000 input plus output tokens | A conversation that grows past the context you meant to send | One question |
| Spend | $0.50 per question, $5.00 per customer per day | Expensive runs, and one customer asking question after question | One question, and one customer per day |

The token limit from Stage 4 isn't a cost limit, for two reasons. Output tokens cost more than input tokens: on Anthropic's price list for Claude Opus 5.5, checked on 2026-11-17, input costs $4 per million tokens and output costs $20 per million. And tokens read from the prompt cache are reported separately from `input_tokens`, so the Stage 4 count leaves them out entirely, even though they're billed (at $0.20 per million for that model). A run that writes long answers, or re-reads a large cached prompt on every step, can stay under the token limit and still cost several times what you expected. The spend budget prices each response from its `usage` object, so it counts everything the API bills.

Prices change, and they differ by model, so treat the numbers in the code as configuration. Load them from your settings, and check them against the provider's current price list when you change models.

## Step 1: Price every response

`budget.ts` holds the prices, a `RunBudget` for one question, and a `SpendLedger` for each customer's daily total. The run budget is checked before every model call and updated after every response:

<div class="code-tabs">

```ts
// src/budget.ts
// US dollars per million tokens for claude-opus-5-5, from Anthropic's price list on 2026-11-17.
// Prices change: load them from configuration and check them against the current list.
const PRICE_PER_MTOK = { input: 4.0, output: 20.0, cacheRead: 0.2, cacheWrite: 5.0 };

export const SPEND = {
  maxUsdPerQuestion: 0.5, // one run, however many steps it takes
  dailyUsdPerCustomer: 5.0, // all of one customer's questions in a day
} as const;

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function costUsd(usage: Usage): number {
  return (
    (usage.input_tokens * PRICE_PER_MTOK.input +
      usage.output_tokens * PRICE_PER_MTOK.output +
      (usage.cache_read_input_tokens ?? 0) * PRICE_PER_MTOK.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * PRICE_PER_MTOK.cacheWrite) /
    1_000_000
  );
}

export type Limits = { maxSteps: number; maxMs: number; maxTokens: number; maxUsd: number };
export type Breach = "steps" | "time" | "tokens" | "spend";

// One run's budget. Check it before every model call, and record every response.
export class RunBudget {
  steps = 0;
  tokens = 0;
  usd = 0;
  private readonly limits: Limits;
  private readonly now: () => number;
  private readonly startedAt: number;

  constructor(limits: Limits, now: () => number = Date.now) {
    this.limits = limits;
    this.now = now;
    this.startedAt = now();
  }

  check(): Breach | null {
    if (this.steps >= this.limits.maxSteps) return "steps";
    if (this.remainingMs() <= 0) return "time";
    if (this.tokens >= this.limits.maxTokens) return "tokens";
    if (this.usd >= this.limits.maxUsd) return "spend";
    return null;
  }

  remainingMs(): number {
    return this.limits.maxMs - (this.now() - this.startedAt);
  }

  record(usage: Usage): void {
    this.steps += 1;
    this.tokens += usage.input_tokens + usage.output_tokens;
    this.usd += costUsd(usage);
  }
}

// Spend per customer per day, across all of their questions. Keep it in shared storage in production.
export class SpendLedger {
  private readonly spent = new Map<string, number>();
  private readonly dailyUsdPerCustomer: number;

  constructor(dailyUsdPerCustomer: number) {
    this.dailyUsdPerCustomer = dailyUsdPerCustomer;
  }

  private key(customerId: string, day: string): string {
    return `${customerId}:${day}`;
  }

  // Check before starting a question, so one customer can't run up an unbounded bill.
  canStart(customerId: string, day: string): boolean {
    return (this.spent.get(this.key(customerId, day)) ?? 0) < this.dailyUsdPerCustomer;
  }

  add(customerId: string, day: string, usd: number): void {
    const key = this.key(customerId, day);
    this.spent.set(key, (this.spent.get(key) ?? 0) + usd);
  }
}
```

```python
# agent/budget.py
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal, Protocol

# US dollars per million tokens for claude-opus-5-5, from Anthropic's price list on 2026-11-17.
# Prices change: load them from configuration and check them against the current list.
PRICE_PER_MTOK = {"input": 4.0, "output": 20.0, "cache_read": 0.2, "cache_write": 5.0}


@dataclass(frozen=True)
class Spend:
    max_usd_per_question: float = 0.5  # one run, however many steps it takes
    daily_usd_per_customer: float = 5.0  # all of one customer's questions in a day


SPEND = Spend()


class Usage(Protocol):  # matches the usage object on every API response
    @property
    def input_tokens(self) -> int: ...
    @property
    def output_tokens(self) -> int: ...
    @property
    def cache_read_input_tokens(self) -> int | None: ...
    @property
    def cache_creation_input_tokens(self) -> int | None: ...


def cost_usd(usage: Usage) -> float:
    return (
        usage.input_tokens * PRICE_PER_MTOK["input"]
        + usage.output_tokens * PRICE_PER_MTOK["output"]
        + (usage.cache_read_input_tokens or 0) * PRICE_PER_MTOK["cache_read"]
        + (usage.cache_creation_input_tokens or 0) * PRICE_PER_MTOK["cache_write"]
    ) / 1_000_000


@dataclass(frozen=True)
class Limits:
    max_steps: int
    max_ms: int
    max_tokens: int
    max_usd: float


type Breach = Literal["steps", "time", "tokens", "spend"]


def now_ms() -> int:
    return int(time.monotonic() * 1000)


# One run's budget. Check it before every model call, and record every response.
class RunBudget:
    def __init__(self, limits: Limits, now: Callable[[], int] = now_ms) -> None:
        self.limits, self._now = limits, now
        self._started_at = now()
        self.steps = 0
        self.tokens = 0
        self.usd = 0.0

    def check(self) -> Breach | None:
        if self.steps >= self.limits.max_steps:
            return "steps"
        if self.remaining_ms() <= 0:
            return "time"
        if self.tokens >= self.limits.max_tokens:
            return "tokens"
        if self.usd >= self.limits.max_usd:
            return "spend"
        return None

    def remaining_ms(self) -> int:
        return self.limits.max_ms - (self._now() - self._started_at)

    def record(self, usage: Usage) -> None:
        self.steps += 1
        self.tokens += usage.input_tokens + usage.output_tokens
        self.usd += cost_usd(usage)


# Spend per customer per day, across all of their questions. Keep it in shared storage in production.
class SpendLedger:
    def __init__(self, daily_usd_per_customer: float) -> None:
        self.daily_usd_per_customer = daily_usd_per_customer
        self._spent: dict[tuple[str, str], float] = {}

    # Check before starting a question, so one customer can't run up an unbounded bill.
    def can_start(self, customer_id: str, day: str) -> bool:
        return self._spent.get((customer_id, day), 0.0) < self.daily_usd_per_customer

    def add(self, customer_id: str, day: str, usd: float) -> None:
        self._spent[(customer_id, day)] = self._spent.get((customer_id, day), 0.0) + usd
```

</div>

Because the check runs before each call, a run can go over its spend budget by the cost of one call: the check passes at $0.45, and the next response costs $0.09. Size `max_tokens` with that in mind, since it sets the most one response can add.

The ledger keys spend by customer ID and UTC day. It lives in memory here, which is fine for one process. With more than one instance of the agent, keep it in a shared database, or each instance gives every customer a separate $5.00.

The Python `Usage` is a `Protocol`, so `cost_usd` accepts the SDK's own usage object without converting it. TypeScript gets the same effect from structural typing.

## Step 2: Add a circuit breaker for the carrier

Retries help when a failure is brief. When the carrier is down for an hour, they make things worse: every read tries three times, every question may read several packages, and every customer is asking at once. Your agent ends up sending the carrier three times its normal traffic at the moment it can least handle it, and every customer waits through the backoff for an answer that was never coming.

A circuit breaker fixes that. It sits in front of a dependency and counts failures. After enough failures in a row it "opens", and calls fail at once without reaching the dependency. After a cooldown it lets one trial call through. If the trial works, the breaker closes again; if not, it stays open for another cooldown.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="State diagram of the carrier circuit breaker. Scrolls horizontally on small screens.">

![State diagram with three states. Closed: calls go to the carrier and failures are counted. Open: calls are rejected at once, and the tool returns upstream_unavailable with no retry. Half-open: one trial call goes through and other calls are rejected. Transition 1, from closed to open: five failures with no success between them, which opens the circuit and starts a 30-second cooldown. Transition 2, from open to half-open: the cooldown has passed, and the next call becomes the trial. Transition 3, from half-open to closed: the trial succeeds, which resets the failure count. Transition 4, from half-open back to open: the trial fails, which restarts the cooldown.](../../../assets/diagrams/deployment/circuit-breaker-states.svg)

</div>
<figcaption>The carrier breaker's three states. The numbered markers match the legend under the diagram.</figcaption>
</figure>

**How to read the diagram.** Start at Closed, top left, which is where the breaker spends most of its life. Follow the numbers: 1 opens the circuit, 2 moves it to a single trial, and from Half-open the trial either closes it (3) or opens it again (4). There's no arrow from Open straight back to Closed, because the only way back is a successful trial.

<div class="code-tabs">

```ts
// src/breaker.ts
export class CircuitOpenError extends Error {
  name = "CircuitOpenError";
}

type State = "closed" | "open" | "half_open";

// Stops calling a failing dependency for a while, then lets one trial call through.
export class CircuitBreaker {
  state: State = "closed";
  private failures = 0;
  private openedAt = 0;
  private trialInFlight = false;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(failureThreshold: number, cooldownMs: number, now: () => number = Date.now) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.now = now;
  }

  async call<T>(work: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (this.now() - this.openedAt < this.cooldownMs) throw new CircuitOpenError();
      this.state = "half_open";
    }
    const isTrial = this.state === "half_open";
    if (isTrial) {
      if (this.trialInFlight) throw new CircuitOpenError(); // only one trial call at a time
      this.trialInFlight = true;
    }
    try {
      const result = await work();
      this.state = "closed";
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.state === "half_open" || this.failures >= this.failureThreshold) {
        this.state = "open";
        this.openedAt = this.now();
      }
      throw error;
    } finally {
      if (isTrial) this.trialInFlight = false;
    }
  }
}

// One breaker for the carrier, shared by every run and every customer in this process.
export const carrierBreaker = new CircuitBreaker(5, 30_000);
```

```python
# agent/breaker.py
from collections.abc import Awaitable, Callable
from typing import Literal

from .budget import now_ms


class CircuitOpenError(Exception):
    pass


type State = Literal["closed", "open", "half_open"]


# Stops calling a failing dependency for a while, then lets one trial call through.
class CircuitBreaker:
    def __init__(self, failure_threshold: int, cooldown_ms: int, now: Callable[[], int] = now_ms) -> None:
        self.failure_threshold, self.cooldown_ms, self.now = failure_threshold, cooldown_ms, now
        self.state: State = "closed"
        self._failures = 0
        self._opened_at = 0
        self._trial_in_flight = False

    async def call[T](self, work: Callable[[], Awaitable[T]]) -> T:
        if self.state == "open":
            if self.now() - self._opened_at < self.cooldown_ms:
                raise CircuitOpenError
            self.state = "half_open"
        is_trial = self.state == "half_open"
        if is_trial:
            if self._trial_in_flight:
                raise CircuitOpenError  # only one trial call at a time
            self._trial_in_flight = True
        try:
            result = await work()
        except Exception:
            self._failures += 1
            if self.state == "half_open" or self._failures >= self.failure_threshold:
                self.state = "open"
                self._opened_at = self.now()
            raise
        finally:
            if is_trial:
                self._trial_in_flight = False
        self.state = "closed"
        self._failures = 0
        return result


# One breaker for the carrier, shared by every run and every customer in this process.
carrier_breaker = CircuitBreaker(5, 30_000)
```

</div>

A few details matter here. Calls the breaker rejects don't count as failures, so an open breaker doesn't keep extending its own outage. Only one trial runs at a time, so a recovering carrier gets one request instead of a burst. And the breaker is shared by every run and every customer in the process, because the carrier's health doesn't depend on who's asking. If you run several instances, each has its own breaker and learns about the outage on its own, which is usually acceptable. Sharing breaker state between instances is possible, but it adds a dependency that can fail too.

## Step 3: Send carrier reads through the breaker

The runner wraps each timed read attempt in the breaker, but only for tools that call the carrier. `listMyShipments` reads your own records, so it keeps working while the carrier is down, and the model can still say which packages the customer has. When the breaker rejects a call, the runner returns `upstream_unavailable` at once and skips the remaining retries:

<div class="code-tabs">

```ts
// src/runner.ts
import { carrierBreaker, CircuitOpenError } from "./breaker.ts";
import { TimeoutError, toolError, withTimeout } from "./errors.ts";
import { log } from "./log.ts";
import { TOOLS, validArgs, type Approve, type Session, type ToolOutput } from "./tools.ts";

const READ_TIMEOUT_MS = 5_000;
const READ_RETRIES = 2;
const BASE_BACKOFF_MS = 250;
const CARRIER_READS = new Set(["getShipmentStatus"]); // reads that call the carrier's API

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// One runner per run: identity and approval come from the application, and the call counts start at zero.
export function createToolRunner(session: Session, approve: Approve) {
  const callsSoFar = new Map<string, number>();

  return async (name: string, input: unknown): Promise<ToolOutput> => {
    if (!Object.hasOwn(TOOLS, name)) return toolError("validation", "unknown_tool");
    const tool = TOOLS[name];

    const used = callsSoFar.get(name) ?? 0;
    if (used >= tool.maxCallsPerRun) return toolError("denied", "tool_limit_reached");
    callsSoFar.set(name, used + 1);

    if (!validArgs(input, tool.args)) return toolError("validation", "invalid_arguments");
    const args = input;
    if (tool.access === "write") return tool.handler(args, session, approve); // one attempt, handled inside

    // Each attempt has a timeout, and attempts that reach the carrier go through its breaker.
    const attempt = () => withTimeout(tool.handler(args, session, approve), READ_TIMEOUT_MS);
    for (let attemptNumber = 1; ; attemptNumber += 1) {
      try {
        return await (CARRIER_READS.has(name) ? carrierBreaker.call(attempt) : attempt());
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          // The carrier is known to be failing: answer at once instead of retrying.
          log("circuit_open", { tool: name, attempt: attemptNumber });
          return toolError("upstream", "upstream_unavailable");
        }
        const kind = error instanceof TimeoutError ? "timeout" : "upstream";
        log("tool_failure", { tool: name, kind, attempt: attemptNumber, error: error instanceof Error ? error.name : "unknown" });
        if (attemptNumber > READ_RETRIES) return toolError(kind, kind === "timeout" ? "tool_timeout" : "upstream_unavailable");
        await sleep(BASE_BACKOFF_MS * 2 ** (attemptNumber - 1) * (0.5 + Math.random()));
      }
    }
  };
}
```

```python
# agent/runner.py
import asyncio
import random

from pydantic import ValidationError

from .breaker import CircuitOpenError, carrier_breaker
from .carrier import UpstreamError
from .errors import ErrorKind, ToolOutput, tool_error
from .log import log
from .tools import TOOLS, Approve, RunTool, Session

READ_TIMEOUT_S = 5.0
READ_RETRIES = 2
BASE_BACKOFF_S = 0.25
CARRIER_READS = {"get_shipment_status"}  # reads that call the carrier's API


# One runner per run: identity and approval come from the application, and the call counts start at zero.
def create_tool_runner(session: Session, approve: Approve) -> RunTool:
    calls_so_far: dict[str, int] = {}

    async def run_tool(name: str, tool_input: object) -> ToolOutput:
        tool = TOOLS.get(name)
        if tool is None:
            return tool_error("validation", "unknown_tool")

        used = calls_so_far.get(name, 0)
        if used >= tool.max_calls_per_run:
            return tool_error("denied", "tool_limit_reached")
        calls_so_far[name] = used + 1

        try:
            args = tool.args.model_validate(tool_input)
        except ValidationError:
            return tool_error("validation", "invalid_arguments")

        if tool.access == "write":
            return await tool.handler(args, session, approve)  # one attempt, handled inside

        # Each attempt has a timeout, and attempts that reach the carrier go through its breaker.
        async def attempt() -> ToolOutput:
            return await asyncio.wait_for(tool.handler(args, session, approve), READ_TIMEOUT_S)

        attempt_number = 1
        while True:
            try:
                return await (carrier_breaker.call(attempt) if name in CARRIER_READS else attempt())
            except CircuitOpenError:
                # The carrier is known to be failing: answer at once instead of retrying.
                log("circuit_open", {"tool": name, "attempt": attempt_number})
                return tool_error("upstream", "upstream_unavailable")
            except (TimeoutError, UpstreamError) as error:
                kind: ErrorKind = "timeout" if isinstance(error, TimeoutError) else "upstream"
                log(
                    "tool_failure",
                    {"tool": name, "kind": kind, "attempt": attempt_number, "error": type(error).__name__},
                )
                if attempt_number > READ_RETRIES:
                    return tool_error(kind, "tool_timeout" if kind == "timeout" else "upstream_unavailable")
                await asyncio.sleep(BASE_BACKOFF_S * 2 ** (attempt_number - 1) * (0.5 + random.random()))
                attempt_number += 1

    return run_tool
```

</div>

The timeout sits inside the breaker, so a carrier that hangs counts as failing, the same as one that returns errors. The model sees the same `upstream_unavailable` code whether the breaker rejected the call or three attempts failed, so the system prompt from Stage 4 already tells it what to do.

Bookings don't go through the breaker. They already get one attempt and one call per question, so they can't add up to a retry storm. If you'd rather not even try a booking while the carrier is known to be down, check the breaker's state before calling and return `booking_failed`, which tells the customer nothing was booked.

## Step 4: Check the budgets, and wrap up with a partial answer

The loop now builds one `RunBudget` from the Stage 4 limits plus the spend limit, checks it before every call, and records every response. The result carries the run's cost, so the entry point can add it to the ledger.

When a budget runs out, the Stage 4 loop just stopped, and the customer got "Sorry, I couldn't finish that." By then the run may already know useful things: that the package list loaded, or that the carrier is down. So on a step, token, or spend breach, the loop makes one wrap-up call. It sends the conversation so far, adds an instruction to answer from the results already gathered, and sets `tool_choice` to `none`, which tells the API the model can't call tools in this response. The call is capped at 1,024 output tokens and 15 seconds. A time breach skips the wrap-up, since the run's deadline has already passed.

<div class="code-tabs">

```ts
// src/loop.ts
import type Anthropic from "@anthropic-ai/sdk";
import { RunBudget, SPEND, type Breach } from "./budget.ts";
import { LIMITS, MODEL, SYSTEM_PROMPT } from "./config.ts";
import { log } from "./log.ts";
import type { ToolOutput } from "./tools.ts";

export type CreateMessage = (
  params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
  options: { timeoutMs: number },
) => Promise<Anthropic.Beta.BetaMessage>;

export type AgentDeps = {
  createMessage: CreateMessage;
  tools: Anthropic.Beta.BetaTool[];
  runTool: (name: string, input: unknown) => Promise<ToolOutput>;
};

export type StopReason =
  | "step_limit"
  | "time_limit"
  | "token_limit"
  | "spend_limit"
  | "refusal"
  | "max_tokens"
  | "unexpected_stop";

export type RunResult =
  | { outcome: "answered"; text: string; steps: number; tokens: number; usd: number }
  | { outcome: "stopped"; reason: StopReason; partialAnswer: string | null; steps: number; tokens: number; usd: number };

export type RunOutput = RunResult & { messages: Anthropic.Beta.BetaMessageParam[] };

const BREACH_REASONS: Record<Breach, StopReason> = {
  steps: "step_limit",
  time: "time_limit",
  tokens: "token_limit",
  spend: "spend_limit",
};

const WRAP_UP_PROMPT =
  "You have reached the limit for this question and can't call any more tools. " +
  "Answer now from the tool results above, and say plainly what you couldn't check.";
const WRAP_UP_MAX_TOKENS = 1_024;
const WRAP_UP_TIMEOUT_MS = 15_000;

const textOf = (response: Anthropic.Beta.BetaMessage): string =>
  response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

export async function runAgent(
  history: Anthropic.Beta.BetaMessageParam[],
  question: string,
  deps: AgentDeps,
): Promise<RunOutput> {
  const budget = new RunBudget({
    maxSteps: LIMITS.maxSteps,
    maxMs: LIMITS.timeoutMs,
    maxTokens: LIMITS.maxTotalTokens,
    maxUsd: SPEND.maxUsdPerQuestion,
  });
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: "user", content: question }];
  const totals = () => ({ steps: budget.steps, tokens: budget.tokens, usd: Math.round(budget.usd * 1e6) / 1e6 });

  const request = (
    conversation: Anthropic.Beta.BetaMessageParam[],
    maxTokens: number,
    toolChoice: Anthropic.Beta.BetaToolChoice,
  ): Anthropic.Beta.Messages.MessageCreateParamsNonStreaming => ({
    model: MODEL,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    tools: deps.tools,
    tool_choice: toolChoice,
    messages: conversation,
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  const stop = (reason: StopReason, partialAnswer: string | null = null): RunOutput => {
    log("run_stopped", { reason, partial: partialAnswer !== null, ...totals() });
    return { outcome: "stopped", reason, partialAnswer, ...totals(), messages };
  };

  // One last call with tools switched off, so the customer gets what the run found before the limit.
  const wrapUp = async (): Promise<string | null> => {
    const last = messages[messages.length - 1];
    if (last.role !== "user" || typeof last.content === "string") return null; // no tool results yet
    const conversation: Anthropic.Beta.BetaMessageParam[] = [
      ...messages.slice(0, -1),
      { role: "user", content: [...last.content, { type: "text", text: WRAP_UP_PROMPT }] },
    ];
    try {
      const response = await deps.createMessage(request(conversation, WRAP_UP_MAX_TOKENS, { type: "none" }), {
        timeoutMs: WRAP_UP_TIMEOUT_MS,
      });
      budget.record(response.usage);
      return response.stop_reason === "end_turn" ? textOf(response) : null;
    } catch (error) {
      log("wrap_up_failed", { kind: error instanceof Error ? error.name : "unknown" });
      return null;
    }
  };

  while (true) {
    // Check every budget before spending anything on the next call.
    const breach = budget.check();
    if (breach) {
      log("budget_breach", { budget: breach, ...totals() });
      // Past the deadline there's no time left for a wrap-up call.
      return stop(BREACH_REASONS[breach], breach === "time" ? null : await wrapUp());
    }

    const response = await deps.createMessage(request(messages, 16_000, { type: "auto" }), {
      timeoutMs: budget.remainingMs(), // the call can't outlive the run's deadline
    });

    budget.record(response.usage);
    log("model_response", {
      step: budget.steps,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      usd: totals().usd,
    });
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      log("run_answered", totals());
      return { outcome: "answered", text, ...totals(), messages };
    }
    if (response.stop_reason === "refusal") return stop("refusal");
    if (response.stop_reason === "max_tokens") return stop("max_tokens");
    if (response.stop_reason !== "tool_use") return stop("unexpected_stop");

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const toolStartedAt = Date.now();
      const output = await deps.runTool(block.name, block.input);
      log("tool_call", { step: budget.steps, tool: block.name, isError: output.isError, ms: Date.now() - toolStartedAt });
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: output.content.slice(0, LIMITS.maxToolResultChars),
        is_error: output.isError,
      });
    }
    messages.push({ role: "user", content: results });
  }
}
```

```python
# agent/loop.py
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal

from anthropic import APIError
from anthropic.types.beta import (
    BetaContentBlockParam,
    BetaMessage,
    BetaMessageParam,
    BetaToolChoiceParam,
    BetaToolParam,
    BetaToolResultBlockParam,
)
from anthropic.types.beta.message_create_params import MessageCreateParamsNonStreaming

from .budget import SPEND, Breach, Limits, RunBudget
from .config import LIMITS, MODEL, SYSTEM_PROMPT
from .errors import ToolOutput
from .log import LogValue, log

type CreateMessage = Callable[[MessageCreateParamsNonStreaming, float], Awaitable[BetaMessage]]


@dataclass(frozen=True)
class AgentDeps:
    create_message: CreateMessage  # (params, timeout in seconds) -> response
    tools: list[BetaToolParam]
    run_tool: Callable[[str, object], Awaitable[ToolOutput]]


type StopReason = Literal[
    "step_limit", "time_limit", "token_limit", "spend_limit", "refusal", "max_tokens", "unexpected_stop"
]


@dataclass(frozen=True)
class Answered:
    text: str
    steps: int
    tokens: int
    usd: float
    outcome: Literal["answered"] = "answered"


@dataclass(frozen=True)
class Stopped:
    reason: StopReason
    partial_answer: str | None
    steps: int
    tokens: int
    usd: float
    outcome: Literal["stopped"] = "stopped"


type RunResult = Answered | Stopped
type RunOutput = tuple[RunResult, list[BetaMessageParam]]  # the result and the whole conversation

BREACH_REASONS: dict[Breach, StopReason] = {
    "steps": "step_limit",
    "time": "time_limit",
    "tokens": "token_limit",
    "spend": "spend_limit",
}

WRAP_UP_PROMPT = (
    "You have reached the limit for this question and can't call any more tools. "
    "Answer now from the tool results above, and say plainly what you couldn't check."
)
WRAP_UP_MAX_TOKENS = 1_024
WRAP_UP_TIMEOUT_S = 15.0


def text_of(response: BetaMessage) -> str:
    return "\n".join(block.text for block in response.content if block.type == "text")


async def run_agent(history: list[BetaMessageParam], question: str, deps: AgentDeps) -> RunOutput:
    budget = RunBudget(
        Limits(
            max_steps=LIMITS.max_steps,
            max_ms=round(LIMITS.timeout_s * 1000),
            max_tokens=LIMITS.max_total_tokens,
            max_usd=SPEND.max_usd_per_question,
        )
    )
    messages: list[BetaMessageParam] = [*history, {"role": "user", "content": question}]

    def usd() -> float:
        return round(budget.usd, 6)

    def totals() -> dict[str, LogValue]:
        return {"steps": budget.steps, "tokens": budget.tokens, "usd": usd()}

    def request(
        conversation: list[BetaMessageParam], max_tokens: int, tool_choice: BetaToolChoiceParam
    ) -> MessageCreateParamsNonStreaming:
        return {
            "model": MODEL,
            "max_tokens": max_tokens,
            "system": SYSTEM_PROMPT,
            "tools": deps.tools,
            "tool_choice": tool_choice,
            "messages": conversation,
            "output_config": {"effort": "medium"},
            # If the model declines, let the API retry on a fallback model in the same call.
            "betas": ["server-side-fallback-2026-07-01"],
            "fallbacks": "default",
        }

    def stop(reason: StopReason, partial_answer: str | None = None) -> RunOutput:
        log("run_stopped", {"reason": reason, "partial": partial_answer is not None, **totals()})
        return Stopped(reason, partial_answer, budget.steps, budget.tokens, usd()), messages

    # One last call with tools switched off, so the customer gets what the run found before the limit.
    async def wrap_up() -> str | None:
        last = messages[-1]
        if last["role"] != "user" or isinstance(last["content"], str):
            return None  # no tool results yet
        content: list[BetaContentBlockParam] = [*last["content"], {"type": "text", "text": WRAP_UP_PROMPT}]
        conversation: list[BetaMessageParam] = [*messages[:-1], {"role": "user", "content": content}]
        try:
            response = await deps.create_message(
                request(conversation, WRAP_UP_MAX_TOKENS, {"type": "none"}), WRAP_UP_TIMEOUT_S
            )
        except (APIError, TimeoutError) as error:
            log("wrap_up_failed", {"kind": type(error).__name__})
            return None
        budget.record(response.usage)
        return text_of(response) if response.stop_reason == "end_turn" else None

    while True:
        # Check every budget before spending anything on the next call.
        breach = budget.check()
        if breach is not None:
            log("budget_breach", {"budget": breach, **totals()})
            # Past the deadline there's no time left for a wrap-up call.
            return stop(BREACH_REASONS[breach], None if breach == "time" else await wrap_up())

        # The call can't outlive the run's deadline.
        response = await deps.create_message(request(messages, 16_000, {"type": "auto"}), budget.remaining_ms() / 1000)

        budget.record(response.usage)
        log(
            "model_response",
            {
                "step": budget.steps,
                "stopReason": response.stop_reason,
                "inputTokens": response.usage.input_tokens,
                "outputTokens": response.usage.output_tokens,
                "usd": usd(),
            },
        )

        # Send back the whole response, including any thinking blocks, on the next call.
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            log("run_answered", totals())
            return Answered(text_of(response), budget.steps, budget.tokens, usd()), messages
        if response.stop_reason == "refusal":
            return stop("refusal")
        if response.stop_reason == "max_tokens":
            return stop("max_tokens")
        if response.stop_reason != "tool_use":
            return stop("unexpected_stop")

        # Run every requested tool, then return all results in one message.
        results: list[BetaToolResultBlockParam] = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            tool_started_at = time.monotonic()
            output = await deps.run_tool(block.name, block.input)
            ms = round((time.monotonic() - tool_started_at) * 1000)
            log("tool_call", {"step": budget.steps, "tool": block.name, "isError": output.is_error, "ms": ms})
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output.content[: LIMITS.max_tool_result_chars],
                    "is_error": output.is_error,
                }
            )
        messages.append({"role": "user", "content": results})
```

</div>

The wrap-up call costs money too, and the loop records it, so a stopped run's spend can end up a little over the cap. That's the price of giving the customer an answer, and the 1,024-token cap keeps it bounded. If a run stops because of the token limit, though, the wrap-up resends the whole conversation, so it's the most expensive kind of wrap-up. If your token limit is set close to the model's context window, skip the wrap-up for token breaches.

A partial answer still isn't saved to the conversation, for the same reason as in Stage 4: the next question should start from the last good state, not from a run that was cut short.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Flowchart of the budget guards around the agent loop. Scrolls horizontally on small screens.">

![Flowchart. A question from the signed-in customer, whose text is untrusted, first meets the daily spend ledger, which is code. If the customer has already spent $5.00 today, a dashed arrow leads to a daily-limit reply with no model call and nothing spent. Otherwise the code checks the run budget: steps, time, tokens, and spend. If any budget is used up, a dashed arrow leads to a wrap-up call to the model with tools off and at most 1,024 output tokens, then to a partial answer, where the code logs budget_breach and adds the spend to the ledger, and then to the alert rules on the logs, which watch the breach rate, spend per hour, and open circuits. If the budget has room, the model gets one call with a timeout equal to the time left in the run, and the code records the usage: one more step, the tokens, and the cost in dollars. If the model answered, the reply goes to the customer and the spend goes to the ledger. If it asked for tools, the tool runner applies its limits and timeouts, carrier reads go through the carrier breaker, which fails fast while open, and a solid arrow returns to the run budget check.](../../../assets/diagrams/deployment/budget-guards.svg)

</div>
<figcaption>Where each budget is checked. Dashed arrows are the paths taken when a limit is reached.</figcaption>
</figure>

**How to read the diagram.** The left column is one question's normal path, from the customer at the top down through the model call and the tools, then back up to the budget check on the left. The right column holds what happens when a limit is reached: the dashed arrows leave the main path at the two checks, and both checks run before any money is spent on the next call. The alert rules at the bottom right read the log events the other boxes write.

## Step 5: Cap each customer's daily spend

The entry point checks the ledger before each question and adds the run's cost after it. If the customer has reached the daily cap, the question never reaches the model. Partial answers get a short note so the customer knows the answer may be incomplete:

<div class="code-tabs">

```ts
// src/main.ts
import Anthropic from "@anthropic-ai/sdk";
import { createInterface } from "node:readline/promises";
import { askInTerminal } from "./approval.ts";
import { SPEND, SpendLedger } from "./budget.ts";
import { CUSTOMERS } from "./data.ts";
import { runAgent } from "./loop.ts";
import { log } from "./log.ts";
import { createToolRunner } from "./runner.ts";
import { loadConversation, saveConversation } from "./state.ts";
import { toolDefinitions } from "./tools.ts";

// Stand-in for sign-in. In a real app, the customer ID comes from the authenticated session.
const [flag, customerId] = process.argv.slice(2);
if (flag !== "--customer" || !customerId || !Object.hasOwn(CUSTOMERS, customerId)) {
  console.error("Usage: npm start -- --customer c-100");
  process.exit(1);
}

const session = { customerId };
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
const ledger = new SpendLedger(SPEND.dailyUsdPerCustomer);
const today = () => new Date().toISOString().slice(0, 10); // UTC day

async function readQuestion(): Promise<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await terminal.question("\n> ")).trim();
  } catch {
    return ""; // input closed
  } finally {
    terminal.close(); // closed before the agent runs, so the approval prompt can use the terminal
  }
}

console.log("Ask about your packages. Press Enter on an empty line to quit.");
while (true) {
  const question = await readQuestion();
  if (!question) break;
  if (!ledger.canStart(customerId, today())) {
    log("daily_spend_reached");
    console.log("You've reached today's limit for the assistant. Please try again tomorrow or contact support.");
    continue;
  }

  try {
    const { messages, ...result } = await runAgent(loadConversation(customerId), question, {
      createMessage: (params, { timeoutMs }) => client.beta.messages.create(params, { timeout: timeoutMs }),
      tools: toolDefinitions,
      runTool: createToolRunner(session, askInTerminal),
    });
    ledger.add(customerId, today(), result.usd);
    if (result.outcome === "answered") {
      saveConversation(customerId, messages);
      console.log(result.text);
    } else if (result.partialAnswer) {
      console.log(`${result.partialAnswer}\n(I stopped early: ${result.reason}. Nothing was saved from this question.)`);
    } else {
      console.log(`Sorry, I couldn't finish that (${result.reason}). Nothing was saved from this question.`);
    }
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? (error.status ?? null) : null;
    log("run_failed", { status, kind: error instanceof Error ? error.name : "unknown" });
    console.log("Sorry, the assistant is unavailable right now.");
  }
}
```

```python
# agent/main.py
import asyncio
import sys
from datetime import UTC, datetime

import anthropic
from anthropic.types.beta import BetaMessage
from anthropic.types.beta.message_create_params import MessageCreateParamsNonStreaming

from .approval import ask_in_terminal
from .budget import SPEND, SpendLedger
from .data import CUSTOMERS
from .log import log
from .loop import AgentDeps, Answered, run_agent
from .runner import create_tool_runner
from .state import load_conversation, save_conversation
from .tools import TOOL_DEFINITIONS, Session


async def read_question() -> str:
    try:
        return (await asyncio.to_thread(input, "\n> ")).strip()
    except EOFError:
        return ""  # input closed


def today() -> str:
    return datetime.now(UTC).date().isoformat()  # UTC day


async def main() -> int:
    # Stand-in for sign-in. In a real app, the customer ID comes from the authenticated session.
    args = sys.argv[1:]
    if len(args) != 2 or args[0] != "--customer" or args[1] not in CUSTOMERS:
        print("Usage: python -m agent.main --customer c-100", file=sys.stderr)
        return 1
    session = Session(customer_id=args[1])

    client = anthropic.AsyncAnthropic()  # reads ANTHROPIC_API_KEY from the environment
    ledger = SpendLedger(SPEND.daily_usd_per_customer)

    async def create_message(params: MessageCreateParamsNonStreaming, timeout_s: float) -> BetaMessage:
        return await client.beta.messages.create(**params, timeout=timeout_s)

    print("Ask about your packages. Press Enter on an empty line to quit.")
    while question := await read_question():
        if not ledger.can_start(session.customer_id, today()):
            log("daily_spend_reached")
            print("You've reached today's limit for the assistant. Please try again tomorrow or contact support.")
            continue
        deps = AgentDeps(
            create_message=create_message,
            tools=TOOL_DEFINITIONS,
            run_tool=create_tool_runner(session, ask_in_terminal),
        )
        try:
            result, messages = await run_agent(load_conversation(session.customer_id), question, deps)
        except anthropic.APIError as error:
            status = error.status_code if isinstance(error, anthropic.APIStatusError) else None
            log("run_failed", {"status": status, "kind": type(error).__name__})
            print("Sorry, the assistant is unavailable right now.")
            continue

        ledger.add(session.customer_id, today(), result.usd)
        if isinstance(result, Answered):
            save_conversation(session.customer_id, messages)
            print(result.text)
        elif result.partial_answer:
            print(f"{result.partial_answer}\n(I stopped early: {result.reason}. Nothing was saved from this question.)")
        else:
            print(f"Sorry, I couldn't finish that ({result.reason}). Nothing was saved from this question.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

</div>

A run that fails with an API error doesn't reach `ledger.add`, so any spend before the error goes unrecorded. A run can fail after several successful steps, so if that matters for you, have `runAgent` record spend as it goes, for example by passing it the ledger.

Both SDKs also retry rate-limit (429) and server (5xx) errors on their own, twice by default, inside a single `createMessage` call. Those retries don't count as steps. They do take time, which is one more reason the per-call timeout comes from the run's remaining time. You can change the number of retries with the client's `maxRetries` option (`max_retries` in Python).

## Step 6: Rehearse a runaway loop

You can't wait for a real runaway to test the limits, so this script fakes one. Its model asks for the same package's status on every step and reports large usage numbers, as a model thinking hard at high effort might. When the loop switches tools off for the wrap-up, it answers.

<div class="code-tabs">

```ts
// evals/runaway.ts
import type Anthropic from "@anthropic-ai/sdk";
import { runAgent, type CreateMessage } from "../src/loop.ts";
import { createToolRunner } from "../src/runner.ts";
import { toolDefinitions } from "../src/tools.ts";

// A scripted model that never gives up: it asks for the same status on every step and writes a lot.
// Usage: CARRIER_MODE=down node evals/runaway.ts
const STEP_USAGE = { input_tokens: 1_500, output_tokens: 4_000, cache_read_input_tokens: 20_000 };
const WRAP_UP_USAGE = { input_tokens: 1_500, output_tokens: 300, cache_read_input_tokens: 20_000 };

const runawayModel: CreateMessage = async (params) => {
  const wrapUp = params.tool_choice?.type === "none";
  const content = wrapUp
    ? [{ type: "text", text: "I couldn't get live tracking for 1Z999AA10123456784 right now. Please try again later." }]
    : [{ type: "tool_use", id: `call_${Date.now()}`, name: "getShipmentStatus", input: { trackingId: "1Z999AA10123456784" } }];
  const response = { role: "assistant", content, stop_reason: wrapUp ? "end_turn" : "tool_use", usage: wrapUp ? WRAP_UP_USAGE : STEP_USAGE };
  return response as unknown as Anthropic.Beta.BetaMessage; // only the fields the loop reads
};

const { messages: _messages, ...result } = await runAgent([], "Where is package 1Z999AA10123456784?", {
  createMessage: runawayModel,
  tools: toolDefinitions,
  runTool: createToolRunner({ customerId: "c-100" }, async () => false),
});
console.log(JSON.stringify(result));
```

```python
# evals/runaway.py
import asyncio
import json
import time
from dataclasses import asdict
from typing import Any

from anthropic.types.beta import BetaMessage, BetaTextBlock, BetaToolUseBlock, BetaUsage
from anthropic.types.beta.message_create_params import MessageCreateParamsNonStreaming

from agent.loop import AgentDeps, run_agent
from agent.runner import create_tool_runner
from agent.tools import TOOL_DEFINITIONS, ApprovalRequest, Session

# A scripted model that never gives up: it asks for the same status on every step and writes a lot.
# Usage: CARRIER_MODE=down python -m evals.runaway
STEP_USAGE = BetaUsage.model_construct(input_tokens=1_500, output_tokens=4_000, cache_read_input_tokens=20_000)
WRAP_UP_USAGE = BetaUsage.model_construct(input_tokens=1_500, output_tokens=300, cache_read_input_tokens=20_000)


async def runaway_model(params: MessageCreateParamsNonStreaming, timeout_s: float) -> BetaMessage:
    content: list[Any]
    tool_choice = params.get("tool_choice")
    if tool_choice is not None and tool_choice["type"] == "none":
        text = "I couldn't get live tracking for 1Z999AA10123456784 right now. Please try again later."
        content, stop_reason, usage = [BetaTextBlock.model_construct(type="text", text=text)], "end_turn", WRAP_UP_USAGE
    else:
        call = BetaToolUseBlock.model_construct(
            type="tool_use",
            id=f"call_{time.monotonic_ns()}",
            name="get_shipment_status",
            input={"tracking_id": "1Z999AA10123456784"},
        )
        content, stop_reason, usage = [call], "tool_use", STEP_USAGE
    return BetaMessage.model_construct(role="assistant", content=content, stop_reason=stop_reason, usage=usage)


async def decline(request: ApprovalRequest) -> bool:
    return False


async def main() -> None:
    deps = AgentDeps(runaway_model, TOOL_DEFINITIONS, create_tool_runner(Session("c-100"), decline))
    result, _ = await run_agent([], "Where is package 1Z999AA10123456784?", deps)
    print(json.dumps(asdict(result)))


asyncio.run(main())
```

</div>

Run it with the carrier down:

<div class="code-tabs">

```bash
CARRIER_MODE=down node evals/runaway.ts
```

```bash
CARRIER_MODE=down python -m evals.runaway
```

</div>

Both versions stop the same way. Here's the TypeScript log, with timestamps removed and the middle steps cut:

```text
{"event":"model_response","step":1,"stopReason":"tool_use","inputTokens":1500,"outputTokens":4000,"usd":0.09}
{"event":"tool_failure","tool":"getShipmentStatus","kind":"upstream","attempt":1,"error":"UpstreamError"}
{"event":"tool_failure","tool":"getShipmentStatus","kind":"upstream","attempt":2,"error":"UpstreamError"}
{"event":"tool_failure","tool":"getShipmentStatus","kind":"upstream","attempt":3,"error":"UpstreamError"}
{"event":"model_response","step":2,"stopReason":"tool_use","inputTokens":1500,"outputTokens":4000,"usd":0.18}
{"event":"tool_failure","tool":"getShipmentStatus","kind":"upstream","attempt":1,"error":"UpstreamError"}
{"event":"tool_failure","tool":"getShipmentStatus","kind":"upstream","attempt":2,"error":"UpstreamError"}
{"event":"circuit_open","tool":"getShipmentStatus","attempt":3}
{"event":"model_response","step":3,"stopReason":"tool_use","inputTokens":1500,"outputTokens":4000,"usd":0.27}
{"event":"circuit_open","tool":"getShipmentStatus","attempt":1}
...
{"event":"budget_breach","budget":"spend","steps":6,"tokens":33000,"usd":0.54}
{"event":"run_stopped","reason":"spend_limit","partial":true,"steps":7,"tokens":34800,"usd":0.556}
```

The run went like this:

- Each step reported 1,500 input tokens, 20,000 cache-read tokens, and 4,000 output tokens, which prices at $0.09. The output is $0.08 of that.
- The first status call failed three times. On the second call, the fifth failure opened the breaker, so the third attempt was rejected without reaching the carrier. Every later call was rejected at once, where the first call had spent more than half a second on retries.
- After six steps the run had spent $0.54, over the $0.50 budget, while it had used only 33,000 of its 80,000 tokens and 6 of its 8 steps. Only the spend budget caught it.
- The wrap-up call answered from what the run had found, and it cost $0.016. The customer saw "I couldn't get live tracking for 1Z999AA10123456784 right now. Please try again later," with a note that the agent stopped early.

The Python version prints the same events with the Python tool names. Run the evaluation suite and the control tests again afterward; they should still pass, because none of their cases come near the new limits.

## Alert on breaches

Limits stop one bad run. Alerts tell you when bad runs become a pattern. Every limit in this article writes a log event, so you can build alert rules on them in whatever log or monitoring system you already use. Here are rules to start from; tune the numbers to your own traffic after a week or two of normal logs:

| Event | Rule to start from | What it usually means |
| --- | --- | --- |
| `budget_breach` | More than 2% of runs in 15 minutes, or double last week's rate | A prompt or model change made runs longer, or someone is probing the agent |
| `budget_breach` with `budget: "spend"` | Any increase after a deploy | Output got longer, or caching stopped working |
| `circuit_open` | Any in the last 5 minutes | The carrier is down; tell the team that owns that integration |
| `daily_spend_reached` | More than a handful of customers an hour | Abuse, or a client app retrying in a loop |
| `model_response` (sum of `usd`) | Spend in the last hour above a set amount for the whole service | Many customers' runs adding up; the per-customer cap can't see this |
| `wrap_up_failed` | Any repeated failures | Partial answers have stopped working, so customers get bare errors |

The fifth rule matters most for cost. Per-question and per-customer budgets can't stop a thousand new accounts each spending just under their limit. A total spend alert, with an owner who can act on it, covers that case. [Deploying an Agent](/learn/deployment/deploying-an-agent/) adds a kill switch that owner can use.

Give every rule an owner who gets the alert and knows what to do with it.

## Security implications

Runaway cost is a security problem when someone can cause it on purpose:

- An attacker doesn't need to break anything to run up your bill. Questions crafted to trigger long tool chains, or many accounts each asking a lot, can do it. The OWASP Top 10 for LLM Applications 2026 covers this as Unbounded Consumption (LLM06:2026). The per-customer cap limits one account, and the total spend alert covers many. Rate limits at your API gateway, per account and per IP address, belong in front of both.
- A failing carrier plus unbounded retries becomes an outage in your agent too, and more load on a service that's trying to recover. The OWASP Top 10 for Agentic Applications (2026) calls this Cascading Failures (ASI08). The breaker limits how far one failure spreads; the threat model in [Threat Modeling an Agent](/learn/security/threat-modeling-an-agent/) lists this risk as T6, and the daily cap closes the gap it left open, a limit across questions and customers.
- The model never sees or sets the budgets, so a prompt injection can't raise them. The wrap-up call has tools switched off, so a run that hits its limit can't take any further action. The wrap-up text is still model output based on tool results that might contain injected instructions, so it gets the same caution as any other answer.
- Some hosting platforms bill for the time a session runs or for how many sessions run at once, whether or not the agent is calling the model. On those platforms a stuck session waiting on a slow tool costs money while it waits, so the time budget is a cost control too. The Stage 8 articles on Microsoft Foundry hosting look at this for specific platforms.
- Key the ledger by the authenticated customer ID from the session, never by anything the client sends. The log events here hold event names and numbers only. The `daily_spend_reached` event deliberately leaves out the customer ID; if you need it to investigate abuse, write it to a log with tighter access.

The NIST AI Risk Management Framework (AI RMF 1.0, January 2023) puts this kind of ongoing monitoring, with owners and response plans, under its Manage function. The budgets and the breaker limit the damage from each bad run, and the alerts and their owners are how you notice a pattern of them.

## What to learn next

The next article, [Deploying an Agent](/learn/deployment/deploying-an-agent/), collects everything from Stages 4 to 7 into a release checklist: evaluations passing, the threat model reviewed, limits and approvals enforced, secrets out of code, and a kill switch with an owner who knows when to use it.
