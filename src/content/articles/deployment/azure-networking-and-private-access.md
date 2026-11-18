---
title: "Azure Networking and Private Access: Taking the Agent Off the Public Internet"
description: Public, restricted, and private network topologies for the shipment agent on Azure, how to make a Foundry agent or a Container Apps app private, which private DNS zones you need, and what breaks when you do. Private networking reduces exposure; it doesn't make a compromised agent safe.
topic: Deployment
level: Advanced
publishedAt: 2026-11-18
order: 14
stage: 8
stageOrder: 12
readingMinutes: 9
tags: [deployment, foundry, azure, networking, private-link, container-apps, security]
featured: false
draft: false
---

By default, the services behind an Azure agent have public endpoints. The Foundry resource, the model deployment, storage, and search are all reachable from the internet, protected by authentication. For many organizations that's not enough. They want the agent, its model, and its data reachable only from their own network, and the agent's outbound traffic limited to destinations they approve.

This article covers the choice of topology, what a private setup looks like for a Foundry agent and for Container Apps, the DNS that makes it work, and the things that tend to break. It was checked against Microsoft Learn on 2026-11-18. It assumes you've chosen a hosting option ([Choose an Azure Agent Hosting Option](/learn/deployment/choose-an-azure-agent-hosting-option/)) and set up identities ([Configure Azure Agent Identity, RBAC, and Secrets](/learn/deployment/configure-azure-agent-identity-rbac-and-secrets/)). Networking adds a layer on top of identity. It doesn't replace it.

## Three topologies

| Topology | Inbound | Outbound | Good for |
| --- | --- | --- | --- |
| Public | Public endpoints, authenticated with Entra ID | Unrestricted | Prototypes, low-sensitivity agents |
| Restricted public | Public endpoints, accepting only selected IP ranges | Unrestricted, or through a firewall | Small teams with fixed office or gateway IPs |
| Private | Private endpoints only; public network access disabled | Through your virtual network and firewall, to approved destinations only | Customer data, regulated workloads |

Learn describes the inbound setting for Foundry as the "public network access" flag: Enabled, Disabled (private endpoints only), or enabled from selected IP addresses. Outbound is a separate question, which is easy to forget. A private inbound setup doesn't stop the agent from sending data to the internet.

## Private Foundry: Standard Setup with private networking

For prompt and hosted agents, Learn's networking guide describes a "Standard Setup with private networking". It has two halves:

- Inbound: the Foundry resource and its connected services get private endpoints in your virtual network, with public network access disabled.
- Outbound: Foundry injects the agent client into a subnet you delegate to it, so agent traffic to your resources stays inside your network. Hosted agents can also use your virtual network for outbound traffic.

The standard setup requires you to bring your own Azure Storage, Foundry IQ, and Azure Cosmos DB, so all agent data, including files, conversations, and vectors, stays in resources in your tenant. Learn notes that private endpoints for those three are not created automatically: you create them in each resource.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Network diagram of Foundry Standard Setup with private networking. Scrolls horizontally on small screens.">

![Your virtual network contains an agent subnet, delegated to Microsoft.App/environments and /27 or larger, holding the agent client injected by Foundry and hosted-agent sessions whose outbound traffic uses this subnet. A private endpoint subnet holds private endpoints for Foundry, Foundry IQ, Storage, Cosmos DB, the container registry, and Key Vault, the last two when you use them. Private DNS zones linked to the network resolve each service name to its private endpoint. Your application sits in the network, or reaches it through peering, VPN, or ExpressRoute. Outside your network, the Foundry resource and project, Foundry IQ, Storage, and Cosmos DB all have public network access disabled, so requests from the internet are rejected. Outbound traffic from the agent subnet goes to your firewall, which allows only approved destinations plus the Entra sign-in endpoints.](../../../assets/diagrams/deployment/foundry-private-network.svg)

</div>
<figcaption>Foundry with private networking: private endpoints for inbound, a delegated subnet for the agent's outbound traffic.</figcaption>
</figure>

**How to read the diagram.** The green outline is your network. Everything the agent uses has a private endpoint inside it, and the services themselves (dashed, outside) accept no public traffic. Follow the arrows: your application reaches the services through the private endpoints, and the agent's outbound traffic leaves through your firewall, never directly.

Learn's requirements for the agent subnet, on 2026-11-18:

- Delegated to `Microsoft.App/environments`, dedicated to one Foundry resource, and `/27` or larger. Learn suggests `/24` or larger as a production starting point, sized from the planned number of hosted-agent sessions.
- Private address space only (RFC 1918, or parts of RFC 6598), with no overlap with your other networks or with ranges Azure reserves.
- Avoid putting private endpoints in `192.168.0.0/24`, which Learn says overlaps an internal hosted-agent sandbox network and causes "No route to host" errors.
- If a firewall filters outbound traffic, allow the Microsoft Entra sign-in endpoints Learn lists (or the `AzureActiveDirectory` service tag), and don't use TLS inspection that substitutes its own certificate.

For hosted agents, Learn also notes that a private container registry is supported only for Foundry projects created after June 25, 2026. Older projects need the registry reachable over its public endpoint.

## Private Container Apps: an internal environment

For the shipment agent on Azure Container Apps, the equivalent is an internal environment. Learn's Container Apps networking page describes two accessibility levels: external, with a public virtual IP, and internal, which has "no public endpoints" and uses an internal load balancer address from your virtual network. The default environment type (workload profiles) needs a dedicated subnet of `/27` or larger, and supports user-defined routes and egress through a NAT gateway or firewall.

<figure class="diagram">
<div class="diagram-frame" tabindex="0" role="region" aria-label="Network diagram of the shipment agent in an internal Container Apps environment. Scrolls horizontally on small screens.">

![Customers on the public internet reach an optional Application Gateway with a web application firewall in a front-end subnet of your virtual network. It forwards to the shipment agent app in a Container Apps subnet, an internal environment of /27 or larger with no public endpoint, where the app has an internal load balancer IP, a managed identity, and authentication on ingress. The app reaches a private endpoint subnet with private endpoints for Foundry (Claude), Key Vault, and the container registry. Private DNS zones linked to the network resolve the environment domain and each service to private addresses. Outbound traffic from the app goes through your firewall or NAT gateway by a user-defined route, which allows only approved destinations, such as the carrier API.](../../../assets/diagrams/deployment/container-apps-internal-network.svg)

</div>
<figcaption>The shipment agent in an internal Container Apps environment, with one controlled public entry point.</figcaption>
</figure>

**How to read the diagram.** Customers still need to reach the assistant, so one entry point stays public: an Application Gateway in front of the internal environment, where you can add a web application firewall. Everything behind it is private. The app reaches Claude, Key Vault, and its registry through private endpoints, and its only route to the internet goes through your firewall.

Even with an internal environment, keep authentication on the app's ingress. The network decides who can connect, and authentication decides who the caller is. The shipment agent needs both, because the customer's identity is what the ownership checks use.

## DNS

Private endpoints only work if names resolve to private addresses inside your network. Clients keep using the same URLs: Learn explains that Azure points the public name at a `privatelink` subdomain, which resolves to the private endpoint inside your network and to the public endpoint outside it. You need a private DNS zone for each service, linked to the virtual network:

| Service | Private DNS zone | Used by |
| --- | --- | --- |
| Foundry resource (account) | `privatelink.cognitiveservices.azure.com` | Foundry options |
| Foundry resource (account) | `privatelink.openai.azure.com` | Foundry options, OpenAI-compatible endpoints |
| Foundry resource (account) | `privatelink.services.ai.azure.com` | Foundry options, Container Apps calling Claude |
| Foundry IQ | `privatelink.search.windows.net` | Standard setup |
| Azure Cosmos DB | `privatelink.documents.azure.com` | Standard setup |
| Azure Storage (blob) | `privatelink.blob.core.windows.net` | Standard setup |
| Container registry | `privatelink.azurecr.io` | Hosted agents, Container Apps |
| Key Vault | `privatelink.vaultcore.azure.net` | Container Apps, connections |
| Container Apps environment | `privatelink.{region}.azurecontainerapps.io` | Container Apps |

The first six come from Learn's Foundry agent networking guide, and the last three from Azure's general private endpoint DNS reference. If you use your own DNS servers, Learn says to forward these zones to Azure DNS at `168.63.129.16`. When something can't connect, the first check from Learn's troubleshooting section is `nslookup <endpoint name>` from inside the network: if it returns a public address, the private zone is missing or not linked.

## What breaks

Going private changes how people and services reach things. On 2026-11-18, Learn noted these effects, among others:

- The portal. With public access disabled, you reach the Foundry portal's project features only from a connected network: inside the virtual network, or through VPN or ExpressRoute.
- Foundry IQ's own connections. As [Foundry IQ](/learn/deployment/foundry-iq/) describes, a private path from the agent to Foundry IQ doesn't make Foundry IQ's connections to its sources and models private. Each needs its own setup.
- Some integrations need public access. Learn's limitations list includes Fabric resources, which must keep public network access enabled. Publishing to Teams and Microsoft 365 from a private resource needs extra setup.
- Firewalls. A firewall that blocks Microsoft Entra endpoints, or inspects TLS with its own certificate, makes provisioning and runtime calls fail.
- Address overlaps. Overlapping ranges, or private endpoints in `192.168.0.0/24` used with hosted agents, fail in ways that look like DNS problems.

## Security implications

- Private networking reduces exposure. It doesn't contain a compromised agent. If a prompt injection steers the agent, it can still use every tool and data source it can reach over the private network, with every permission its identity holds. That's why identity and the tool-side checks come first, and networking adds a layer.
- Outbound control matters as much as inbound. An injected agent that can make arbitrary outbound requests can send data anywhere. An egress allow-list through your firewall, and Foundry's hosted-agent egress policies, limit where data can go. Only the carrier API and the Azure services the agent needs should be on the shipment agent's list.
- Keep one controlled entry point. For a customer-facing agent, something has to be public. Put a web application firewall there, keep authentication on, and keep everything behind it private.
- Each resource has its own network settings. Learn repeats this across the Foundry pages: connected resources such as Storage, Key Vault, and Foundry IQ are separate Azure resources, and locking down one doesn't lock down the others. Check each one's public network access as part of the release checklist from [Deploying an Agent](/learn/deployment/deploying-an-agent/).

## What to learn next

With the agent private and running, the next article, Monitor, Version, and Roll Back an Azure Agent, covers connecting Application Insights, releasing a new version to a small share of traffic, and moving traffic back when something goes wrong.
