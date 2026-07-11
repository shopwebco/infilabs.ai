"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

type Item = {
  id: string;
  title: string;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED";
  createdById: string | null;
};

const STATUS_LABEL: Record<Item["status"], string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  PUBLISHED: "Published",
};

export function WorkItems({
  clientProjectId,
  role,
  userId,
  items,
}: {
  clientProjectId: string;
  role: "ADMIN" | "MANAGER" | "STAFF";
  userId: string;
  items: Item[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canReview = role === "ADMIN" || role === "MANAGER";

  async function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setBusy(true);
    setError(null);
    const form = new FormData(formEl);
    const res = await fetch("/api/agency/workitems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientProjectId,
        title: String(form.get("title") ?? ""),
        body: String(form.get("body") ?? ""),
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not create draft.");
      return;
    }
    formEl.reset();
    router.refresh();
  }

  async function transition(id: string, action: "submit" | "approve" | "publish") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/agency/workitems/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? `Could not ${action}.`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createDraft} className="space-y-3">
        <Input label="Draft title" name="title" type="text" required />
        <label className="block space-y-1.5">
          <span className="text-sm text-muted">Draft content</span>
          <textarea
            name="body"
            required
            rows={3}
            className="w-full rounded-card border border-line bg-black/30 px-3 py-2.5 text-sm text-text placeholder:text-faint focus:border-ice-dim focus:outline-none focus:ring-1 focus:ring-ice-dim"
          />
        </label>
        <Button type="submit" disabled={busy}>
          Create draft
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm text-faint">No work items yet.</li>
        )}
        {items.map((item) => {
          const isOwner = item.createdById === userId;
          return (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-card border border-line px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="font-data text-xs text-muted" data-testid="wi-status">
                  {STATUS_LABEL[item.status]}
                </p>
              </div>
              <div className="flex gap-2">
                {item.status === "DRAFT" && (isOwner || canReview) && (
                  <Button variant="ghost" disabled={busy} onClick={() => transition(item.id, "submit")}>
                    Submit for review
                  </Button>
                )}
                {item.status === "IN_REVIEW" && canReview && (
                  <Button disabled={busy} onClick={() => transition(item.id, "approve")}>
                    Approve
                  </Button>
                )}
                {item.status === "APPROVED" && canReview && (
                  <Button disabled={busy} onClick={() => transition(item.id, "publish")}>
                    Publish
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
