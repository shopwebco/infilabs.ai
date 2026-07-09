import { getBrandForClientProject } from "@/lib/whitelabel";
import { Logo, Panel } from "@/components/ui";
import { RequestLinkForm } from "./request-form";

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const brand = await getBrandForClientProject(tenant);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 self-center">
        {brand.hideXenon ? (
          <span className="flex items-center gap-2">
            {brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={brand.brandName} className="h-7 w-auto" />
            )}
            <span
              className="font-display text-xl font-bold tracking-tight"
              style={{ color: brand.accentColor }}
              data-testid="brand-name"
            >
              {brand.brandName}
            </span>
          </span>
        ) : (
          <Logo className="text-xl" />
        )}
      </div>
      <Panel>
        <h1 className="text-xl font-semibold">{brand.brandName} portal</h1>
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
