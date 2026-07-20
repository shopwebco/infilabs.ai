import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { requireMembership } from "@/lib/agency/workspace";
import { isBillingConfigured } from "@/lib/stripe/client";
import { startConnectOnboarding } from "@/lib/stripe/connect";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

const schema = z.object({ workspaceId: z.string().min(1) });

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured on this deployment yet." },
      { status: 503 },
    );
  }
  try {
    const membership = await requireMembership(user.id, parsed.data.workspaceId, "ADMIN");
    const url = await startConnectOnboarding(membership);
    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) return errorResponse(err);
    console.error("connect onboarding failed", err);
    return NextResponse.json(
      { error: "Could not start Stripe onboarding." },
      { status: 502 },
    );
  }
}
