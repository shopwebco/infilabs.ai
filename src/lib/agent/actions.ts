import { prisma } from "@/lib/db/prisma";

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * Appends an immutable audit record of an agent interaction (invariant 5:
 * AgentAction is append-only — create only, never update/delete).
 */
export async function logAgentQuery(
  userId: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  await prisma.agentAction.create({
    data: {
      userId,
      actor: "AGENT",
      kind: "agent.query",
      summary: truncate(assistantReply.trim() || "Agent responded to a query.", 300),
      payload: { userMessage: truncate(userMessage, 500) },
    },
  });
}
