"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

async function startAndRedirect(path: string): Promise<string | null> {
  const res = await fetch(path, { method: "POST" });
  const data = (await res.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;
  if (!res.ok || !data?.url) {
    return data?.error ?? "Something went wrong. Please try again.";
  }
  window.location.href = data.url;
  return null;
}

export function UpgradeButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <div className="space-y-2">
      <Button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(await startAndRedirect("/api/billing/checkout"));
          setLoading(false);
        }}
      >
        {loading ? "Starting checkout…" : "Upgrade to Pro"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}

export function ManageBillingButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(await startAndRedirect("/api/billing/portal"));
          setLoading(false);
        }}
      >
        {loading ? "Opening…" : "Manage billing"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
