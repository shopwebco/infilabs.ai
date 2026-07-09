import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { directorySchema } from "@/lib/validation/phase9";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = directorySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  try {
    await requirePlatformAdmin(user.id);
    const ws = await prisma.workspace.update({
      where: { id: parsed.data.workspaceId },
      data: { directoryListed: parsed.data.listed },
      select: { id: true, directoryListed: true },
    });
    return NextResponse.json({ workspace: ws }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
