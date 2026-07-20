import { prisma } from "@/lib/db/prisma";
import { getAmazonAccessToken } from "./oauth";

// North America endpoint by default; override per-region via env.
function spApiEndpoint(): string {
  return process.env.AMAZON_SP_ENDPOINT ?? "https://sellingpartnerapi-na.amazon.com";
}

// US marketplace by default (ATVPDKIKX0DER); comma-separated override via env.
function marketplaceIds(): string {
  return process.env.AMAZON_MARKETPLACE_IDS ?? "ATVPDKIKX0DER";
}

interface SpApiOrder {
  AmazonOrderId: string;
  OrderStatus: string;
  PurchaseDate?: string;
  OrderTotal?: { Amount?: string; CurrencyCode?: string };
  [k: string]: unknown;
}

/**
 * Syncs recent orders from the REAL SP-API Orders endpoint into Postgres.
 * Rows are upserted by (integrationId, externalOrderId) and store the actual
 * API payload — dashboards read only these synced rows (invariant 6).
 */
export async function syncAmazonOrders(
  integrationId: string,
  createdAfter?: Date,
): Promise<{ synced: number }> {
  const accessToken = await getAmazonAccessToken(integrationId);

  const after = createdAfter ?? new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const params = new URLSearchParams({
    MarketplaceIds: marketplaceIds(),
    CreatedAfter: after.toISOString(),
  });

  const res = await fetch(`${spApiEndpoint()}/orders/v0/orders?${params.toString()}`, {
    headers: { "x-amz-access-token": accessToken },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    await prisma.marketplaceIntegration.update({
      where: { id: integrationId },
      data: { status: "ERROR" },
    });
    throw new Error(`SP-API orders request failed (${res.status}): ${detail}`);
  }

  const payload = (await res.json()) as { payload?: { Orders?: SpApiOrder[] } };
  const orders = payload.payload?.Orders ?? [];

  let synced = 0;
  for (const order of orders) {
    if (!order.AmazonOrderId) continue;
    const amount = order.OrderTotal?.Amount ? parseFloat(order.OrderTotal.Amount) : null;
    await prisma.marketplaceOrder.upsert({
      where: {
        integrationId_externalOrderId: {
          integrationId,
          externalOrderId: order.AmazonOrderId,
        },
      },
      create: {
        integrationId,
        externalOrderId: order.AmazonOrderId,
        status: order.OrderStatus ?? "UNKNOWN",
        totalCents: amount !== null && Number.isFinite(amount) ? Math.round(amount * 100) : null,
        currency: (order.OrderTotal?.CurrencyCode ?? "usd").toLowerCase(),
        purchasedAt: order.PurchaseDate ? new Date(order.PurchaseDate) : null,
        raw: JSON.parse(JSON.stringify(order)),
      },
      update: {
        status: order.OrderStatus ?? "UNKNOWN",
        raw: JSON.parse(JSON.stringify(order)),
      },
    });
    synced++;
  }

  await prisma.marketplaceIntegration.update({
    where: { id: integrationId },
    data: { status: "CONNECTED", lastSyncAt: new Date() },
  });
  return { synced };
}

/** Read model for the integrations page — synced rows only, never constants. */
export async function getAmazonIntegrationView(userId: string) {
  const integration = await prisma.marketplaceIntegration.findFirst({
    where: { userId, provider: "AMAZON" },
    select: { id: true, status: true, externalId: true, lastSyncAt: true },
  });
  if (!integration) return null;

  const [orderCount, recentOrders] = await Promise.all([
    prisma.marketplaceOrder.count({ where: { integrationId: integration.id } }),
    prisma.marketplaceOrder.findMany({
      where: { integrationId: integration.id },
      orderBy: { purchasedAt: "desc" },
      take: 10,
      select: {
        externalOrderId: true,
        status: true,
        totalCents: true,
        currency: true,
        purchasedAt: true,
      },
    }),
  ]);
  return { integration, orderCount, recentOrders };
}
