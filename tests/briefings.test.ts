import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  cadenceForPlan,
  generateBriefingData,
  createAndStoreBriefing,
} from "@/lib/briefings/generate";
import { GET as cronGet } from "@/app/api/cron/briefings/route";

const RUN = `brief_${Date.now()}`;

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { contains: RUN } },
    select: { id: true },
  });
  const uids = users.map((u) => u.id);
  await prisma.briefing.deleteMany({ where: { scopeId: { in: uids } } });
  await prisma.agentAction.deleteMany({ where: { userId: { in: uids } } });
  await prisma.approval.deleteMany({ where: { userId: { in: uids } } });
  await prisma.user.deleteMany({ where: { id: { in: uids } } });
  await prisma.$disconnect();
});

describe("cadence by plan", () => {
  it("is weekly for Starter and daily otherwise", () => {
    expect(cadenceForPlan("STARTER")).toBe("WEEKLY");
    expect(cadenceForPlan("PRO")).toBe("DAILY");
    expect(cadenceForPlan("AGENCY")).toBe("DAILY");
  });
});

describe("briefing generation is DB-derived only", () => {
  it("counts only rows inside the window and rolls up value recovered", async () => {
    const user = await prisma.user.create({
      data: { email: `${RUN}_a@example.com`, plan: "PRO" },
      select: { id: true },
    });
    const now = new Date();
    const inWindow = new Date(now.getTime() - 2 * 3600 * 1000); // 2h ago
    const outWindow = new Date(now.getTime() - 3 * 24 * 3600 * 1000); // 3d ago

    await prisma.agentAction.create({
      data: {
        userId: user.id,
        actor: "AGENT",
        kind: "fees.claim_filed",
        summary: "Filed a claim",
        valueImpactCents: 4100,
        payload: {},
        createdAt: inWindow,
      },
    });
    await prisma.agentAction.create({
      data: {
        userId: user.id,
        actor: "AGENT",
        kind: "old",
        summary: "Old action",
        valueImpactCents: 9999,
        payload: {},
        createdAt: outWindow,
      },
    });
    await prisma.approval.create({
      data: {
        userId: user.id,
        title: "Decide restock",
        detail: "…",
        payload: {},
        audience: "CUSTOMER",
        status: "PENDING",
        createdAt: inWindow,
      },
    });

    const start = new Date(now.getTime() - 24 * 3600 * 1000);
    const { body, valueRecoveredCents } = await generateBriefingData(
      { type: "USER", id: user.id },
      start,
      now,
    );

    expect(body.quiet).toBe(false);
    expect(body.actionCount).toBe(1); // the 3-day-old action is excluded
    expect(valueRecoveredCents).toBe(4100); // not 4100 + 9999
    expect(body.pendingDecisions).toBe(1);
    expect(body.headline).toContain("$41.00 recovered");
  });

  it("produces an honest quiet briefing for an empty period (no filler)", async () => {
    const user = await prisma.user.create({
      data: { email: `${RUN}_quiet@example.com`, plan: "STARTER" },
      select: { id: true },
    });
    const now = new Date();
    const stored = await createAndStoreBriefing(
      { type: "USER", id: user.id },
      "WEEKLY",
      new Date(now.getTime() - 7 * 24 * 3600 * 1000),
      now,
    );
    expect(stored.valueRecoveredCents).toBe(0);

    const row = await prisma.briefing.findUniqueOrThrow({ where: { id: stored.id } });
    const body = row.body as { quiet: boolean; headline: string; actionCount: number };
    expect(body.quiet).toBe(true);
    expect(body.actionCount).toBe(0);
    expect(body.headline).toMatch(/quiet period/i);
  });
});

describe("cron endpoint is secret-guarded", () => {
  it("rejects a request without the shared secret", async () => {
    const res = await cronGet(new Request("http://localhost/api/cron/briefings"));
    expect(res.status).toBe(401);
  });
});
