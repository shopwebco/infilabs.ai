import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface ScopedFacts {
  account: { name: string | null; plan: Plan };
  // Every field below is derived from a real DB row — never a constant (Rule 1, invariant 6).
  integrations: { provider: string; status: string }[];
  recentActions: { kind: string; summary: string; createdAt: string }[];
}

export interface ScopedContext {
  systemPrompt: string;
  facts: ScopedFacts;
}

/**
 * Builds the agent's context from ONLY the data this user is permitted to see,
 * read straight from the database. It never fabricates marketplace metrics — if
 * no integration is connected, the facts reflect that and the system prompt
 * instructs the agent to say what's missing rather than invent numbers.
 *
 * Self-serve scope: the requesting user's own account + their own integrations
 * and agent-action history. (Agency/client scoping arrives in later phases.)
 */
export async function buildScopedContext(user: {
  id: string;
  name: string | null;
  plan: Plan;
}): Promise<ScopedContext> {
  const [integrations, recentActions] = await Promise.all([
    prisma.marketplaceIntegration.findMany({
      where: { userId: user.id },
      select: { provider: true, status: true },
      orderBy: { provider: "asc" },
    }),
    prisma.agentAction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { kind: true, summary: true, createdAt: true },
    }),
  ]);

  const facts: ScopedFacts = {
    account: { name: user.name, plan: user.plan },
    integrations: integrations.map((i) => ({ provider: i.provider, status: i.status })),
    recentActions: recentActions.map((a) => ({
      kind: a.kind,
      summary: a.summary,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  return { systemPrompt: renderSystemPrompt(facts), facts };
}

/** Renders the system prompt from facts only. The anti-fabrication rule is the guardrail. */
export function renderSystemPrompt(facts: ScopedFacts): string {
  const connected = facts.integrations.filter((i) => i.status === "CONNECTED");

  const integrationsBlock =
    connected.length === 0
      ? "No marketplace account is connected. You therefore have NO sales, order, inventory, advertising, or fee data for this account."
      : `Connected marketplace integrations:\n${connected
          .map((i) => `- ${i.provider} (status: ${i.status})`)
          .join("\n")}`;

  const actionsBlock =
    facts.recentActions.length === 0
      ? "No prior agent actions are recorded for this account."
      : `Recent agent actions (most recent first):\n${facts.recentActions
          .map((a) => `- [${a.createdAt}] ${a.kind}: ${a.summary}`)
          .join("\n")}`;

  return [
    "You are Xenon, an AI assistant for a marketplace seller.",
    "",
    "ACCOUNT (the only data you have access to — all from this user's Xenon account):",
    `- Name: ${facts.account.name ?? "(not set)"}`,
    `- Plan: ${facts.account.plan}`,
    "",
    integrationsBlock,
    "",
    actionsBlock,
    "",
    "RULES:",
    "1. Only use the data provided above. It is the entirety of what you know about this account.",
    "2. NEVER invent, estimate, or fabricate marketplace metrics — no sales figures, order counts, revenue, ACoS, inventory levels, or fees. If asked for data you don't have, state plainly that it is not connected yet and explain how to connect it.",
    "3. Do not claim an action was taken unless it appears in the recorded agent actions above.",
    "4. Be concise and honest about what you can and cannot see.",
  ].join("\n");
}
