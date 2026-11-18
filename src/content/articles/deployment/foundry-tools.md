---
title: "Foundry Tools: Built-in Tools, MCP, OpenAPI, and Toolbox with Least Privilege"
description: The kinds of tools a Microsoft Foundry agent can call, where each one runs, whose identity it uses, and whether the service on the other end can tell which user is asking. How to pick the narrowest one for the shipment agent, with an MCP tool locked down in TypeScript and Python.
topic: Deployment
level: Intermediate
publishedAt: 2026-11-18
order: 9
stage: 8
stageOrder: 7
readingMinutes: 8
tags: [deployment, foundry, azure, tools, mcp, security, typescript, python]
featured: false
draft: false
---

Tools are how an agent acts, and on Microsoft Foundry there are several kinds. Some are built in and run inside Foundry. Some call an API or an MCP server you point them at. Some come back to your application to run. They differ in a way that matters more than features: whose identity the tool uses when it calls a service, and whether that service can tell which customer the agent is working for.

That question decides whether the ownership check from [Add Tools and Permissions](/learn/architecture/add-tools-and-permissions/) can survive the move to Foundry. This article goes through the tool kinds with that question in mind, then locks down an MCP tool for the shipment agent. It was checked against Microsoft Learn on 2026-11-18.

## The tool kinds

Learn's Toolbox page lists more than a dozen tool types. They fall into a few groups:

| Kind | Examples | Where the work happens | Identity used to reach the service |
| --- | --- | --- | --- |
| Built-in tools | Web search, file search, code interpreter, Foundry IQ, image generation | Inside Foundry or a Microsoft service | Foundry's, or a connection you configure |
| Function tools | Your own functions, described by a JSON schema | Your application, after the agent hands the call back | Your application's, with the signed-in user in hand |
| OpenAPI tools | Any HTTP API with an OpenAPI description | Your API, called by Foundry | One shared identity: anonymous, an API key, or the project's managed identity |
| MCP tools | Any MCP server | The MCP server, called by Foundry | Shared (a key or an Entra identity) or per-user (Entra user delegation or OAuth passthrough) |
| Agent-to-agent | Another agent, over the A2A protocol | The other agent | Configured per connection |
| Toolbox | A curated bundle of the above, behind one MCP endpoint | Wherever each bundled tool runs | Managed centrally by the toolbox |

Two details from Learn affect the shipment agent directly. OpenAPI tools support anonymous, API key, and project managed identity authentication, and Learn states they "don't support OAuth identity passthrough". So an OpenAPI tool always calls your API as the same identity, whoever the customer is. MCP tools support more: Learn's MCP authentication page separates "shared authentication", where "every user of the agent uses the same identity", from "individual authentication", where the tool reuses the user's Microsoft Entra context or asks each user to sign in to the provider.

## Why the identity matters for ownership

The shipment agent's rule is that a customer can only see and rebook their own packages, and the check uses the customer from the signed-in session, never an ID the model supplies. Now follow that rule through each tool kind:

- Function tools keep it as is. The call comes back to your application, which knows the signed-in customer and runs the Stage 4 runner. The [prompt agent tutorial](/learn/deployment/deploy-a-prompt-agent-to-foundry/) does exactly this.
- An OpenAPI tool loses it. Your API sees only the project's identity, so to know the customer, the agent would have to pass a customer ID as an argument. That ID comes from the model, which is exactly what the Stage 4 tutorials ruled out: a prompt-injected agent could ask about any customer's packages. An OpenAPI tool is fine for data that's the same for every user, like store opening hours, and wrong for per-customer data.
- An MCP tool with shared authentication loses it the same way. With Entra user delegation or OAuth identity passthrough, the server receives the user's own identity and can check ownership itself, if your customers sign in with an identity the MCP server trusts.
- A hosted agent keeps it, because its code calls your services directly, with the customer passed by the trusted caller as in the [hosted agent tutorial](/learn/deployment/deploy-a-hosted-agent-to-foundry/).

The general rule: if a tool's data or actions depend on who the user is, the service behind the tool must learn the user from a credential, never from the model's arguments.

## Lock down an MCP tool

Suppose the shipment tools run on your own MCP server, which receives each customer's identity by user delegation and checks ownership itself. Attaching it to a prompt agent still has three settings worth getting right:

<div class="code-tabs">

```ts
// foundry/mcp-tool.ts
import type { MCPTool } from "@azure/ai-projects";

// The shipment tools served by your own MCP server, attached to a prompt agent with the narrowest settings.
export const shipmentMcpTool: MCPTool = {
  type: "mcp",
  server_label: "shipments",
  server_url: "https://shipments.example.com/mcp", // your server, behind your gateway
  project_connection_id: "shipments-mcp", // the connection holds the credentials, never the agent definition
  // Only these tools are exposed to the model. An empty list would allow every tool on the server.
  allowed_tools: ["get_shipment_status", "list_my_shipments", "request_redelivery"],
  // Reads run without a pause. A booking waits for an approval your application collects.
  require_approval: {
    never: { tool_names: ["get_shipment_status", "list_my_shipments"] },
    always: { tool_names: ["request_redelivery"] },
  },
};
```

```python
# foundry/mcp_tool.py
from azure.ai.projects.models import MCPTool, MCPToolFilter, MCPToolRequireApproval

# The shipment tools served by your own MCP server, attached to a prompt agent with the narrowest settings.
SHIPMENT_MCP_TOOL = MCPTool(
    server_label="shipments",
    server_url="https://shipments.example.com/mcp",  # your server, behind your gateway
    project_connection_id="shipments-mcp",  # the connection holds the credentials, never the agent definition
    # Only these tools are exposed to the model. An empty list would allow every tool on the server.
    allowed_tools=["get_shipment_status", "list_my_shipments", "request_redelivery"],
    # Reads run without a pause. A booking waits for an approval your application collects.
    require_approval=MCPToolRequireApproval(
        never=MCPToolFilter(tool_names=["get_shipment_status", "list_my_shipments"]),
        always=MCPToolFilter(tool_names=["request_redelivery"]),
    ),
)
```

</div>

`allowed_tools` names the tools the model may see. Learn's MCP page has a warning worth repeating: "An empty list (`[]`) allows all tools exposed by the MCP server, not zero tools." List the tools by name, so a tool added to the server later doesn't appear in your agent until you add it here.

`require_approval` decides which calls pause for a person. Reads run straight through; `request_redelivery` always waits. When it waits, the response contains an approval request naming the tool and its arguments, and your application shows it to the customer and sends back an approval response in the same conversation. Learn's advice is to review the requested tool name and arguments before approving, and to log approvals and tool calls.

`project_connection_id` names a project connection that holds the server's credentials, so no key appears in the agent definition, the code, or the conversation. Learn notes that Foundry caches connection credentials, for two minutes by default on 2026-11-18, so a rotated key may take that long to take effect.

Both versions produce the same tool definition; serialized with sorted keys, they print identical JSON. The server URL and connection name are placeholders for your own.

## Choosing for the shipment agent

| Need | Narrowest tool | Why |
| --- | --- | --- |
| Status and bookings for the signed-in customer | Function tools, a hosted agent, or MCP with user delegation | The service must learn the customer from a credential |
| Store opening hours, delivery areas | OpenAPI tool, anonymous or project identity | Same answer for everyone |
| Answers from help-center articles | Foundry IQ or file search | Retrieval over shared content; see the next article |
| Searching the web | Leave it off | The shipment assistant doesn't need it, and web content is untrusted input |

Every tool you attach widens what a successful prompt injection can reach. The shipment assistant needs three tools, so it should have three.

## Govern tools across agents

Two Foundry features help when many agents share tools.

A Toolbox curates a set of tools once and exposes them through one MCP endpoint. Learn describes it as handling "credential injection, token refresh, and policy enforcement at runtime for all tools in the bundle." Learn also notes that toolboxes are governed by your organization but don't remove your responsibility for which tools you include.

A gateway can sit in front of MCP traffic. Learn's governance page describes routing MCP tools through the new AI Gateway or Azure API Management, with policies for rate limits, IP filtering, and logging. It carries a recent change: Foundry no longer registers an MCP server with the gateway automatically. You configure the route in the gateway and enter the gateway's URL in Foundry yourself.

Foundry governance can also enforce which tools are approved for use across projects, as [What Is Microsoft Foundry?](/learn/deployment/what-is-microsoft-foundry/) describes. Learn's governance overview notes that assigning a tool policy doesn't configure the runtime controls in each project by itself.

## Security implications

- Tool output is untrusted input. Learn's tool best practices say to treat tool outputs as untrusted and validate critical values before acting on them. For MCP, Learn adds that tool descriptions, annotations, and results "can contain indirect prompt injection instructions". That's the attack path from [Prompt Injection in Agent Systems](/learn/security/prompt-injection-in-agent-systems/).
- Third-party MCP servers are a trust decision. Learn states that Microsoft doesn't test or verify third-party MCP servers, that data you send goes to the provider under its own terms, and that you should prefer servers hosted by the service provider itself over proxies. Review a server's tool descriptions before connecting, and again whenever its operator or tools change.
- Least privilege applies to tools first. OWASP's Top 10 for Agentic Applications (2026) lists Tool Misuse (ASI02): an agent using legitimate tools in harmful ways. The defenses are the ones above: few tools, an explicit allow-list, approvals for side effects, and user-scoped credentials for user-scoped data.
- MCP has its own security guidance. The MCP specification's security best practices cover risks such as servers that pass tokens through to other services and servers that use a static client identity on behalf of many users. They're worth reading before you run your own MCP server for agents.
- Credentials live in connections. Keep keys in project connections, never in instructions, tool descriptions, or code, and rotate them. Learn's best practices also say not to log secrets in traces.

## What to learn next

Retrieval is a tool too, with its own risks. The next article, Foundry IQ, covers knowledge bases and agentic retrieval over your own content, and how to keep poisoned documents from steering the agent.
