---
title: "Threat Modeling an Agent: From System Description to Residual Risk"
description: Threat-model a real agent step by step, from its data flows and trust boundaries to attack paths, controls, tests, and the risks you decide to accept, using the shipment assistant as the worked example.
topic: Security
level: Intermediate
publishedAt: 2026-11-16
order: 9
readingMinutes: 13
tags: [security, threat-modeling, owasp, nist, agents]
featured: false
draft: false
---

A threat model is a written answer to four questions about a system: what are we working on, what can go wrong, what are we going to do about it, and did we do a good enough job? Security engineer Adam Shostack popularized these questions, and the Threat Modeling Manifesto is built around them. For an agent, the answers have to cover more than the code, because the agent's behavior also depends on a model you don't control and on text from people and systems you don't trust.

This article threat-models one specific agent: the shipment assistant built in the Stage 4 tutorials, from [Build a Minimal Agent](/learn/architecture/build-a-minimal-agent/) to [Evaluate Agent Behavior Locally](/learn/architecture/evaluate-agent-behavior-locally/). It has three tools (`getShipmentStatus`, `listMyShipments`, and `requestRedelivery`), a signed-in customer, an approval prompt before any write, conversation state, and an evaluation suite. By the end you'll have a threat register for it: ten threats, each with its controls, its test, and the risk that remains.

## Organize the work with the NIST AI RMF

NIST's AI Risk Management Framework (AI RMF 1.0, January 2023) groups AI risk work into four functions. They make a good skeleton for a threat model, because each one answers a different part of the job:

| Function | In this threat model |
| --- | --- |
| Govern | Who owns the threat model, where it lives, and when it's reviewed |
| Map | The system description: components, data flows, assets, and trust boundaries |
| Measure | The tests that show each control works |
| Manage | The controls, and the decisions about the risk that remains |

The steps below follow the same order. Govern comes first because a threat model without an owner goes stale the first time someone adds a tool.

## Step 1: Decide who owns it (Govern)

Name an owner, keep the threat model in the repository next to the code, and decide what triggers a review. For the shipment assistant, the triggers are:

- A new tool, or a new argument on an existing tool.
- A new data source the agent reads, such as a help-article search.
- A change of model, provider, or system prompt.
- Any incident or near miss.

Each trigger changes either what the agent can do or what it reads, which are the two things most threats depend on.

## Step 2: Describe the system (Map)

Start with the system as it runs today, which may differ from the design document. For the shipment assistant:

- The customer signs in, and the chat entry point takes the customer ID from the session. The model never supplies it.
- The agent loop sends the conversation to the model provider and runs the tools the model requests, within step, time, and token limits.
- The tool runner checks each call's arguments, the per-tool call limit, and ownership, then calls the shipment records or the carrier API.
- Before a redelivery is booked, an approval prompt shows the customer the exact package, date, and address, taken from the records.
- Conversation state is kept per customer, in memory, and trimmed to 10 turns.
- Logs record events and numbers, never message text.
- Dependencies come from npm or PyPI, and the evaluation suite runs in CI with an API key.

Then list the assets: what an attacker would want, or what you'd hate to lose.

- Customers' shipment details and delivery addresses.
- The ability to book a redelivery, which is the agent's only write action.
- The API key, and the budget it spends.
- Conversation history.
- The service's availability.

## Step 3: Draw the data flows and trust boundaries (Map)

A trust boundary is anywhere data crosses from something you control to something you don't, or back. [Trust Boundaries for Agents](/learn/security/trust-boundaries-for-agents/) covers the idea in general. For the shipment assistant, four kinds of data cross the application's boundary: the customer's messages, the model's output, the carrier's data, and the packages and secrets that build and run the code. Each crossing is where a threat can enter.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Threat model of the shipment agent, with numbered threats. Scrolls horizontally on small screens.">

![Data-flow diagram of the shipment agent with ten numbered threats. Outside the application on the left is the signed-in customer, whose input is untrusted. Inside the application boundary is the trusted code: the chat entry point, which takes the customer ID from the session; the agent loop with step, time, and token limits; the tool runner with argument, owner, and call-limit checks; the approval prompt, a human checkpoint showing values from records; conversation state keyed by customer ID; shipment records; and logs that take simple values only. Outside on the right, drawn dashed as untrusted, are the model provider, which sees the conversation and whose output is untrusted; the carrier API, whose data is untrusted; and dependencies and CI, which hold packages and the API key. The customer talks to the chat entry, which talks to the loop. The loop uses conversation state and calls the model provider and the tool runner. The tool runner calls the carrier API and reads shipment records, and sends writes to the approval prompt, which asks the customer. Threat markers: T1 on the customer's input, T6 on the loop, T9 on conversation state, T3 between the loop and the tool runner, T2, T7, and T4 between the tool runner and the carrier API, T5 on the approval flow, T8 at the logs, and T10 at dependencies and CI.](../../../assets/diagrams/security/shipment-agent-threat-model.svg)

</div>
<figcaption>The shipment agent's data flows, trust boundary, and threats T1 to T10. The table below is the full text version.</figcaption>
</figure>

**How to read the diagram.** The large outline is the trust boundary: everything inside it is code you wrote and control. Dashed boxes are outside your control, so anything that comes from them is untrusted. Each numbered circle sits on the flow where that threat enters, and matches a row in the table in Step 5. The approval prompt is the only place a person makes a decision, so it's drawn inside the boundary but connected back to the customer.

## Step 4: Walk the attack paths (Map)

For each flow that crosses the boundary, ask what an attacker could put on it and what that could make the agent do. The OWASP Top 10 for Agentic Applications (2026) works well as a checklist here: for each of its ten categories, either find the threats it describes in your system, or write down why it doesn't apply. The categories that turn up in the shipment assistant are:

- Agent Goal Hijack (ASI01): text in the customer's messages or the carrier's data redirects the agent.
- Tool Misuse and Exploitation (ASI02): the agent's real tools are used in harmful ways.
- Identity and Privilege Abuse (ASI03): the agent acts for someone other than the signed-in customer.
- Supply chain risk (ASI04): a compromised dependency or leaked credential.
- Memory and Context Poisoning (ASI06): planted text in conversation state affects later answers.
- Cascading Failures (ASI08): one fault, such as a failing carrier, spreads into wrong answers or wasted work.
- Human-Agent Trust Exploitation (ASI09): the customer approves something they didn't mean to.

Three categories don't apply today, and recording why matters as much as the threats that do:

- Unexpected Code Execution (ASI05): the agent has no tool that runs code.
- Insecure Inter-Agent Communication (ASI07): it's a single agent.
- Rogue Agents (ASI10): nothing yet monitors the deployed agent's behavior over time. That's a gap to close at deployment, and the "not applicable" note says so, so it doesn't get forgotten.

Not every threat maps to one category. T8, customer data in logs, is a privacy risk that NIST's Generative AI Profile (NIST AI 600-1, July 2024) lists as Data Privacy, and it has no ASI number in the threat register.

## Step 5: Record controls, tests, and residual risk (Measure and Manage)

Each threat gets a row: the controls that limit it, the test that shows the controls work, and the residual risk, which is what can still go wrong with every control in place. Tests are the evaluation cases from the Stage 4 suite, by ID, or a named review where no automated test makes sense.

| # | Threat | OWASP | Controls | Test | Residual risk |
| --- | --- | --- | --- | --- | --- |
| T1 | A customer asks the agent about, or for a booking on, someone else's package | ASI01, ASI03 | Customer ID from the session; ownership check in every handler; the same `not_found` for missing and not yours | `other-customers-status`, `other-customers-redelivery` | A customer can still misuse their own account |
| T2 | Instructions planted in carrier data steer the agent | ASI01 | Handler drops the free-text carrier note; system prompt labels tool results as data; approval shows values from records | `injected-carrier-note`, `injected-tool-result` | Planted text in a field the agent does pass on could still change what it says |
| T3 | Forged or malformed tool arguments reach a handler | ASI02 | Strict schemas; runner rejects unknown or wrong-typed arguments; format checks in handlers | `malformed-tracking-number` | A valid-looking argument for the customer's own package passes every check |
| T4 | The write tool books something the customer didn't ask for | ASI02 | No address or customer argument; 14-day date window; one write per question | `date-too-far-ahead` | A wrong but valid date inside the window can be booked if the customer approves it |
| T5 | An approval is given without informed consent | ASI09 | Prompt outside the conversation; exact values from records; anything but yes, or no answer, means no | `customer-declines` | A customer can type yes without reading |
| T6 | A runaway loop or retry storm burns cost and capacity | ASI08 | Step, time, and token limits per question; per-tool call limits; capped read retries with backoff | None yet | No limit across questions or customers yet |
| T7 | A carrier failure becomes an invented answer or a false booking | ASI08 | Classified tool errors; no automatic write retries; `write_outcome_unknown` reported as unknown | `carrier-down-status`, `carrier-down-booking` | The model's wording of a partial answer can still mislead |
| T8 | Customer data or secrets end up in logs | None (NIST Data Privacy) | Logger accepts only simple values; error class names logged, never messages; API key only in the environment | None yet | Conversation text is still sent to the model provider |
| T9 | Planted text in conversation state skews later answers, or one customer's conversation reaches another | ASI06 | State keyed by the session's customer ID; in memory only, trimmed to 10 turns | None yet | Planted text can persist within one customer's conversation for up to 10 turns |
| T10 | A compromised dependency or leaked API key | ASI04 | Lockfile with `npm ci`, or pinned pip installs; API key only in the CI job that calls the model; no secrets on fork pull requests | `review:dependency-update` | A malicious release of a pinned dependency is caught only by review |

The rows marked "None yet" are the most useful output of the exercise. T6, T8, and T9 have controls in the code but nothing that would notice if a change broke them. The next article adds those tests.

### Keep the threat model honest in CI

A threat model in a document drifts from the code. Store the register as data next to the code instead, for example as `threat-model.json` with one entry per row:

```json
{
  "id": "T1",
  "title": "A customer asks the agent about, or for a booking on, someone else's package",
  "owasp": ["ASI01", "ASI03"],
  "controls": ["customer ID comes from the session", "ownership check in every handler", "not_found for missing and not yours alike"],
  "tests": ["other-customers-status", "other-customers-redelivery"],
  "residual": "A customer can still misuse their own account.",
  "owner": "shipment-agent team"
}
```

Then check it on every pull request, against the IDs the evaluation suite actually has. The TypeScript version validates with Zod and the Python version with pydantic; both reject the same malformed files and report the same problems:

<div class="code-tabs">

```ts
import { z } from "zod";

const Threat = z
  .object({
    id: z.string().regex(/^T[0-9]+$/),
    title: z.string().min(1),
    owasp: z.array(z.string().regex(/^ASI(0[1-9]|10)$/)),
    controls: z.array(z.string().min(1)).min(1),
    tests: z.array(z.string().min(1)), // eval case IDs or named review checks
    residual: z.string().min(1),
    owner: z.string().min(1),
  })
  .strict();

const ThreatModel = z.array(Threat);

// Lists what's wrong with the threat model, so CI can fail when it drifts from the test suite.
export function checkThreatModel(raw: unknown, knownTests: ReadonlySet<string>): string[] {
  const parsed = ThreatModel.safeParse(raw);
  if (!parsed.success) return ["invalid threat model"];

  const problems: string[] = [];
  const seen = new Set<string>();
  for (const threat of parsed.data) {
    if (seen.has(threat.id)) problems.push(`${threat.id}: duplicate id`);
    seen.add(threat.id);
    if (threat.tests.length === 0) problems.push(`${threat.id}: no test`);
    for (const test of threat.tests) {
      if (!knownTests.has(test)) problems.push(`${threat.id}: unknown test ${test}`);
    }
  }
  return problems;
}
```

```python
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, TypeAdapter, ValidationError

NonEmpty = Annotated[str, StringConstraints(min_length=1)]


class Threat(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: Annotated[str, StringConstraints(pattern=r"^T[0-9]+$")]
    title: NonEmpty
    owasp: list[Annotated[str, StringConstraints(pattern=r"^ASI(0[1-9]|10)$")]]
    controls: Annotated[list[NonEmpty], Field(min_length=1)]
    tests: list[NonEmpty]  # eval case IDs or named review checks
    residual: NonEmpty
    owner: NonEmpty


THREAT_MODEL = TypeAdapter(list[Threat])


# Lists what's wrong with the threat model, so CI can fail when it drifts from the test suite.
def check_threat_model(raw: object, known_tests: frozenset[str]) -> list[str]:
    try:
        threats = THREAT_MODEL.validate_python(raw)
    except ValidationError:
        return ["invalid threat model"]

    problems: list[str] = []
    seen: set[str] = set()
    for threat in threats:
        if threat.id in seen:
            problems.append(f"{threat.id}: duplicate id")
        seen.add(threat.id)
        if not threat.tests:
            problems.append(f"{threat.id}: no test")
        for test in threat.tests:
            if test not in known_tests:
                problems.append(f"{threat.id}: unknown test {test}")
    return problems
```

</div>

Pass in the evaluation suite's case IDs plus the names of any review checks you run by hand. Run against the full ten-row register and the Stage 4 suite, the check reports the three gaps from the table:

```text
["T6: no test","T8: no test","T9: no test"]
```

A test that's renamed or deleted shows up the same way, as an unknown test, so the threat model and the suite can't quietly drift apart.

## Step 6: Decide about the residual risk (Manage)

Every row ends with risk that remains. For each one, someone with the authority to do so decides to reduce it further, accept it, or move it elsewhere, and writes the decision down with a date. For the shipment assistant:

- Reduce: add the missing tests for T6, T8, and T9, and a limit across questions for T6.
- Accept: a customer misusing their own account (T1), or approving without reading (T5). The approval prompt shows exact values, which is the most the application can do.
- Move: some of the risk in T8 sits with the model provider, which sees every conversation. The provider agreement and its data retention terms cover that part.

## Security implications

- Covering every OWASP category doesn't make a system secure. The list helps you find threats you might have missed; it doesn't prove there are no others. Threats specific to your business, such as booking abuse that looks like normal use, won't appear on any generic list.
- Controls are layers. In the shipment assistant, the system prompt, the strict schemas, the handler checks, and the approval prompt each limit a different part of an attack. No single one is relied on to stop it, and the handler checks hold even if the model is fully manipulated.
- A threat model is only as current as its last review. Tie reviews to the triggers in Step 1, and treat a "None yet" test as a defect to fix.
- The NIST AI RMF's Measure and Manage functions describe ongoing work. A threat model done once, before launch, covers only the system as it was that day.

## What to learn next

The threat register above has three threats with no test. The next article in this series, Evaluating Agent Security, adds adversarial cases to the Stage 4 evaluation suite for those gaps and for the attacks in the table, and keeps them running in CI.
