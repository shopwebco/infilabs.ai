import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createInviteSchema } from "@/lib/validation/agency";
import { requireMembership } from "@/lib/agency/workspace";
import { createInvite } from "@/lib/agency/invites";
import { appUrl } from "@/lib/stripe/checkout";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = createInviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  try {
    // ADMIN required — enforced here and again in createInvite.
    const membership = await requireMembership(user.id, parsed.data.workspaceId, "ADMIN");
    const { invite, token } = await createInvite(
      membership,
      parsed.data.email,
      parsed.data.role,
    );
    // Email delivery lands in Phase 4; until then the admin shares this link.
    return NextResponse.json(
      {
        invite,
        acceptUrl: `${appUrl()}/agency/invite/${token}`,
        emailSent: false,
      },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
