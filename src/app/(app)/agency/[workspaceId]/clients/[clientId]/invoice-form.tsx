"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function InvoiceForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setBusy(true);
    setError(null);
    setCreated(null);
    const form = new FormData(formEl);
    const amount = Math.round(parseFloat(String(form.get("amount") ?? "0")) * 100);
    const res = await fetch(`/api/agency/clients/${clientId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerEmail: String(form.get("email") ?? ""),
        description: String(form.get("description") ?? ""),
        amountCents: amount,
        recurring: form.get("recurring") === "on",
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { kind?: string; error?: string }
      | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not create the invoice.");
      return;
    }
    formEl.reset();
    setCreated(data?.kind === "retainer" ? "Monthly retainer created." : "Invoice created.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input label="Bill to (client email)" name="email" type="email" required />
      <Input label="Description" name="description" type="text" required />
      <Input label="Amount (USD)" name="amount" type="number" min="1" step="0.01" required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="recurring" />
        Monthly retainer (recurring)
      </label>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
      {created && <p className="text-sm text-green">{created}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create on Stripe"}
      </Button>
    </form>
  );
}
