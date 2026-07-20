"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function AmazonConnectButton() {
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    // The route 302s to Amazon when configured; fetch first so an unconfigured
    // deployment surfaces its honest 503 message instead of a broken redirect.
    const res = await fetch("/api/integrations/amazon/connect", { redirect: "manual" });
    if (res.type === "opaqueredirect" || res.status === 0) {
      window.location.href = "/api/integrations/amazon/connect";
      return;
    }
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setError(data?.error ?? "Could not start the Amazon connection.");
  }

  return (
    <div className="space-y-2">
      <Button onClick={connect}>Connect Amazon</Button>
      {error && (
        <p role="alert" className="text-sm text-amber">
          {error}
        </p>
      )}
    </div>
  );
}

export function AmazonSyncButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integrations/amazon/sync", { method: "POST" });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Sync failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button variant="ghost" disabled={busy} onClick={sync}>
        {busy ? "Syncing…" : "Sync now"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
