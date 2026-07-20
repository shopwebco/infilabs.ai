import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { verifyOAuthState } from "@/lib/integrations/amazon/config";
import { completeAmazonConnection } from "@/lib/integrations/amazon/oauth";
import { appUrl } from "@/lib/stripe/checkout";

export const runtime = "nodejs";

// OAuth callback from Seller Central. Amazon sends: state, selling_partner_id,
// spapi_oauth_code. The state must verify (HMAC + expiry) AND match the
// signed-in user — a mismatched state is a CSRF attempt, not a UX case.
export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("spapi_oauth_code");
  const sellingPartnerId = url.searchParams.get("selling_partner_id");

  const verified = verifyOAuthState(state);
  if (!verified || verified.userId !== user.id) {
    return NextResponse.json({ error: "Invalid or expired state." }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "Missing authorization code." }, { status: 400 });
  }

  try {
    await completeAmazonConnection(user.id, code, sellingPartnerId);
  } catch (err) {
    console.error("amazon connection failed", err);
    return NextResponse.redirect(`${appUrl()}/dashboard/integrations?error=connect_failed`, 302);
  }
  return NextResponse.redirect(`${appUrl()}/dashboard/integrations?connected=1`, 302);
}
