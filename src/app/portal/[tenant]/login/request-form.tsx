"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

export function RequestLinkForm({ tenant }: { tenant: string }) {
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/portal/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientProjectId: tenant,
        email: String(form.get("email") ?? ""),
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { sent?: boolean; devLink?: string; error?: string }
      | null;
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not send the link.");
      return;
    }
    setSent(true);
    setDevLink(data?.devLink ?? null);
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green">
          If that email has portal access, a single-use sign-in link is on its way.
        </p>
        {devLink && (
          <div className="rounded-card border border-line bg-black/20 p-3">
            <p className="text-xs text-muted">
              Email isn&apos;t configured on this deployment — use this link (dev):
            </p>
            <a
              href={devLink}
              className="mt-1 block break-all font-data text-xs text-ice underline"
            >
              {devLink}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
