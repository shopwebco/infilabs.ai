import { Logo } from "@/components/ui";
import type { Brand } from "@/lib/whitelabel";

/**
 * Portal header themed from the agency's white-label settings. When hideXenon is
 * set, Xenon branding is replaced by the agency's brand name/logo in its accent.
 */
export function PortalBrandHeader({
  brand,
  right,
}: {
  brand: Brand;
  right?: React.ReactNode;
}) {
  return (
    <>
      <div aria-hidden style={{ height: 3, background: brand.accentColor }} />
      <header className="flex items-center justify-between border-b border-line pb-6 pt-4">
        {brand.hideXenon ? (
          <span className="flex items-center gap-2">
            {brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={brand.brandName} className="h-6 w-auto" />
            )}
            <span
              className="font-display text-lg font-bold tracking-tight"
              style={{ color: brand.accentColor }}
              data-testid="brand-name"
            >
              {brand.brandName}
            </span>
          </span>
        ) : (
          <Logo />
        )}
        {right}
      </header>
    </>
  );
}
