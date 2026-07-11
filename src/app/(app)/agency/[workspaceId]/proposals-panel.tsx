"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function ProposalsPanel({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setBusy(true);
    setError(null);
    setUrl(null);
    const form = new FormData(formEl);
    const res = await fetch("/api/agency/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        title: String(form.get("title") ?? ""),
        prospectUrl: String(form.get("prospectUrl") ?? ""),
        inputs: String(form.get("inputs") ?? ""),
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { url?: string; error?: string }
      | null;
    setBusy(false);
    if (!res.ok || !data?.url) {
      setError(data?.error ?? "Could not create proposal.");
      return;
    }
    formEl.reset();
    setUrl(data.url);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input label="Prospect name / title" name="title" type="text" required />
      <Input label="Store URL (optional)" name="prospectUrl" type="text" />
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">
          What you know about this prospect (the agent uses only this — no invented data)
        </span>
        <textarea
          name="inputs"
          required
          rows={3}
          className="w-full rounded-card border border-line bg-black/30 px-3 py-2.5 text-sm text-text focus:border-ice-dim focus:outline-none focus:ring-1 focus:ring-ice-dim"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
      {url && (
        <p className="text-sm text-green">
          Created —{" "}
          <a href={url} className="font-data text-xs text-ice underline">
            {url}
          </a>
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Generating…" : "Generate proposal"}
      </Button>
    </form>
  );
}
