import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import {
  isAmazonConfigured,
  createOAuthState,
  buildConsentUrl,
} from "@/lib/integrations/amazon/config";

export const runtime = "nodejs";

// Starts the real Login-with-Amazon consent flow. Feature-gated: without LWA
// keys this is an honest 503, never a simulated connection.
export async function GET() {
  const user = await requireUser();

  if (!isAmazonConfigured()) {
    return NextResponse.json(
      {
        error:
          "Amazon integration is not configured on this deployment yet (LWA credentials missing).",
      },
      { status: 503 },
    );
  }

  const state = createOAuthState(user.id);
  return NextResponse.redirect(buildConsentUrl(state), 302);
}
