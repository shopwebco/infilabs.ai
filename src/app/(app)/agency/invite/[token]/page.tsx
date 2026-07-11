import { requireUser } from "@/lib/auth/session";
import { Logo, Panel } from "@/components/ui";
import { AcceptInvite } from "./accept-invite";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Must be signed in as the invited email to accept (enforced server-side on POST).
  await requireUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 self-center">
        <Logo className="text-xl" />
      </div>
      <Panel>
        <h1 className="text-xl font-semibold">Join workspace</h1>
        <div className="mt-4">
          <AcceptInvite token={token} />
        </div>
      </Panel>
    </main>
  );
}
