import { Logo, Panel } from "@/components/ui";
import { RequestLinkForm } from "./request-form";

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 self-center">
        <Logo className="text-xl" />
      </div>
      <Panel>
        <h1 className="text-xl font-semibold">Client portal</h1>
        <p className="mt-1 text-sm text-muted">
          Passwordless sign-in. We&apos;ll email you a single-use link.
        </p>
        <div className="mt-6">
          <RequestLinkForm tenant={tenant} />
        </div>
      </Panel>
    </main>
  );
}
