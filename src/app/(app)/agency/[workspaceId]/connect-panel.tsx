"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function ConnectPanel({
  workspaceId,
  connectOnboarded,
  hasAccount,
}: {
  workspaceId: string;
  connectOnboarded: boolean;
  hasAccount: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onboard() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/agency/connect/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    const data = (await res.json().catch(() => null)) as
      | { url?: string; error?: string }
      | null;
    setBusy(false);
    if (!res.ok || !data?.url) {
      setError(data?.error ?? "Could not start onboarding.");
      return;
    }
    window.location.href = data.url; // Stripe-hosted onboarding
  }

  async function refresh() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/agency/connect/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not refresh status.");
      return;
    }
    router.refresh();
  }

  if (connectOnboarded) {
    return (
      <p className="text-sm text-green">
        Stripe connected — you can bill clients. Funds go directly to your Stripe
        account.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {hasAccount
          ? "Onboarding started but not finished. Continue in Stripe, then refresh."
          : "Connect your own Stripe account to invoice clients. Xenon never holds your funds."}
      </p>
      <div className="flex gap-2">
        <Button disabled={busy} onClick={onboard}>
          {busy ? "…" : hasAccount ? "Continue onboarding" : "Connect Stripe"}
        </Button>
        {hasAccount && (
          <Button variant="ghost" disabled={busy} onClick={refresh}>
            Refresh status
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
