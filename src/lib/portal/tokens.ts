import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";

const TTL_MS = 15 * 60 * 1000; // 15 minutes (invariant 4)

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export class InvalidTokenError extends Error {
  readonly status = 400;
  constructor(message = "This login link is invalid or has expired.") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

/** Issue a magic-link token. Returns the raw token ONCE; only its hash is stored. */
export async function issueMagicLink(portalUserId: string, now = new Date()): Promise<string> {
  const raw = crypto.randomBytes(32).toString("base64url");
  await prisma.magicLinkToken.create({
    data: {
      portalUserId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(now.getTime() + TTL_MS),
    },
  });
  return raw;
}

/**
 * Validate and consume a magic-link token: single-use and ≤15-min expiry.
 * The used-flag is set with a conditional update so a race can't double-spend.
 */
export async function consumeMagicLink(rawToken: string, now = new Date()) {
  const token = await prisma.magicLinkToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { portalUser: { select: { id: true, clientProjectId: true } } },
  });
  if (!token) throw new InvalidTokenError();
  if (token.usedAt) throw new InvalidTokenError("This login link has already been used.");
  if (token.expiresAt < now) throw new InvalidTokenError("This login link has expired.");

  const claimed = await prisma.magicLinkToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count === 0) {
    throw new InvalidTokenError("This login link has already been used.");
  }

  return {
    portalUserId: token.portalUser.id,
    clientProjectId: token.portalUser.clientProjectId,
  };
}
