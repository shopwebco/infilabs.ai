import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  cadenceForPlan,
  periodFor,
  createAndStoreBriefing,
} from "@/lib/briefings/generate";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = req.headers.get("x-cron-secret");
  return bearer === secret || header === secret;
}

async function run(now: Date) {
  let generated = 0;

  // Per-account briefings, cadence by plan.
  const users = await prisma.user.findMany({ select: { id: true, plan: true } });
  for (const u of users) {
    const cadence = cadenceForPlan(u.plan);
    const { start, end } = periodFor(cadence, now);
    await createAndStoreBriefing({ type: "USER", id: u.id }, cadence, start, end);
    generated++;
  }

  // Per-client-project briefings (daily), active projects only.
  const clients = await prisma.clientProject.findMany({
    where: { archived: false },
    select: { id: true },
  });
  for (const c of clients) {
    const { start, end } = periodFor("DAILY", now);
    await createAndStoreBriefing({ type: "CLIENT", id: c.id }, "DAILY", start, end);
    generated++;
  }

  return generated;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const generated = await run(new Date());
  return NextResponse.json({ generated }, { status: 200 });
}

// GET for Vercel Cron (sends Authorization: Bearer <CRON_SECRET>); POST for manual triggers.
export const GET = handle;
export const POST = handle;
