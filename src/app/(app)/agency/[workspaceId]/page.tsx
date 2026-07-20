import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireMembership } from "@/lib/agency/workspace";
import { listAccessibleClients } from "@/lib/agency/clients";
import { listProposals } from "@/lib/proposals";
import { appUrl } from "@/lib/stripe/checkout";
import { hasRole, ForbiddenError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { Logo, Panel } from "@/components/ui";
import { CreateClientForm } from "./create-client-form";
import { ProposalsPanel } from "./proposals-panel";
import { ConnectPanel } from "./connect-panel";

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

  const canManage = hasRole(membership.role, "MANAGER");
  const [workspace, clients, proposals] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        name: true,
        referralCode: true,
        stripeConnectAccountId: true,
        connectOnboarded: true,
      },
    }),
    listAccessibleClients(membership),
    canManage ? listProposals(membership) : Promise.resolve([]),
  ]);
  if (!workspace) notFound();

  const isAdmin = membership.role === "ADMIN";
  const referralUrl = `${appUrl()}/signup?ref=${workspace.referralCode}`;

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

        {isAdmin && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Agency billing (Stripe Connect)</h2>
            <Panel className="mt-3">
              <ConnectPanel
                workspaceId={workspaceId}
                connectOnboarded={workspace.connectOnboarded}
                hasAccount={Boolean(workspace.stripeConnectAccountId)}
              />
            </Panel>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-lg font-semibold">Referrals</h2>
          <Panel className="mt-3">
            <p className="text-sm text-muted">
              Share your referral link — you earn recurring commission on signups.
            </p>
            <code className="mt-2 block break-all font-data text-xs text-ice">
              {referralUrl}
            </code>
          </Panel>
        </div>

        {canManage && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Proposals</h2>
            <p className="mt-1 text-sm text-muted">
              Generate a branded, shareable audit page for a prospect.
            </p>
            <Panel className="mt-3">
              <ProposalsPanel workspaceId={workspaceId} />
            </Panel>
            {proposals.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {proposals.map((p) => (
                  <li key={p.id}>
                    <a
                      href={`/proposals/${p.publicSlug}`}
                      className="text-ice hover:underline"
                    >
                      {p.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
