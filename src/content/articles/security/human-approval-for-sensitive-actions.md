---
title: "Human Approval for Sensitive Actions: Approvals People Don't Just Click Through"
description: Which agent actions need a person's approval, what the approver must see, how to enforce approvals in code, and how to handle timeouts, rejections, and approval fatigue.
topic: Security
level: Intermediate
publishedAt: 2026-11-14
order: 8
readingMinutes: 9
tags: [security, human-in-the-loop, approvals, owasp, nist]
featured: false
draft: false
---

An approval step puts a person between an agent's proposal and an action that's costly or hard to undo. Done well, it catches the mistakes and manipulations that slip past every other control. Done badly, it trains people to click "Approve" on whatever appears, which can be worse than no step at all, because everyone believes the action was checked.

This article covers which of the shipment assistant's actions need approval, what the approver has to see, how the application enforces the decision, and how to keep approvals meaningful over time. It builds on [Tool Permissions and Excessive Agency](/learn/security/tool-permissions-and-excessive-agency/) and [Prompt Injection in Agent Systems](/learn/security/prompt-injection-in-agent-systems/).

## Which actions need approval

Approval costs the approver's attention, so spend it where a mistake matters. Three questions sort most actions:

- Impact: how much money, data, or trust is at stake if this goes wrong?
- Reversibility: can it be undone cheaply, and how quickly?
- Visibility: does it reach other people, such as a message sent or a change to a shared record?

Applied to the shipment assistant:

| Action | Impact | Reversible? | Approval |
| --- | --- | --- | --- |
| Look up a shipment's status | Low | Nothing to undo | None |
| Send a fixed-template email to the customer's own address | Low | No, but harmless | None |
| Redeliver the customer's own package | Medium: a wasted trip, a missed delivery | Usually, before dispatch | The customer confirms |
| Change the delivery address on an order | High: a package can go to the wrong person | Hard once shipped | The customer confirms after signing in again |
| Refund above a set amount | High: money leaves | Hard | A staff member approves, and the agent can't |
| Close an account or delete data | Very high | No | Not an agent action; link to a staff process |

Two rules come out of this. Read-only and low-impact actions shouldn't ask, because every unnecessary prompt teaches people to approve without reading. And the approver has to be someone with the authority to decide: the customer for their own redelivery, a staff member for company money.

## What the approver must see

An approval is only as good as the information behind it. "The assistant wants to perform an action. Approve?" asks the approver to trust the agent without giving them anything to judge. Show the exact action, with every detail that matters, taken from your own systems rather than from the model's description of it.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Illustrative mockup of an approval card. Scrolls horizontally on small screens.">

![Illustrative mockup of an approval card titled "Approve this redelivery?". It lists the package tracking number, the new delivery date, Saturday, November 14, and the delivery address on file, 14 Linden Ave, each read from the company's systems. A separate, labeled section shows the assistant's note, marked as written by the assistant and not verified. Below are Approve and Reject buttons, and a line saying the request expires in 15 minutes and nothing happens if it expires.](../../../assets/diagrams/security/approval-card-mockup.svg)

</div>
<figcaption>Illustrative mockup: the facts come from your systems, and the assistant's own words are labeled as such.</figcaption>
</figure>

**How to read the diagram.** This is an illustrative mockup, not a real product screen. The top section lists the facts the decision depends on, read from the shipment and account systems. The assistant's note sits in its own labeled box, because it's model output and could carry injected text. The bottom line states what happens if nobody answers.

A few details make the difference:

- Show the specific values: the amount, the address, the date, the recipient. If something is changing, show the old and new values side by side.
- Read those values from your systems of record. If the card displays the model's summary, an injection can make the summary say something reassuring while the arguments say something else.
- Label anything the model wrote, such as its reason for the request, as model-generated and unverified.
- Say what happens on reject and on timeout, so declining feels safe.

## Enforce the decision in code

An approval that lives only in the conversation isn't enforced. If the model asks "Shall I go ahead?" and the customer types "yes," the model decides what that "yes" means, and injected text can supply a fake "yes" or a fake question. The approval has to be a separate control, such as a button the application handles, that the model can't press.

The application should also bind each approval to one exact action. If the model changes any argument after the approval, such as a different date, the approval no longer applies:

```ts
type ProposedAction = { tool: string; args: Record<string, string | number> };

type Approval = {
  id: string;
  customerId: string;
  actionHash: string;
  expiresAt: number;
  decision: "pending" | "approved" | "rejected";
};

type ApprovalCheck = "ok" | "missing" | "pending" | "rejected" | "expired" | "mismatch" | "already_used";

declare function sha256Hex(text: string): string;
declare function randomId(): string;
declare const approvals: {
  insert(approval: Approval): Promise<void>;
  get(id: string): Promise<Approval | null>;
  markUsed(id: string, at: number): Promise<boolean>; // atomic: true only the first time
};

const APPROVAL_TTL_MS = 15 * 60_000;

// Same tool and same arguments always produce the same string, whatever the key order.
function canonical(action: ProposedAction): string {
  const keys = Object.keys(action.args).sort();
  return JSON.stringify([action.tool, keys.map((key) => [key, action.args[key]])]);
}

export async function requestApproval(action: ProposedAction, customerId: string, now = Date.now()): Promise<Approval> {
  const approval: Approval = {
    id: randomId(),
    customerId,
    actionHash: sha256Hex(canonical(action)),
    expiresAt: now + APPROVAL_TTL_MS,
    decision: "pending",
  };
  await approvals.insert(approval);
  return approval; // the approval UI records the decision; the model has no tool for it
}

export async function checkApproval(
  approvalId: string,
  action: ProposedAction,
  customerId: string,
  now = Date.now(),
): Promise<ApprovalCheck> {
  const approval = await approvals.get(approvalId);
  if (!approval || approval.customerId !== customerId) return "missing";
  if (approval.decision !== "approved") return approval.decision;
  if (now > approval.expiresAt) return "expired";
  if (approval.actionHash !== sha256Hex(canonical(action))) return "mismatch";
  return (await approvals.markUsed(approval.id, now)) ? "ok" : "already_used";
}
```

The tool gateway calls `checkApproval` immediately before running the tool, and runs it only on `"ok"`. Each approval works once, for one customer, for one exact set of arguments, within 15 minutes.

## The approval lifecycle

Every approval ends in exactly one state, and only one of those states runs the action.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="State diagram of the approval lifecycle. Scrolls horizontally on small screens.">

![State diagram. A proposed action, which the model asked to run and the application's policy says needs approval, becomes pending. While pending, the approver sees the exact action and a timer runs; this is the human checkpoint. From pending, an action is approved, rejected, or timed out. Approved means a token is bound to this exact action for one use; it then becomes executed, where code checks the token and runs the tool. Rejected means nothing runs and the model is told the action was declined. Timed out means nobody answered in time and nothing runs. Only the executed state runs the action.](../../../assets/diagrams/security/approval-lifecycle.svg)

</div>
<figcaption>Only one path runs the action. Every other ending is safe by default.</figcaption>
</figure>

**How to read the diagram.** Read from left to right along the top row for the one path that runs the action. The boxes below Pending are the other two endings, and both run nothing. The thick outline marks the human checkpoint, and the green outlines mark states the application enforces.

Handle the endings this way:

- Rejected: run nothing, and return a tool result that says the customer declined. The model can explain and offer alternatives, but it shouldn't propose the same action again in the same turn. Limit repeated proposals so a manipulated model can't wear the customer down.
- Timed out: run nothing. Silence is never consent. Let the customer start again if they still want the action.
- Changed: if the model proposes a modified action, it's a new action with a new approval. The old one doesn't carry over.
- Failed after approval: if the tool itself fails, report the failure. Retry only if the tool is idempotent and the approval is still valid, and never past its expiry.

## Keep approvals meaningful

NIST AI 600-1, the Generative AI Profile, includes Human-AI Configuration among its risks, which covers automation bias: people's tendency to over-trust an automated system's suggestions. Approval steps are where automation bias does the most damage. A few practices push back against it:

- Ask rarely. Reserve approval for the actions in the top rows of your table, so each prompt is unusual enough to read.
- Put the risky detail first. For an address change, the new address is the headline, in large type.
- Add friction in proportion to risk. A redelivery takes one tap. A large refund might require typing the amount or a second approver.
- Don't batch unrelated actions into one approval. "Approve all 7 changes" hides the one that matters.
- Watch the numbers. If an approver has approved hundreds of requests in a row in a few seconds each, the step has become a formality, and it's time to automate the safe cases or redesign the prompt.

## Security implications

The OWASP Top 10 for Agentic Applications (2026) lists Human-Agent Trust Exploitation as ASI09: a compromised or manipulated agent uses people's trust in it to get a harmful action approved, for example with a confident, plausible explanation. That's why the card separates verified facts from the assistant's note, and why the facts come from your systems instead of the model.

An approval step reduces risk only under three conditions: the application enforces it, the approver sees accurate details, and approvals are rare enough to get real attention. It doesn't replace the other layers. Scoped tools, server-side authorization, and limits still need to hold when someone approves the wrong thing. Test it the way an attacker would: change an argument after approval, replay an approval, let one expire, and confirm none of them runs.

## Checklist

1. Each write action is classified by impact, reversibility, and visibility, and only the high-impact ones ask for approval.
2. The approver has the authority to decide: the customer for their own changes, staff for company money.
3. The approval shows exact values from your systems of record, with old and new values for changes.
4. Model-written text on the approval is labeled as unverified.
5. Approvals are recorded by the application, never inferred from chat text.
6. Each approval is bound to one exact action, one customer, one use, and an expiry.
7. Rejection and timeout run nothing, and repeated proposals are limited.
8. Approval rates and times are monitored for rubber-stamping.

For the terms used here, see the [Agentic AI Glossary](/learn/foundations/agentic-ai-glossary/#approval-gate).

## What to learn next

This completes the security stage. The next stage builds the shipment assistant in code, starting with a minimal agent in TypeScript with one read-only tool and a bounded loop, and adding the permissions and approvals from this stage step by step.
