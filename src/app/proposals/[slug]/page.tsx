import { notFound } from "next/navigation";
import { getProposalBySlug } from "@/lib/proposals";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const proposal = await getProposalBySlug(slug);
  if (!proposal) notFound();

  const wl = proposal.workspace.whiteLabel;
  const accent = wl?.accentColor ?? "#67E8F9";
  const brandName = wl?.hideXenon ? wl.brandName : (wl?.brandName ?? "Xenon");
  const body = proposal.body as { generatedText?: string };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div aria-hidden style={{ height: 4, background: accent }} className="mb-8" />
      <p className="font-display text-lg font-bold" style={{ color: accent }}>
        {brandName}
      </p>
      <h1 className="mt-2 text-3xl font-bold">{proposal.title}</h1>
      {proposal.prospectUrl && (
        <p className="mt-1 font-data text-xs text-muted">{proposal.prospectUrl}</p>
      )}
      <article className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-text">
        {body.generatedText ?? ""}
      </article>
    </main>
  );
}
