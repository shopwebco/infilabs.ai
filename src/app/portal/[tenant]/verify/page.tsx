import Link from "next/link";
import { Logo, Panel } from "@/components/ui";
import { VerifyClient } from "./verify-client";

export default async function PortalVerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { tenant } = await params;
  const { token } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 self-center">
        <Logo className="text-xl" />
      </div>
      <Panel>
        {token ? (
          <VerifyClient tenant={tenant} token={token} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red">This link is missing its token.</p>
            <Link
              href={`/portal/${tenant}/login`}
              className="text-sm text-ice underline"
            >
              Request a new link
            </Link>
          </div>
        )}
      </Panel>
    </main>
  );
}
