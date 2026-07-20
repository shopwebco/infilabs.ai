import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getStripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";
import { handleConnectEvent } from "@/lib/stripe/connect-webhook";

export const runtime = "nodejs";

// Webhook endpoint for CONNECTED-ACCOUNT events (Stripe dashboard: "Listen to
// events on connected accounts"). Signature-verified with its own secret;
// idempotent via ProcessedStripeEvent, same discipline as the platform webhook.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const already = await prisma.processedStripeEvent.findUnique({
    where: { id: event.id },
    select: { id: true },
  });
  if (already) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    await handleConnectEvent(event);
  } catch (err) {
    console.error("connect webhook handler error", event.type, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  try {
    await prisma.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
