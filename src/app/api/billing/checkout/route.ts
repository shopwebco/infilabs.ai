import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { isBillingConfigured, getStripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import { priceIdForPlan } from "@/lib/stripe/plans";
import { buildCheckoutSessionParams, appUrl } from "@/lib/stripe/checkout";

// Starts a Stripe Checkout session to upgrade the current user to Pro.
export async function POST() {
  const user = await requireUser(); // 401→/login handled inside

  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 503 },
    );
  }

  // Already on a paid plan → nothing to buy.
  if (user.plan !== "STARTER") {
    return NextResponse.json(
      { error: "You already have an active paid plan." },
      { status: 409 },
    );
  }

  try {
    const customerId = await ensureStripeCustomer(user);
    const session = await getStripe().checkout.sessions.create(
      buildCheckoutSessionParams({
        customerId,
        priceId: priceIdForPlan("PRO"),
        appUrl: appUrl(),
      }),
    );

    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("checkout failed", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
