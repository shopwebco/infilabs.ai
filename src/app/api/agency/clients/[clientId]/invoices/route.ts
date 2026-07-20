import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireMembership } from "@/lib/agency/workspace";
import { assertClientAccess } from "@/lib/agency/clients";
import { hasRole, ForbiddenError } from "@/lib/auth/rbac";
import { isBillingConfigured } from "@/lib/stripe/client";
import { requireConnectOnboarded, createClientBillingItem } from "@/lib/stripe/connect";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

const schema = z.object({
  customerEmail: z.string().email().max(320),
  description: z.string().trim().min(1).max(300),
  amountCents: z.number().int().min(100).max(10_000_000),
  recurring: z.boolean().default(false),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const client = await prisma.clientProject.findUnique({
    where: { id: clientId },
    select: {
      name: true,
      workspace: {
        select: { id: true, stripeConnectAccountId: true, connectOnboarded: true },
      },
    },
  });
  if (!client) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured on this deployment yet." },
      { status: 503 },
    );
  }

  try {
    const membership = await requireMembership(user.id, client.workspace.id);
    if (!hasRole(membership.role, "MANAGER")) {
      throw new ForbiddenError("Only managers and admins can bill clients.");
    }
    await assertClientAccess(membership, clientId);
    const connectAccountId = requireConnectOnboarded(client.workspace);

    const result = await createClientBillingItem({
      connectAccountId,
      clientProjectId: clientId,
      clientName: client.name,
      customerEmail: parsed.data.customerEmail,
      description: parsed.data.description,
      amountCents: parsed.data.amountCents,
      recurring: parsed.data.recurring,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) return errorResponse(err);
    console.error("client billing failed", err);
    return NextResponse.json(
      { error: "Could not create the invoice on Stripe." },
      { status: 502 },
    );
  }
}
