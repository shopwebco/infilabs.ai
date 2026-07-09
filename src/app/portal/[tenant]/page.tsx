import { redirect } from "next/navigation";
import { requireClientScope } from "@/lib/portal/scope";
import { getPortalView } from "@/lib/portal/data";
import { ForbiddenError } from "@/lib/auth/rbac";
import { Logo, Panel } from "@/components/ui";
import { ApprovalActions } from "./approval-actions";
import { PortalLogoutButton } from "./logout-button";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting your decision",
  APPROVED: "Approved",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  PUBLISHED: "Published",
};

function money(cents: number | null): string | null {
  if (cents === null) return null;
  return `${cents < 0 ? "-" : "+"}$${Math.abs(cents / 100).toFixed(2)}`;
}

export default async function PortalHome({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;

  try {
    await requireClientScope(tenant);
  } catch (err) {
    if (err instanceof ForbiddenError) redirect(`/portal/${tenant}/login`);
    throw err;
  }

  const { client, approvals, workItems, actions } = await getPortalView(tenant);
  if (!client) redirect(`/portal/${tenant}/login`);

  const pending = approvals.filter((a) => a.status === "PENDING");
  const decided = approvals.filter((a) => a.status !== "PENDING");

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">{client.name}</span>
          <PortalLogoutButton tenant={tenant} />
        </div>
      </header>

      <section className="space-y-8 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Approvals</h1>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-faint">Nothing needs your decision right now.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {pending.map((a) => (
                <Panel key={a.id}>
                  <h2 className="text-base font-semibold">{a.title}</h2>
                  <p className="mt-1 text-sm text-muted">{a.detail}</p>
                  <ApprovalActions approvalId={a.id} />
                </Panel>
              ))}
            </div>
          )}
          {decided.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-muted">
              {decided.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>{a.title}</span>
                  <span className="font-data text-xs">{STATUS_LABEL[a.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold">Published work</h2>
          {workItems.length === 0 ? (
            <p className="mt-2 text-sm text-faint">No published work yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {workItems.map((w) => (
                <li
                  key={w.id}
                  className="flex justify-between rounded-card border border-line px-3 py-2.5 text-sm"
                >
                  <span>{w.title}</span>
                  <span className="font-data text-xs text-muted">
                    {STATUS_LABEL[w.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold">What your agency did</h2>
          {actions.length === 0 ? (
            <p className="mt-2 text-sm text-faint">No activity logged yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {actions.map((a) => {
                const value = money(a.valueImpactCents);
                return (
                  <li key={a.id} className="rounded-card border border-line px-3 py-2.5">
                    <div className="flex justify-between text-sm">
                      <span>{a.summary}</span>
                      {value && <span className="font-data text-xs text-green">{value}</span>}
                    </div>
                    <p className="font-data text-xs text-faint">
                      {a.createdAt.toISOString().slice(0, 10)} · {a.kind}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
