import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for OAuth tokens at rest (DATA_MODEL: accessTokenEnc /
 * refreshTokenEnc are "encrypted at rest"). Key is derived from AUTH_SECRET so
 * no extra secret is required; the ciphertext is versioned for future rotation.
 */
function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return crypto.createHash("sha256").update(`xenon-token-enc:${secret}`).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptToken(ciphertext: string): string {
  const [version, ivB64, tagB64, dataB64] = ciphertext.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unrecognized token ciphertext format.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  // GCM auth tag verification makes tampering throw here.
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
