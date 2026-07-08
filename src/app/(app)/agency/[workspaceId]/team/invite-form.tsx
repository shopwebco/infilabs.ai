"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setLoading(true);
    setError(null);
    setAcceptUrl(null);
    const form = new FormData(formEl);
    const res = await fetch("/api/agency/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        email: String(form.get("email") ?? ""),
        role: String(form.get("role") ?? "STAFF"),
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { acceptUrl?: string; error?: string }
      | null;
    setLoading(false);
    if (!res.ok || !data?.acceptUrl) {
      setError(data?.error ?? "Could not create invite.");
      return;
    }
    formEl.reset();
    setAcceptUrl(data.acceptUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input label="Invite email" name="email" type="email" required />
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Role</span>
        <select
          name="role"
          defaultValue="STAFF"
          className="w-full rounded-card border border-line bg-black/30 px-3 py-2.5 text-sm text-text"
        >
          <option value="STAFF">Staff</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>
      <Button type="submit" disabled={loading}>
        {loading ? "Creating…" : "Create invite"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
      {acceptUrl && (
        <div className="rounded-card border border-line bg-black/20 p-3">
          <p className="text-xs text-muted">
            Email delivery arrives in a later phase. Share this single-use invite
            link:
          </p>
          <code className="mt-1 block break-all font-data text-xs text-ice">
            {acceptUrl}
          </code>
        </div>
      )}
    </form>
  );
}
