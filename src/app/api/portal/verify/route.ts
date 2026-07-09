import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyLinkSchema } from "@/lib/validation/portal";
import { consumeMagicLink } from "@/lib/portal/tokens";
import { PORTAL_COOKIE, createPortalSessionValue } from "@/lib/portal/session";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = verifyLinkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  try {
    const { portalUserId, clientProjectId } = await consumeMagicLink(parsed.data.token);
    const value = createPortalSessionValue(portalUserId, clientProjectId);

    const store = await cookies();
    store.set(PORTAL_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 12 * 60 * 60,
    });

    return NextResponse.json({ clientProjectId }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
