import crypto from "node:crypto";
import { appUrl } from "@/lib/stripe/checkout";

/** Feature gate (BUILD_PLAN Phase 8): absent LWA keys → gated, never faked. */
export function isAmazonConfigured(): boolean {
  return Boolean(
    process.env.AMAZON_LWA_CLIENT_ID &&
      process.env.AMAZON_LWA_CLIENT_SECRET &&
      process.env.AMAZON_SP_APP_ID,
  );
}

export function amazonRedirectUri(): string {
  return `${appUrl()}/api/integrations/amazon/callback`;
}

const STATE_TTL_MS = 15 * 60 * 1000;

function stateKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return crypto.createHash("sha256").update(`xenon-oauth-state:${secret}`).digest();
}

/** HMAC-signed OAuth state (CSRF protection): binds the flow to the signed-in user. */
export function createOAuthState(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now + STATE_TTL_MS })).toString(
    "base64url",
  );
  const sig = crypto.createHmac("sha256", stateKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string, now = Date.now()): { userId: string } | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = crypto.createHmac("sha256", stateKey()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      uid?: string;
      exp?: number;
    };
    if (!obj.uid || typeof obj.exp !== "number" || obj.exp < now) return null;
    return { userId: obj.uid };
  } catch {
    return null;
  }
}

/**
 * Seller Central OAuth consent URL (Login with Amazon for SP-API).
 * `version=beta` is required while the SP-API app is in draft status.
 */
export function buildConsentUrl(state: string, opts?: { draftApp?: boolean }): string {
  const appId = process.env.AMAZON_SP_APP_ID;
  if (!appId) throw new Error("AMAZON_SP_APP_ID is not set.");
  const params = new URLSearchParams({
    application_id: appId,
    state,
    redirect_uri: amazonRedirectUri(),
  });
  if (opts?.draftApp ?? true) params.set("version", "beta");
  return `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`;
}
