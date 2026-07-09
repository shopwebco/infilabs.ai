import { notFound } from "next/navigation";
import { resolveWorkspaceByHost, getWorkspaceBrand } from "@/lib/whitelabel";
import { Panel } from "@/components/ui";
import { WorkspaceLoginForm } from "./workspace-login";

/**
 * Landing for a mapped custom domain. The middleware rewrote the custom host to
 * /d/<host>; here we resolve host → workspace (via WhiteLabelSettings.customDomain)
 * and render that agency's branded portal login. Unknown host → 404.
 */
export default async function CustomDomainPage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const decodedHost = decodeURIComponent(host);
  const workspaceId = await resolveWorkspaceByHost(decodedHost);
  if (!workspaceId) notFound();

  const brand = await getWorkspaceBrand(workspaceId);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div aria-hidden style={{ height: 4, background: brand.accentColor }} className="mb-8" />
      <div className="mb-6 self-center">
        <span className="flex items-center gap-2">
          {brand.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.brandName} className="h-8 w-auto" />
          )}
          <span
            className="font-display text-2xl font-bold tracking-tight"
            style={{ color: brand.accentColor }}
            data-testid="brand-name"
          >
            {brand.brandName}
          </span>
        </span>
      </div>
      <Panel>
        <h1 className="text-xl font-semibold">Client portal</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in with your email to view your project.
        </p>
        <div className="mt-6">
          <WorkspaceLoginForm workspaceId={workspaceId} />
        </div>
      </Panel>
    </main>
  );
}
