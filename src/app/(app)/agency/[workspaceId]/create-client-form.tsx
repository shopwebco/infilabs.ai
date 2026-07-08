"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function CreateClientForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setLoading(true);
    setError(null);
    const form = new FormData(formEl);
    const res = await fetch("/api/agency/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name: String(form.get("name") ?? "") }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not create client.");
      return;
    }
    formEl.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input label="New client project" name="name" type="text" required />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Adding…" : "Add client"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
    </form>
  );
}
