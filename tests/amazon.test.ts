import { describe, expect, it } from "vitest";
import { encryptToken, decryptToken } from "@/lib/integrations/amazon/crypto";
import {
  isAmazonConfigured,
  createOAuthState,
  verifyOAuthState,
  buildConsentUrl,
  amazonRedirectUri,
} from "@/lib/integrations/amazon/config";

describe("token encryption at rest", () => {
  it("round-trips and never stores plaintext", () => {
    const token = "Atzr|refresh-token-secret-value";
    const enc = encryptToken(token);
    expect(enc).not.toContain(token);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptToken(enc)).toBe(token);
  });

  it("rejects tampered ciphertext (GCM auth)", () => {
    const enc = encryptToken("secret");
    const parts = enc.split(".");
    // Flip a character in the encrypted data segment.
    const data = parts[3]!;
    parts[3] = (data[0] === "A" ? "B" : "A") + data.slice(1);
    expect(() => decryptToken(parts.join("."))).toThrow();
    expect(() => decryptToken("garbage")).toThrow();
  });

  it("produces distinct ciphertexts per call (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });
});

describe("OAuth state (CSRF)", () => {
  it("verifies a valid state and binds the user id", () => {
    const state = createOAuthState("user-123");
    expect(verifyOAuthState(state)).toEqual({ userId: "user-123" });
  });

  it("rejects tampered and expired states", () => {
    const state = createOAuthState("user-123");
    expect(verifyOAuthState(state.slice(0, -2) + "zz")).toBeNull();
    const expired = createOAuthState("user-123", Date.now() - 16 * 60 * 1000);
    expect(verifyOAuthState(expired)).toBeNull();
    expect(verifyOAuthState("nonsense")).toBeNull();
  });
});

describe("feature gate & consent URL", () => {
  it("is unconfigured without LWA env keys (this environment)", () => {
    // CI and local test envs deliberately carry no Amazon credentials.
    expect(isAmazonConfigured()).toBe(false);
  });

  it("builds the Seller Central consent URL from env when present", () => {
    const prev = process.env.AMAZON_SP_APP_ID;
    process.env.AMAZON_SP_APP_ID = "amzn1.sp.solution.test-app";
    try {
      const url = new URL(buildConsentUrl("signed-state"));
      expect(url.hostname).toBe("sellercentral.amazon.com");
      expect(url.pathname).toBe("/apps/authorize/consent");
      expect(url.searchParams.get("application_id")).toBe("amzn1.sp.solution.test-app");
      expect(url.searchParams.get("state")).toBe("signed-state");
      expect(url.searchParams.get("redirect_uri")).toBe(amazonRedirectUri());
      expect(url.searchParams.get("version")).toBe("beta");
    } finally {
      if (prev === undefined) delete process.env.AMAZON_SP_APP_ID;
      else process.env.AMAZON_SP_APP_ID = prev;
    }
  });
});
