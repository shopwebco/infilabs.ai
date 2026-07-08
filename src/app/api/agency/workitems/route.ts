import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createWorkItemSchema } from "@/lib/validation/agency";
import { requireMembership } from "@/lib/agency/workspace";
import { createWorkItem } from "@/lib/agency/workitems";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = createWorkItemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const client = await prisma.clientProject.findUnique({
    where: { id: parsed.data.clientProjectId },
    select: { workspaceId: true },
  });
  if (!client) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const membership = await requireMembership(user.id, client.workspaceId);
    const item = await createWorkItem(membership, parsed.data.clientProjectId, {
      title: parsed.data.title,
      body: { text: parsed.data.body },
    });
    return NextResponse.json({ workItem: item }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
