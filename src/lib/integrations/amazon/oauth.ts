import { prisma } from "@/lib/db/prisma";
import { encryptToken, decryptToken } from "./crypto";
import { amazonRedirectUri } from "./config";

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

interface LwaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

async function lwaTokenRequest(body: URLSearchParams): Promise<LwaTokenResponse> {
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Amazon LWA credentials are not configured.");
  }
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LWA token request failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as LwaTokenResponse;
}

/**
 * OAuth callback completion: exchange the authorization code with Amazon's real
 * LWA token endpoint and store the user's AMAZON integration with tokens
 * encrypted at rest. `sellingPartnerId` comes from the callback query.
 */
export async function completeAmazonConnection(
  userId: string,
  code: string,
  sellingPartnerId: string | null,
) {
  const tokens = await lwaTokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: amazonRedirectUri(),
    }),
  );
  if (!tokens.refresh_token) {
    throw new Error("Amazon did not return a refresh token.");
  }

  const existing = await prisma.marketplaceIntegration.findFirst({
    where: { userId, provider: "AMAZON" },
    select: { id: true },
  });

  const data = {
    status: "CONNECTED" as const,
    accessTokenEnc: encryptToken(tokens.access_token),
    refreshTokenEnc: encryptToken(tokens.refresh_token),
    externalId: sellingPartnerId,
  };

  return existing
    ? prisma.marketplaceIntegration.update({ where: { id: existing.id }, data })
    : prisma.marketplaceIntegration.create({
        data: { userId, provider: "AMAZON", ...data },
      });
}

/** Fresh SP-API access token via the stored (encrypted) refresh token. */
export async function getAmazonAccessToken(integrationId: string): Promise<string> {
  const integration = await prisma.marketplaceIntegration.findUniqueOrThrow({
    where: { id: integrationId },
    select: { refreshTokenEnc: true },
  });
  if (!integration.refreshTokenEnc) {
    throw new Error("No refresh token stored for this integration.");
  }
  const tokens = await lwaTokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptToken(integration.refreshTokenEnc),
    }),
  );
  return tokens.access_token;
}
