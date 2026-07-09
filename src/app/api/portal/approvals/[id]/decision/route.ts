import { NextResponse } from "next/server";
import { decisionSchema } from "@/lib/validation/portal";
import { getPortalSession } from "@/lib/portal/scope";
import { decideApproval } from "@/lib/portal/approvals";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const parsed = decisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  try {
    const result = await decideApproval(session, id, parsed.data.decision);
    return NextResponse.json({ approval: result }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
