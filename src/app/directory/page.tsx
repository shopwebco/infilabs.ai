import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Logo, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  // Only platform-admin-approved agencies appear here.
  const listed = await prisma.workspace.findMany({
    where: { directoryListed: true },
    select: {
      id: true,
      name: true,
      whiteLabel: { select: { brandName: true, accentColor: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <Link href="/" className="text-sm text-muted hover:text-text">
          ← Home
        </Link>
      </header>

      <section className="py-8">
        <h1 className="text-2xl font-semibold">Certified agencies</h1>
        <p className="mt-1 text-muted">Agencies building on Xenon.</p>

        {listed.length === 0 ? (
          <p className="mt-6 text-sm text-faint">No listed agencies yet.</p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {listed.map((w) => (
              <Panel key={w.id}>
                <span
                  className="font-display text-lg font-semibold"
                  style={{ color: w.whiteLabel?.accentColor ?? undefined }}
                >
                  {w.whiteLabel?.brandName ?? w.name}
                </span>
              </Panel>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
