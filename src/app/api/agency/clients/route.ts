import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createClientSchema } from "@/lib/validation/agency";
import { requireMembership } from "@/lib/agency/workspace";
import { createClientProject } from "@/lib/agency/clients";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = createClientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  try {
    const membership = await requireMembership(user.id, parsed.data.workspaceId);
    const client = await createClientProject(membership, parsed.data.name);
    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
