import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireMembership } from "@/lib/agency/workspace";
import { listWorkspaceMembers } from "@/lib/agency/clients";
import { listPendingInvites } from "@/lib/agency/invites";
import { getWhiteLabel } from "@/lib/whitelabel";
import { ForbiddenError } from "@/lib/auth/rbac";
import { Logo, Panel } from "@/components/ui";
import { InviteForm } from "./invite-form";
import { WhiteLabelForm } from "./whitelabel-form";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  let membership;
  try {
    // Team management is ADMIN-only — enforced server-side.
    membership = await requireMembership(user.id, workspaceId, "ADMIN");
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const [members, invites, whiteLabel] = await Promise.all([
    listWorkspaceMembers(workspaceId),
    listPendingInvites(membership),
    getWhiteLabel(workspaceId),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <Link
          href={`/agency/${workspaceId}`}
          className="text-sm text-muted hover:text-text"
        >
          ← Workspace
        </Link>
      </header>

      <section className="py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <div className="mt-4 space-y-2">
            {members.map((m) => (
              <Panel key={m.id} className="flex items-center justify-between">
                <span className="text-sm">
                  {m.user.name ?? m.user.email}{" "}
                  <span className="text-muted">({m.user.email})</span>
                </span>
                <span className="font-data text-xs text-muted">{m.role}</span>
              </Panel>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Panel>
            <h2 className="text-base font-semibold">Invite a teammate</h2>
            <div className="mt-3">
              <InviteForm workspaceId={workspaceId} />
            </div>
          </Panel>

          <Panel>
            <h2 className="text-base font-semibold">Pending invites</h2>
            {invites.length === 0 ? (
              <p className="mt-3 text-sm text-faint">No pending invites.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {invites.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{i.email}</span>
                    <span className="font-data text-xs text-muted">{i.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div>
          <h2 className="text-lg font-semibold">White-label</h2>
          <p className="mt-1 text-sm text-muted">
            Brand the client portal and emails. Custom domains resolve to this
            workspace.
          </p>
          <Panel className="mt-4">
            <WhiteLabelForm
              workspaceId={workspaceId}
              initial={{
                brandName: whiteLabel?.brandName ?? "",
                accentColor: whiteLabel?.accentColor ?? "#2DD4BF",
                logoUrl: whiteLabel?.logoUrl ?? "",
                customDomain: whiteLabel?.customDomain ?? "",
                emailFrom: whiteLabel?.emailFrom ?? "",
                hideXenon: whiteLabel?.hideXenon ?? true,
              }}
            />
          </Panel>
        </div>
      </section>
    </main>
  );
}
