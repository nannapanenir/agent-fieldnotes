---
title: "Monitoring and Incident Response: When the Agent Misbehaves"
description: Detect an agent that's misbehaving, contain it quickly, investigate from traces and logs, and turn what you learn into tests and alerts. Alert rules for tool misuse, cost, and permission denials, a numbered incident runbook, and the containment options from least to most disruptive.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-18
order: 16
stage: 8
stageOrder: 14
readingMinutes: 8
tags: [deployment, monitoring, incident-response, security, foundry]
featured: false
draft: false
---

Every control in this site's earlier articles reduces the chance or the damage of something going wrong. None of them makes it impossible. A prompt injection gets past a filter, a release changes how the model uses a tool, a dependency misbehaves, or a customer finds a way to make the agent spend money. When that happens, what matters is how quickly you notice, how quickly you can stop it, and whether you learn enough to stop it happening again.

This article is about that day. It works for any platform, with Azure examples from [Monitor, Version, and Roll Back an Azure Agent](/learn/deployment/monitor-version-and-roll-back-an-azure-agent/) where they help. It assumes the logs and alerts from [Reliability, Cost, and Runaway Loops](/learn/deployment/reliability-cost-and-runaway-loops/) and the kill switch from [Deploying an Agent](/learn/deployment/deploying-an-agent/).

## What counts as an incident

An agent incident is any time the agent does, or could have done, something it shouldn't: a booking nobody approved, an answer that reveals another customer's data, a burst of tool calls nobody asked for, spending far beyond the budget, or the agent following instructions planted in a document. Some of these are security incidents and some are reliability incidents, and the response is the same: contain first, then understand.

The OWASP Top 10 for Agentic Applications (2026) names the worst case Rogue Agents (ASI10): an agent acting outside its intended purpose, whether because it was compromised or because it drifted. Incident response is how you limit how long a rogue agent keeps acting.

## Alerts that catch agent problems

Generic service alerts (error rates, latency) still apply. Agents need three more kinds, built on the events your code already logs:

| Alert | Signal | Example rule to start from |
| --- | --- | --- |
| Anomalous tool use | `tool_call` events per tool, per question, per customer | A tool called far more often than its usual rate, a write tool called without a matching approval, or any tool the agent shouldn't have |
| Cost spikes | Spend per question and per hour, `budget_breach` events | Spend per hour above a set amount for the whole service, or budget breaches above their normal rate |
| Permission denials | `not_found` and `denied` tool results, 401 and 403 responses from services | Several denials for one customer in a few minutes, or a rise in denials after a release |

Three practical points make these alerts useful rather than noisy. Compare against a baseline, because a fixed threshold that's right at launch is wrong a month later. Alert on the combination that matters, such as a write without a recorded approval, which should never happen at all and is worth a page on its own. And give every alert an owner who knows what the runbook below says to do.

Permission denials deserve special attention. The ownership check in the shipment agent's tools returns `not_found` for someone else's package. A customer who asks about one wrong tracking number makes a single denial. A run of denials for different tracking numbers from one conversation is what probing looks like from the inside, and the controls held. Alerting on it lets you find the attempt before it finds a gap.

## The incident lifecycle

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Flowchart of the incident lifecycle and containment options. Scrolls horizontally on small screens.">

![Flowchart. 1, detect: an alert fires, or a report comes in. 2, triage: the owner sets the severity. 3, contain, from least to most disruptive: a, read_only, where answers still work but no actions run; b, disable or off, where the endpoint rejects all requests; c, revoke access, removing roles and rotating keys; d, roll back to the previous version and configuration. 4, investigate, using traces, logs, and approvals. 5, recover, with a fix that goes through the release gates. 6, follow up: a threat register row, an evaluation case, and an alert rule if one was missing. A dashed arrow from follow-up back to detect shows lessons feeding back into detection.](../../../assets/diagrams/deployment/incident-lifecycle.svg)

</div>
<figcaption>The six phases of an agent incident. Containment comes before investigation.</figcaption>
</figure>

**How to read the diagram.** Follow the numbers. The wide box in the middle is containment, with four options ordered from least to most disruptive, so you can pick the smallest one that stops the harm. The dashed arrow at the left closes the loop: each incident should leave behind a test and an alert that catch it next time.

## The runbook

Write the runbook before you need it, keep it where the on-call owner can find it, and practice it. For the shipment agent on Azure, it looks like this:

1. Acknowledge the alert and open an incident record with the time, the alert, and who's handling it. Everything after this goes into that record.
2. Decide the severity. Ask: is the agent taking actions it shouldn't (bookings), exposing data, or only answering badly? Is it still happening? How many customers?
3. Contain, starting with the smallest step that stops the harm:
   - If the problem involves actions, set the kill switch to `read_only`. Status answers keep working and every booking returns `writes_paused`.
   - If the agent itself is the problem, turn it off: set the kill switch to `off`, or disable the Foundry agent with the `:disable` call from the rollout article, which takes its endpoint offline without deleting anything.
   - If a credential or identity may be compromised, revoke it: remove the role assignment from the agent or app identity, and rotate any key in its project connection. Learn notes Foundry caches connection credentials, for two minutes by default on 2026-11-18, so rotation takes effect shortly after.
   - If a release caused it, roll back to the previous version, as the rollout article describes, and check that new sessions get the old version.
4. Preserve evidence before anything expires: export the relevant traces, logs, approval records, and the agent version and configuration that was running. Keep this export under the same access controls as the traces themselves.
5. Investigate. Find the first bad run and work outward:
   - From traces: which tool calls ran, with what arguments, and what the tools returned. Look for injected text in tool results or retrieved documents.
   - From logs: which customers and questions were affected, using the event names and IDs your logs keep.
   - From approval records: whether any write ran without one, which would mean a control failed rather than only the model.
6. Assess impact: which customers saw wrong data or had actions taken, and whether any personal data reached someone it shouldn't have. Involve your privacy and legal contacts if it did.
7. Fix the cause, and send the fix through the normal release gates. An incident is not a reason to skip them.
8. Recover: re-enable the agent, or return the kill switch to `on`, and watch the alerts closely for the next day.
9. Tell the people who need to know: affected customers, as your policies and the law require, and your own teams.
10. Follow up within a few days, with the people involved, and record the actions in the next section.

## Feed it back

The NIST AI Risk Management Framework puts incident response under its Manage function, and expects what you learn to change how you map and measure risk. For an agent, that means three concrete changes after every incident:

- A row in the threat register. Add the attack path, or update the existing row's controls and residual risk, in the register from [Threat Modeling an Agent](/learn/security/threat-modeling-an-agent/). If the register's checker reports the new row has no test, that's the next item.
- A case in the evaluation suite. Turn the incident into a deterministic case, as in [Evaluating Agent Security](/learn/security/evaluating-agent-security/), so the release gate fails if the same thing could happen again.
- An alert, if one was missing. If the incident was found by a customer instead of an alert, add the rule that would have caught it.

Track the time from first bad run to detection, and from detection to containment. Those two numbers show whether your monitoring and your runbook are improving.

## Security implications

- Contain before you investigate. A rogue agent keeps acting while you read traces. The kill switch exists so containment takes seconds and doesn't depend on understanding the cause.
- Practice the runbook. A disable command nobody has run, a role nobody knows how to remove, or a rollback that fails because the old version was deleted all turn a short incident into a long one. Rehearse them in staging, as you would a fire drill.
- Evidence is sensitive data too. Exported traces contain customer conversations and tool results. Store them with restricted access and a retention period, and include them in your data handling records.
- Watch for rogue behavior, not just failures. OWASP's ASI10 covers agents that keep working while doing the wrong thing. That's why the alerts above look at what the agent does (tool use, writes without approvals, spend) as well as whether it errors.

## What to learn next

This is the last article in the Microsoft Foundry track, and the end of the current learning path. The best next step is practical: deploy the shipment agent with one of the three hosting options, run its evaluation and security suites against the deployed version, and rehearse this runbook once before real customers depend on it. The roadmap will add new articles as the platforms and the threats change.
