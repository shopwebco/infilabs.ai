import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getStripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";
import { handleStripeEvent } from "@/lib/stripe/webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Raw body is required for signature verification.
  const body = await req.text();

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: short-circuit already-processed events. We only mark an event
  // processed AFTER it handles successfully, so a failed+retried delivery still
  // completes. Handlers are idempotent, so a concurrent double-delivery is safe.
  const already = await prisma.processedStripeEvent.findUnique({
    where: { id: event.id },
    select: { id: true },
  });
  if (already) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error("stripe webhook handler error", event.type, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  try {
    await prisma.processedStripeEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (err) {
    // A concurrent delivery recorded it first — still a success.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
