import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireMembership } from "@/lib/agency/workspace";
import { listAccessibleClients } from "@/lib/agency/clients";
import { hasRole, ForbiddenError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { Logo, Panel } from "@/components/ui";
import { CreateClientForm } from "./create-client-form";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  let membership;
  try {
    membership = await requireMembership(user.id, workspaceId);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const [workspace, clients] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
    listAccessibleClients(membership),
  ]);
  if (!workspace) notFound();

  const canManage = hasRole(membership.role, "MANAGER");
  const isAdmin = membership.role === "ADMIN";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <div className="flex items-center gap-4 text-sm">
          <span className="font-data text-xs text-muted">{membership.role}</span>
          {isAdmin && (
            <Link
              href={`/agency/${workspaceId}/team`}
              className="text-ice hover:underline"
            >
              Team
            </Link>
          )}
          <Link href="/agency" className="text-muted hover:text-text">
            ← Workspaces
          </Link>
        </div>
      </header>

      <section className="py-8">
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        <p className="mt-1 text-muted">
          {isAdmin
            ? "All client projects in this workspace."
            : "Client projects assigned to you."}
        </p>

        <div className="mt-6 space-y-3">
          {clients.length === 0 ? (
            <p className="text-sm text-faint">No client projects yet.</p>
          ) : (
            clients.map((c) => (
              <Link
                key={c.id}
                href={`/agency/${workspaceId}/clients/${c.id}`}
                className="block"
              >
                <Panel className="flex items-center justify-between hover:border-ice-dim/40">
                  <span className="font-medium">{c.name}</span>
                  {c.archived && (
                    <span className="font-data text-xs text-faint">archived</span>
                  )}
                </Panel>
              </Link>
            ))
          )}
        </div>

        {canManage && (
          <div className="mt-8">
            <Panel>
              <CreateClientForm workspaceId={workspaceId} />
            </Panel>
          </div>
        )}
      </section>
    </main>
  );
}
