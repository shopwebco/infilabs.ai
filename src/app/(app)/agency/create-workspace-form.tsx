"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/agency/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(form.get("name") ?? "") }),
    });
    const data = (await res.json().catch(() => null)) as
      | { workspace?: { id: string }; error?: string }
      | null;
    setLoading(false);
    if (!res.ok || !data?.workspace) {
      setError(data?.error ?? "Could not create workspace.");
      return;
    }
    router.push(`/agency/${data.workspace.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input label="Agency name" name="name" type="text" required minLength={2} />
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}
