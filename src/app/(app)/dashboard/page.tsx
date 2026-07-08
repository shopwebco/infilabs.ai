import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { Logo, Panel } from "@/components/ui";
import { LogoutButton } from "./logout-button";

const PLAN_LABEL: Record<string, string> = {
  STARTER: "Starter (free)",
  PRO: "Pro",
  AGENCY: "Agency",
  ENTERPRISE: "Enterprise",
};

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">{user.email}</span>
          <LogoutButton />
        </div>
      </header>

      <section className="py-8">
        <h1 className="text-2xl font-semibold">
          Welcome{user.name ? `, ${user.name}` : ""}.
        </h1>
        <p className="mt-1 text-muted">
          Your Xenon workspace is ready. Connect a marketplace to start seeing
          live data.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Panel>
            <h2 className="text-sm font-semibold text-muted">Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Plan</dt>
                <dd className="font-data">{PLAN_LABEL[user.plan] ?? user.plan}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Billing</dt>
                <dd>
                  <Link href="/dashboard/billing" className="text-ice hover:underline">
                    Manage plan →
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Member since</dt>
                <dd className="font-data">
                  {user.createdAt.toISOString().slice(0, 10)}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel>
            <h2 className="text-sm font-semibold text-muted">Marketplaces</h2>
            {/* Honest empty state — no fabricated metrics (CLAUDE.md Rule 1). */}
            <p className="mt-3 text-sm text-muted">
              No marketplace connected yet.
            </p>
            <p className="mt-1 text-sm text-faint">
              Amazon integration arrives in a later build phase. When connected,
              your real orders and listings appear here.
            </p>
          </Panel>
        </div>
      </section>
    </main>
  );
}
