import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { transitionSchema } from "@/lib/validation/agency";
import { requireMembership } from "@/lib/agency/workspace";
import { transitionWorkItem } from "@/lib/agency/workitems";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();
  const parsed = transitionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const item = await prisma.workItem.findUnique({
    where: { id },
    select: { clientProject: { select: { workspaceId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const membership = await requireMembership(user.id, item.clientProject.workspaceId);
    const result = await transitionWorkItem(membership, id, parsed.data.action);
    return NextResponse.json({ workItem: result }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
