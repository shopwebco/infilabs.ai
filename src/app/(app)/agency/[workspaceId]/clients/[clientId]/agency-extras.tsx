"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function AgencyClientExtras({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: unknown, formEl: HTMLFormElement) {
    setBusy(true);
    setError(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Something went wrong.");
      return;
    }
    formEl.reset();
    router.refresh();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const fd = new FormData(f);
          post(
            `/api/agency/clients/${clientId}/portal-users`,
            { email: String(fd.get("email") ?? "") },
            f,
          );
        }}
      >
        <Input label="Add portal user (email)" name="email" type="email" required />
        <Button type="submit" variant="ghost" disabled={busy}>
          Add portal user
        </Button>
      </form>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const fd = new FormData(f);
          post(
            `/api/agency/clients/${clientId}/approvals`,
            {
              title: String(fd.get("title") ?? ""),
              detail: String(fd.get("detail") ?? ""),
            },
            f,
          );
        }}
      >
        <Input label="Request client approval — title" name="title" type="text" required />
        <Input label="Detail" name="detail" type="text" required />
        <Button type="submit" disabled={busy}>
          Request approval
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red sm:col-span-2">
          {error}
        </p>
      )}
    </div>
  );
}
