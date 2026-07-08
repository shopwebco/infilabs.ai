import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { isAgentConfigured } from "@/lib/agent/client";
import { getAgentUsage, STARTER_MONTHLY_QUERY_LIMIT } from "@/lib/agent/usage";
import { Logo, Panel } from "@/components/ui";
import { AgentChat } from "./agent-chat";

export default async function AgentPage() {
  const user = await requireUser();
  const configured = isAgentConfigured();
  const isStarter = user.plan === "STARTER";
  const usage = isStarter ? await getAgentUsage(user.id) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-6">
        <Logo />
        <Link href="/dashboard" className="text-sm text-muted hover:text-text">
          ← Dashboard
        </Link>
      </header>

      <section className="py-8">
        <h1 className="text-2xl font-semibold">AI Agent</h1>
        <p className="mt-1 text-muted">
          Scoped to your account. It reports only what your Xenon data contains —
          no fabricated marketplace metrics.
        </p>

        {isStarter && usage !== null && (
          <p className="mt-2 text-sm text-muted">
            Queries this month:{" "}
            <span className="font-data text-text">
              {usage} / {STARTER_MONTHLY_QUERY_LIMIT}
            </span>
          </p>
        )}

        {!configured && (
          <Panel className="mt-6 border-amber/30">
            <p className="text-sm text-amber">
              The AI agent isn&apos;t configured on this deployment yet. An
              <span className="font-data"> ANTHROPIC_API_KEY</span> must be set
              before it can respond. Nothing here is simulated.
            </p>
          </Panel>
        )}

        <div className="mt-6">
          <Panel>
            <AgentChat />
          </Panel>
        </div>
      </section>
    </main>
  );
}
