import Link from "next/link";
import { Button, Logo, Panel } from "@/components/ui";

const capabilities = [
  {
    title: "One agent, not 30 tools",
    body: "Research, monitor, and optimize your marketplace business through a single AI agent instead of a wall of dashboards.",
  },
  {
    title: "Humans approve every decision",
    body: "The agent proposes bids, prices, and restocks — nothing executes until a human approves it. Every action is logged.",
  },
  {
    title: "Built for agencies",
    body: "Manage many client projects, white-label the portal, and bill clients through your own Stripe account.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted hover:text-text">
            Log in
          </Link>
          <Link href="/signup">
            <Button>Get started</Button>
          </Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="font-data text-xs uppercase tracking-[0.2em] text-ice-dim">
          AI-native seller &amp; agency platform
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          The marketplace command center that{" "}
          <span className="text-ice">thinks</span> and{" "}
          <span className="text-violet-soft">acts</span> for you.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Xenon replaces the 30-tool sprawl with one agent for Amazon, Walmart,
          TikTok Shop, and Shopify sellers — and the agencies that serve them.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup">
            <Button className="px-6 py-3 text-base">Create your account</Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" className="px-6 py-3 text-base">
              Log in
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {capabilities.map((c) => (
            <Panel key={c.title}>
              <h2 className="text-base font-semibold">{c.title}</h2>
              <p className="mt-2 text-sm text-muted">{c.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      <footer className="border-t border-line py-6 text-sm text-faint">
        © {new Date().getFullYear()} Xenon. Connect a marketplace account to see
        your live data — nothing here is fabricated.
      </footer>
    </main>
  );
}
