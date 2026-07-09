import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listUserBriefings, type BriefingBody } from "@/lib/briefings/generate";
import { Logo, Panel } from "@/components/ui";

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function BriefingsPage() {
  const user = await requireUser();
  const briefings = await listUserBriefings(user.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <Link href="/dashboard" className="text-sm text-muted hover:text-text">
          ← Dashboard
        </Link>
      </header>

      <section className="py-8">
        <h1 className="text-2xl font-semibold">Briefings</h1>
        <p className="mt-1 text-muted">
          What the agent did and what needs your decision — generated from your
          real activity.
        </p>

        {briefings.length === 0 ? (
          <p className="mt-6 text-sm text-faint">
            No briefings yet. They&apos;re generated on a schedule
            {user.plan === "STARTER" ? " (weekly on Starter)" : " (daily)"}.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {briefings.map((b) => {
              const body = b.body as unknown as BriefingBody;
              return (
                <Panel key={b.id}>
                  <div className="flex items-center justify-between">
                    <span className="font-data text-xs text-muted">
                      {b.cadence} · {b.periodStart.toISOString().slice(0, 10)} →{" "}
                      {b.periodEnd.toISOString().slice(0, 10)}
                    </span>
                    {b.valueRecoveredCents > 0 && (
                      <span className="font-data text-xs text-green">
                        {money(b.valueRecoveredCents)} recovered
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm">{body.headline}</p>
                  {!body.quiet && body.actions.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm text-muted">
                      {body.actions.slice(0, 8).map((a, i) => (
                        <li key={i}>· {a.summary}</li>
                      ))}
                    </ul>
                  )}
                </Panel>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
