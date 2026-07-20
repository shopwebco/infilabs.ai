import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireMembership } from "@/lib/agency/workspace";
import { assertClientAccess } from "@/lib/agency/clients";
import { listWorkItems } from "@/lib/agency/workitems";
import { listPortalUsers, listClientApprovals } from "@/lib/agency/portal-users";
import { ForbiddenError, NotFoundError, hasRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { Logo, Panel } from "@/components/ui";
import { WorkItems } from "./work-items";
import { AgencyClientExtras } from "./agency-extras";
import { InvoiceForm } from "./invoice-form";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ workspaceId: string; clientId: string }>;
}) {
  const { workspaceId, clientId } = await params;
  const user = await requireUser();

  let membership;
  let client;
  try {
    membership = await requireMembership(user.id, workspaceId);
    client = await assertClientAccess(membership, clientId);
  } catch (err) {
    // Not a member, not assigned, or wrong tenant → hide existence.
    if (err instanceof ForbiddenError || err instanceof NotFoundError) notFound();
    throw err;
  }

  // Extra safety: the client's workspace must equal the URL workspace.
  if (client.workspaceId !== workspaceId) notFound();

  const items = await listWorkItems(membership, clientId);
  const canManage = hasRole(membership.role, "MANAGER");
  const [workspace, portalUsers, approvals, invoices] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, connectOnboarded: true },
    }),
    canManage ? listPortalUsers(membership, clientId) : Promise.resolve([]),
    canManage ? listClientApprovals(membership, clientId) : Promise.resolve([]),
    canManage
      ? prisma.clientInvoice.findMany({
          where: { clientProjectId: clientId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            amountCents: true,
            status: true,
            recurring: true,
            hostedInvoiceUrl: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <div className="flex items-center gap-4 text-sm">
          <span className="font-data text-xs text-muted">{membership.role}</span>
          <Link
            href={`/agency/${workspaceId}`}
            className="text-muted hover:text-text"
          >
            ← {workspace?.name ?? "Workspace"}
          </Link>
        </div>
      </header>

      <section className="py-8">
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <p className="mt-1 text-muted">
          Review queue: drafts move Draft → In review → Approved → Published.
          {membership.role === "STAFF" &&
            " As staff, your drafts require a manager to approve and publish."}
        </p>

        <div className="mt-6">
          <Panel>
            <WorkItems
              clientProjectId={clientId}
              role={membership.role}
              userId={user.id}
              items={items.map((i) => ({
                id: i.id,
                title: i.title,
                status: i.status,
                createdById: i.createdById,
              }))}
            />
          </Panel>
        </div>

        {canManage && (
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">Client portal</h2>
            <Panel>
              <AgencyClientExtras clientId={clientId} />
            </Panel>

            <div className="grid gap-4 sm:grid-cols-2">
              <Panel>
                <h3 className="text-sm font-semibold text-muted">Portal users</h3>
                {portalUsers.length === 0 ? (
                  <p className="mt-2 text-sm text-faint">None yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {portalUsers.map((p) => (
                      <li key={p.id}>{p.email}</li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel>
                <h3 className="text-sm font-semibold text-muted">Approvals</h3>
                {approvals.length === 0 ? (
                  <p className="mt-2 text-sm text-faint">None yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {approvals.map((a) => (
                      <li key={a.id} className="flex justify-between">
                        <span>{a.title}</span>
                        <span className="font-data text-xs text-muted">{a.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <h2 className="pt-4 text-lg font-semibold">Client billing</h2>
            {workspace?.connectOnboarded ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Panel>
                  <h3 className="text-sm font-semibold text-muted">
                    New invoice / retainer
                  </h3>
                  <div className="mt-3">
                    <InvoiceForm clientId={clientId} />
                  </div>
                </Panel>
                <Panel>
                  <h3 className="text-sm font-semibold text-muted">Invoices</h3>
                  {invoices.length === 0 ? (
                    <p className="mt-2 text-sm text-faint">No invoices yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {invoices.map((inv) => (
                        <li key={inv.id} className="flex justify-between">
                          <span>${(inv.amountCents / 100).toFixed(2)}</span>
                          <span className="font-data text-xs text-muted">
                            {inv.recurring ? "retainer" : "one-off"} · {inv.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            ) : (
              <Panel className="border-amber/30">
                <p className="text-sm text-amber">
                  Client billing unlocks after your workspace admin connects
                  Stripe and completes onboarding.
                </p>
              </Panel>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
