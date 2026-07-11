"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    const res = await fetch("/api/agency/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json().catch(() => null)) as
      | { workspaceId?: string; role?: string; error?: string }
      | null;
    setLoading(false);
    if (!res.ok || !data?.workspaceId) {
      setState("error");
      setMessage(data?.error ?? "This invite could not be accepted.");
      return;
    }
    setState("done");
    setWorkspaceId(data.workspaceId);
    router.refresh();
  }

  if (state === "done" && workspaceId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-green">You&apos;ve joined the workspace.</p>
        <Link href={`/agency/${workspaceId}`}>
          <Button>Go to workspace</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        You were invited to join an agency workspace. Accept to gain access.
      </p>
      {state === "error" && message && (
        <p role="alert" className="text-sm text-red">
          {message}
        </p>
      )}
      <Button onClick={accept} disabled={loading || state === "error"}>
        {loading ? "Accepting…" : "Accept invite"}
      </Button>
    </div>
  );
}
