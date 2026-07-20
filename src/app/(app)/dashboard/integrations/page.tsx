import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { isAmazonConfigured } from "@/lib/integrations/amazon/config";
import { getAmazonIntegrationView } from "@/lib/integrations/amazon/sync";
import { Logo, Panel } from "@/components/ui";
import { AmazonConnectButton, AmazonSyncButton } from "./amazon-actions";

function money(cents: number | null, currency: string): string {
  if (cents === null) return "—";
  return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;
}

export default async function IntegrationsPage() {
  const user = await requireUser();
  const configured = isAmazonConfigured();
  const view = await getAmazonIntegrationView(user.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <Link href="/dashboard" className="text-sm text-muted hover:text-text">
          ← Dashboard
        </Link>
      </header>

      <section className="py-8">
        <h1 className="text-2xl font-semibold">Marketplace integrations</h1>
        <p className="mt-1 text-muted">
          Real OAuth and real data sync only — nothing here is fabricated.
        </p>

        <div className="mt-6 space-y-4">
          <Panel>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Amazon (SP-API)</h2>
              <span className="font-data text-xs text-muted">
                {view ? view.integration.status : "NOT CONNECTED"}
              </span>
            </div>

            {!configured && (
              <p className="mt-3 text-sm text-amber">
                Not configured on this deployment yet — Amazon LWA credentials
                (<span className="font-data">AMAZON_LWA_CLIENT_ID</span>,{" "}
                <span className="font-data">AMAZON_LWA_CLIENT_SECRET</span>,{" "}
                <span className="font-data">AMAZON_SP_APP_ID</span>) are required
                before a seller account can be connected.
              </p>
            )}

            {view?.integration.status === "CONNECTED" ||
            view?.integration.status === "ERROR" ? (
              <div className="mt-4 space-y-4">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Seller ID</dt>
                    <dd className="font-data">{view.integration.externalId ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Last sync</dt>
                    <dd className="font-data">
                      {view.integration.lastSyncAt?.toISOString() ?? "never"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Synced orders</dt>
                    <dd className="font-data">{view.orderCount}</dd>
                  </div>
                </dl>
                <AmazonSyncButton />
                {view.orderCount === 0 ? (
                  <p className="text-sm text-faint">
                    No orders synced yet — run a sync to pull your real order data.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {view.recentOrders.map((o) => (
                      <li key={o.externalOrderId} className="flex justify-between">
                        <span className="font-data text-xs">{o.externalOrderId}</span>
                        <span className="text-muted">
                          {o.status} · {money(o.totalCents, o.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <AmazonConnectButton />
              </div>
            )}
          </Panel>

          <Panel>
            <h2 className="text-base font-semibold text-muted">
              Walmart · TikTok Shop · Shopify
            </h2>
            <p className="mt-2 text-sm text-faint">
              Coming after Amazon (PRODUCT_SPEC §5 — the integration abstraction
              ships now, Amazon first).
            </p>
          </Panel>
        </div>
      </section>
    </main>
  );
}
