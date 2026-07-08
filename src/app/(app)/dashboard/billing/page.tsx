import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getAgentUsage, STARTER_MONTHLY_QUERY_LIMIT } from "@/lib/agent/usage";
import { Logo, Panel } from "@/components/ui";
import { UpgradeButton, ManageBillingButton } from "./billing-actions";

const PLAN_LABEL: Record<string, string> = {
  STARTER: "Starter (free)",
  PRO: "Pro",
  AGENCY: "Agency",
  ENTERPRISE: "Enterprise",
};

export default async function BillingPage() {
  const user = await requireUser();
  const isStarter = user.plan === "STARTER";
  const usage = isStarter ? await getAgentUsage(user.id) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <Link href="/dashboard" className="text-sm text-muted hover:text-text">
          ← Dashboard
        </Link>
      </header>

      <section className="py-8">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-muted">Manage your Xenon plan and payments.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Panel>
            <h2 className="text-sm font-semibold text-muted">Current plan</h2>
            <p className="mt-2 font-display text-xl">
              {PLAN_LABEL[user.plan] ?? user.plan}
            </p>

            {isStarter && usage !== null && (
              <p className="mt-3 text-sm text-muted">
                Agent queries this month:{" "}
                <span className="font-data text-text">
                  {usage} / {STARTER_MONTHLY_QUERY_LIMIT}
                </span>
              </p>
            )}

            <div className="mt-5">
              {isStarter ? <UpgradeButton /> : <ManageBillingButton />}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-sm font-semibold text-muted">Pro — $49/mo</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              <li>Unlimited agent queries</li>
              <li>Autonomous PPC + playbooks</li>
              <li>All marketplaces</li>
              <li>Daily briefings + predictive engine</li>
            </ul>
          </Panel>
        </div>
      </section>
    </main>
  );
}
