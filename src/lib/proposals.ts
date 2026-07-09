import type { Membership, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, hasRole } from "@/lib/auth/rbac";
import { getAnthropic, agentModel } from "@/lib/agent/client";

export function assertCanCreateProposal(actor: Membership): void {
  if (!hasRole(actor.role, "MANAGER")) {
    throw new ForbiddenError("Only managers and admins can create proposals.");
  }
}

/**
 * Generates an audit/proposal body from the agency's inputs only. The prompt
 * forbids inventing metrics — proposal pages must contain no fabricated numbers
 * (Phase 9 acceptance / Rule 1).
 */
export async function generateProposalBody(input: {
  title: string;
  prospectUrl?: string | null;
  inputs: string;
}): Promise<Prisma.InputJsonValue> {
  const system =
    "You write a concise, honest sales audit for a prospective client of a marketplace agency. " +
    "Use ONLY the inputs provided below. Do NOT invent, estimate, or fabricate any metrics, sales " +
    "figures, revenue, percentages, or data you were not explicitly given. Where you lack data, speak " +
    "qualitatively about opportunities and concrete next steps. Use short section headers and plain prose.";
  const userMsg = [
    `Prospect: ${input.title}`,
    `Store URL: ${input.prospectUrl ?? "(not provided)"}`,
    "",
    "Inputs from the agency:",
    input.inputs,
  ].join("\n");

  const res = await getAnthropic().messages.create({
    model: agentModel(),
    max_tokens: 1400,
    system,
    messages: [{ role: "user", content: userMsg }],
  });
  const generatedText = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  return { generatedText, prospectUrl: input.prospectUrl ?? null };
}

export async function storeProposal(
  workspaceId: string,
  input: { title: string; prospectUrl?: string | null; body: Prisma.InputJsonValue },
) {
  return prisma.proposal.create({
    data: {
      workspaceId,
      title: input.title,
      prospectUrl: input.prospectUrl ?? null,
      body: input.body,
    },
    select: { id: true, publicSlug: true },
  });
}

export async function getProposalBySlug(slug: string) {
  return prisma.proposal.findUnique({
    where: { publicSlug: slug },
    select: {
      id: true,
      title: true,
      prospectUrl: true,
      body: true,
      workspace: {
        select: {
          name: true,
          whiteLabel: {
            select: { brandName: true, accentColor: true, logoUrl: true, hideXenon: true },
          },
        },
      },
    },
  });
}

export async function listProposals(actor: Membership) {
  return prisma.proposal.findMany({
    where: { workspaceId: actor.workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, publicSlug: true, createdAt: true },
  });
}
