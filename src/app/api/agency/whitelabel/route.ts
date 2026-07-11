import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { whiteLabelSchema } from "@/lib/validation/whitelabel";
import { requireMembership } from "@/lib/agency/workspace";
import { upsertWhiteLabel } from "@/lib/whitelabel";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = whiteLabelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  try {
    // ADMIN required — enforced here and again in upsertWhiteLabel.
    const membership = await requireMembership(user.id, parsed.data.workspaceId, "ADMIN");
    const result = await upsertWhiteLabel(membership, {
      brandName: parsed.data.brandName,
      accentColor: parsed.data.accentColor,
      logoUrl: parsed.data.logoUrl || null,
      customDomain: parsed.data.customDomain || null,
      emailFrom: parsed.data.emailFrom || null,
      hideXenon: parsed.data.hideXenon,
    });
    return NextResponse.json({ whiteLabel: result }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
