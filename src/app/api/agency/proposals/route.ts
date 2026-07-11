import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createProposalSchema } from "@/lib/validation/phase9";
import { requireMembership } from "@/lib/agency/workspace";
import { isAgentConfigured } from "@/lib/agent/client";
import {
  assertCanCreateProposal,
  generateProposalBody,
  storeProposal,
} from "@/lib/proposals";
import { appUrl } from "@/lib/stripe/checkout";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = createProposalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const membership = await requireMembership(user.id, parsed.data.workspaceId);
    assertCanCreateProposal(membership); // 403 before any generation

    if (!isAgentConfigured()) {
      return NextResponse.json(
        { error: "Proposal generation needs the AI agent configured." },
        { status: 503 },
      );
    }

    const body = await generateProposalBody({
      title: parsed.data.title,
      prospectUrl: parsed.data.prospectUrl || null,
      inputs: parsed.data.inputs,
    });
    const proposal = await storeProposal(parsed.data.workspaceId, {
      title: parsed.data.title,
      prospectUrl: parsed.data.prospectUrl || null,
      body,
    });

    return NextResponse.json(
      { proposal, url: `${appUrl()}/proposals/${proposal.publicSlug}` },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
