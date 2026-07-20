import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isAmazonConfigured } from "@/lib/integrations/amazon/config";
import { syncAmazonOrders } from "@/lib/integrations/amazon/sync";

export const runtime = "nodejs";

// Runs a real SP-API orders sync for the signed-in user's own connection.
export async function POST() {
  const user = await requireUser();

  if (!isAmazonConfigured()) {
    return NextResponse.json(
      { error: "Amazon integration is not configured on this deployment yet." },
      { status: 503 },
    );
  }

  const integration = await prisma.marketplaceIntegration.findFirst({
    where: { userId: user.id, provider: "AMAZON", status: { not: "DISCONNECTED" } },
    select: { id: true },
  });
  if (!integration) {
    return NextResponse.json(
      { error: "Connect your Amazon account first." },
      { status: 409 },
    );
  }

  try {
    const result = await syncAmazonOrders(integration.id);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("amazon sync failed", err);
    return NextResponse.json(
      { error: "Sync failed — see server logs. The integration is marked ERROR." },
      { status: 502 },
    );
  }
}
