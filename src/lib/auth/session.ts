import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * Server-side guard: returns the authenticated user's DB record or redirects to /login.
 * Use in server components / route handlers. UI hiding is never a substitute (Rule 5).
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      platformRole: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  });

  // Session references a user that no longer exists → force re-auth.
  if (!user) {
    redirect("/login");
  }

  return user;
}
