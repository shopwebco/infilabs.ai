import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listUserWorkspaces } from "@/lib/agency/workspace";
import { Logo, Panel } from "@/components/ui";
import { CreateWorkspaceForm } from "./create-workspace-form";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export default async function AgencyHome() {
  const user = await requireUser();
  const workspaces = await listUserWorkspaces(user.id);
  const canCreate = user.plan === "AGENCY";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <Link href="/dashboard" className="text-sm text-muted hover:text-text">
          ← Dashboard
        </Link>
      </header>

      <section className="py-8">
        <h1 className="text-2xl font-semibold">Agency workspaces</h1>

        {workspaces.length > 0 && (
          <div className="mt-6 space-y-3">
            {workspaces.map((w) => (
              <Link key={w.id} href={`/agency/${w.id}`} className="block">
                <Panel className="flex items-center justify-between hover:border-ice-dim/40">
                  <span className="font-medium">{w.name}</span>
                  <span className="font-data text-xs text-muted">
                    {ROLE_LABEL[w.role] ?? w.role}
                  </span>
                </Panel>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8">
          {canCreate ? (
            <Panel>
              <h2 className="text-base font-semibold">Create a workspace</h2>
              <p className="mt-1 mb-4 text-sm text-muted">
                Manage client projects, your team, and approvals.
              </p>
              <CreateWorkspaceForm />
            </Panel>
          ) : (
            workspaces.length === 0 && (
              <Panel className="border-amber/30">
                <p className="text-sm text-amber">
                  Creating an agency workspace requires the{" "}
                  <span className="font-semibold">Agency</span> plan. Upgrade from{" "}
                  <Link href="/dashboard/billing" className="underline">
                    Billing
                  </Link>
                  .
                </p>
              </Panel>
            )
          )}
        </div>
      </section>
    </main>
  );
}
