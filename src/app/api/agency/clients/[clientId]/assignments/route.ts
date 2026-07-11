import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assignSchema } from "@/lib/validation/agency";
import { requireMembership } from "@/lib/agency/workspace";
import { assignMember, unassignMember } from "@/lib/agency/clients";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

async function resolve(clientId: string, userId: string) {
  const client = await prisma.clientProject.findUnique({
    where: { id: clientId },
    select: { workspaceId: true },
  });
  if (!client) return null;
  return requireMembership(userId, client.workspaceId);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const user = await requireUser();
  const parsed = assignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  try {
    const membership = await resolve(clientId, user.id);
    if (!membership) return NextResponse.json({ error: "Not found." }, { status: 404 });
    await assignMember(membership, clientId, parsed.data.membershipId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const user = await requireUser();
  const parsed = assignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  try {
    const membership = await resolve(clientId, user.id);
    if (!membership) return NextResponse.json({ error: "Not found." }, { status: 404 });
    await unassignMember(membership, clientId, parsed.data.membershipId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
