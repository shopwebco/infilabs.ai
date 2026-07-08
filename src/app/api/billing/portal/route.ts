import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { isBillingConfigured, getStripe } from "@/lib/stripe/client";
import { appUrl } from "@/lib/stripe/checkout";

// Opens the Stripe Customer Portal so the user can cancel / downgrade / update card.
export async function POST() {
  const user = await requireUser();

  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 503 },
    );
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet — upgrade first." },
      { status: 409 },
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl()}/dashboard/billing`,
    });
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("portal failed", err);
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
