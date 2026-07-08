import { prisma } from "@/lib/db/prisma";
import { getStripe } from "./client";

/** Returns the user's Stripe customer id, creating and persisting one on first use. */
export async function ensureStripeCustomer(user: {
  id: string;
  email: string;
  name: string | null;
  stripeCustomerId: string | null;
}): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
