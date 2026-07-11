import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { archiveClientSchema } from "@/lib/validation/agency";
import { requireMembership } from "@/lib/agency/workspace";
import { setClientArchived } from "@/lib/agency/clients";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const user = await requireUser();
  const parsed = archiveClientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const client = await prisma.clientProject.findUnique({
    where: { id: clientId },
    select: { workspaceId: true },
  });
  if (!client) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const membership = await requireMembership(user.id, client.workspaceId);
    const result = await setClientArchived(membership, clientId, parsed.data.archived);
    return NextResponse.json({ client: result }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
