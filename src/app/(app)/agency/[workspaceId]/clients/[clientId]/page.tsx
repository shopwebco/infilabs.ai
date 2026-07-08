import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireMembership } from "@/lib/agency/workspace";
import { assertClientAccess } from "@/lib/agency/clients";
import { listWorkItems } from "@/lib/agency/workitems";
import { ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { Logo, Panel } from "@/components/ui";
import { WorkItems } from "./work-items";

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
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

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
      </section>
    </main>
  );
}
