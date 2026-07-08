import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createWorkspaceSchema } from "@/lib/validation/agency";
import { createWorkspace } from "@/lib/agency/workspace";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = createWorkspaceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  try {
    const workspace = await createWorkspace(user, parsed.data.name);
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
