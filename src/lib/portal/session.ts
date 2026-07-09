import crypto from "node:crypto";

export const PORTAL_COOKIE = "xenon_portal";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set.");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** A self-contained, HMAC-signed portal session value (stored in an httpOnly cookie). */
export function createPortalSessionValue(
  portalUserId: string,
  clientProjectId: string,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ pid: portalUserId, cid: clientProjectId, exp: now + SESSION_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Verify signature + expiry. Returns the scoped identity, or null if invalid/tampered/expired. */
export function verifyPortalSessionValue(
  value: string | undefined,
  now = Date.now(),
): { portalUserId: string; clientProjectId: string } | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  const expected = sign(payload);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      pid?: string;
      cid?: string;
      exp?: number;
    };
    if (!obj.pid || !obj.cid || typeof obj.exp !== "number" || obj.exp < now) {
      return null;
    }
    return { portalUserId: obj.pid, clientProjectId: obj.cid };
  } catch {
    return null;
  }
}
