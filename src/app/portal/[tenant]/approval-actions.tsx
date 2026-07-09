"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function ApprovalActions({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "decline") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/portal/approvals/${approvalId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not record your decision.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Button disabled={busy} onClick={() => decide("approve")}>
        Approve
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => decide("decline")}>
        Decline
      </Button>
      {error && (
        <span role="alert" className="text-sm text-red">
          {error}
        </span>
      )}
    </div>
  );
}
