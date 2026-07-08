import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { PRO_OR_HIGHER, PlanRequiredError, requirePlan, hasPlan } from "@/lib/billing/plan";
import {
  consumeAgentQuery,
  getAgentUsage,
  QuotaExceededError,
  STARTER_MONTHLY_QUERY_LIMIT,
} from "@/lib/agent/usage";

const RUN = `billtest_${Date.now()}`;

afterAll(async () => {
  await prisma.agentUsage.deleteMany({ where: { user: { email: { contains: RUN } } } });
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.$disconnect();
});

async function makeUser(tag: string, plan: "STARTER" | "PRO") {
  return prisma.user.create({
    data: { email: `${RUN}_${tag}@example.com`, name: tag, plan },
    select: { id: true, plan: true },
  });
}

describe("requirePlan gate", () => {
  it("allows Pro-or-higher and blocks Starter server-side (403)", () => {
    expect(() => requirePlan({ plan: "PRO" }, PRO_OR_HIGHER)).not.toThrow();
    expect(() => requirePlan({ plan: "AGENCY" }, PRO_OR_HIGHER)).not.toThrow();
    expect(hasPlan({ plan: "STARTER" }, PRO_OR_HIGHER)).toBe(false);

    try {
      requirePlan({ plan: "STARTER" }, PRO_OR_HIGHER);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PlanRequiredError);
      expect((err as PlanRequiredError).status).toBe(403);
    }
  });
});

describe("Starter agent-query metering", () => {
  it("allows exactly 25 queries and blocks the 26th server-side", async () => {
    const user = await makeUser("starter", "STARTER");

    for (let i = 1; i <= STARTER_MONTHLY_QUERY_LIMIT; i++) {
      const res = await consumeAgentQuery(user.id, "STARTER");
      expect(res.count).toBe(i);
    }
    expect(await getAgentUsage(user.id)).toBe(25);

    // The 26th is rejected.
    await expect(consumeAgentQuery(user.id, "STARTER")).rejects.toBeInstanceOf(
      QuotaExceededError,
    );
    // Rejection did not inflate usage past the limit.
    expect(await getAgentUsage(user.id)).toBe(25);
  });

  it("does not limit paid plans", async () => {
    const user = await makeUser("pro", "PRO");
    for (let i = 0; i < STARTER_MONTHLY_QUERY_LIMIT + 5; i++) {
      await consumeAgentQuery(user.id, "PRO");
    }
    expect(await getAgentUsage(user.id)).toBe(STARTER_MONTHLY_QUERY_LIMIT + 5);
  });
});
