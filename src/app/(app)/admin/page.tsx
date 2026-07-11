import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/admin/guard";
import { getPlatformMetrics } from "@/lib/admin/metrics";
import { prisma } from "@/lib/db/prisma";
import { Logo, Panel } from "@/components/ui";
import { DirectoryToggle } from "./directory-toggle";

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default async function AdminPage() {
  const user = await requireUser();
  // Platform-admin only — hide existence from everyone else.
  if (!(await isPlatformAdmin(user.id))) notFound();

  const [metrics, workspaces] = await Promise.all([
    getPlatformMetrics(),
    prisma.workspace.findMany({
      select: { id: true, name: true, directoryListed: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <Link href="/dashboard" className="text-sm text-muted hover:text-text">
          ← Dashboard
        </Link>
      </header>

      <section className="py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Platform admin</h1>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Panel>
              <p className="text-sm text-muted">Accounts</p>
              <p className="mt-1 font-data text-2xl">{metrics.accounts}</p>
            </Panel>
            <Panel>
              <p className="text-sm text-muted">MRR</p>
              <p className="mt-1 font-data text-2xl">{money(metrics.mrrCents)}</p>
            </Panel>
            <Panel>
              <p className="text-sm text-muted">Referral payouts / mo</p>
              <p className="mt-1 font-data text-2xl">{money(metrics.payoutLedgerCents)}</p>
            </Panel>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Plan distribution</h2>
          <Panel className="mt-3">
            <ul className="space-y-1 text-sm">
              {metrics.planDistribution.map((p) => (
                <li key={p.plan} className="flex justify-between">
                  <span>{p.plan}</span>
                  <span className="font-data text-muted">{p.count}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Agency directory approvals</h2>
          <div className="mt-3 space-y-2">
            {workspaces.map((w) => (
              <Panel key={w.id} className="flex items-center justify-between">
                <span className="text-sm">
                  {w.name}{" "}
                  <span className="font-data text-xs text-muted">
                    {w.directoryListed ? "listed" : "not listed"}
                  </span>
                </span>
                <DirectoryToggle workspaceId={w.id} listed={w.directoryListed} />
              </Panel>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
