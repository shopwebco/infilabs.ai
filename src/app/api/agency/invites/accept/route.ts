import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { acceptInviteSchema } from "@/lib/validation/agency";
import { acceptInvite } from "@/lib/agency/invites";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = acceptInviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  try {
    const result = await acceptInvite(user, parsed.data.token);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
