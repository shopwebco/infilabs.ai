import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { buildScopedContext, renderSystemPrompt } from "@/lib/agent/context";

const RUN = `agenttest_${Date.now()}`;

afterAll(async () => {
  // Clean up everything tied to the test users.
  const users = await prisma.user.findMany({
    where: { email: { contains: RUN } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await prisma.marketplaceIntegration.deleteMany({ where: { userId: { in: ids } } });
  await prisma.agentAction.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

async function makeUser(tag: string) {
  return prisma.user.create({
    data: { email: `${RUN}_${tag}@example.com`, name: `User ${tag}`, plan: "STARTER" },
    select: { id: true, name: true, plan: true },
  });
}

describe("buildScopedContext — DB-derived only", () => {
  it("reports no data and forbids fabrication when nothing is connected", async () => {
    const user = await makeUser("empty");
    const { facts, systemPrompt } = await buildScopedContext(user);

    // Facts come straight from the (empty) DB — no invented rows.
    expect(facts.integrations).toEqual([]);
    expect(facts.recentActions).toEqual([]);
    expect(facts.account.plan).toBe("STARTER");

    // The honest empty-state and the anti-fabrication guardrail are present.
    expect(systemPrompt).toContain("No marketplace account is connected");
    expect(systemPrompt).toMatch(/NEVER invent, estimate, or fabricate/);
  });

  it("reflects exactly the integration rows in the DB — and only CONNECTED ones as usable", async () => {
    const user = await makeUser("connected");
    await prisma.marketplaceIntegration.create({
      data: { userId: user.id, provider: "AMAZON", status: "CONNECTED", externalId: "seller-1" },
    });
    await prisma.marketplaceIntegration.create({
      data: { userId: user.id, provider: "WALMART", status: "DISCONNECTED" },
    });

    const { facts, systemPrompt } = await buildScopedContext(user);

    // facts.integrations mirrors the DB rows exactly (both rows, real statuses).
    expect(facts.integrations).toEqual([
      { provider: "AMAZON", status: "CONNECTED" },
      { provider: "WALMART", status: "DISCONNECTED" },
    ]);

    // The prompt surfaces the CONNECTED provider and does not present the disconnected one as data.
    expect(systemPrompt).toContain("AMAZON (status: CONNECTED)");
    expect(systemPrompt).not.toContain("No marketplace account is connected");
  });

  it("reflects recorded agent actions from the DB", async () => {
    const user = await makeUser("actions");
    await prisma.agentAction.create({
      data: {
        userId: user.id,
        actor: "AGENT",
        kind: "agent.query",
        summary: "Answered a question about connecting Amazon.",
        payload: {},
      },
    });

    const { facts, systemPrompt } = await buildScopedContext(user);
    expect(facts.recentActions).toHaveLength(1);
    expect(facts.recentActions[0]!.summary).toBe("Answered a question about connecting Amazon.");
    expect(systemPrompt).toContain("Answered a question about connecting Amazon.");
  });
});

describe("renderSystemPrompt — pure function", () => {
  it("never emits marketplace metrics for an empty account", () => {
    const prompt = renderSystemPrompt({
      account: { name: "Sam", plan: "PRO" },
      integrations: [],
      recentActions: [],
    });
    // No fabricated currency/percentage metrics for an account with no data.
    expect(prompt).not.toMatch(/\$\s?\d/);
    expect(prompt).not.toMatch(/\d+(\.\d+)?%/);
    expect(prompt).toContain("Plan: PRO");
  });
});
