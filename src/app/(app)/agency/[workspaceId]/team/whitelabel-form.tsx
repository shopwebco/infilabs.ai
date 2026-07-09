"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

type Initial = {
  brandName: string;
  accentColor: string;
  logoUrl: string;
  customDomain: string;
  emailFrom: string;
  hideXenon: boolean;
};

export function WhiteLabelForm({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/agency/whitelabel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        brandName: String(form.get("brandName") ?? ""),
        accentColor: String(form.get("accentColor") ?? ""),
        logoUrl: String(form.get("logoUrl") ?? ""),
        customDomain: String(form.get("customDomain") ?? ""),
        emailFrom: String(form.get("emailFrom") ?? ""),
        hideXenon: form.get("hideXenon") === "on",
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input label="Brand name" name="brandName" defaultValue={initial.brandName} required />
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Accent color</span>
        <input
          name="accentColor"
          type="color"
          defaultValue={initial.accentColor || "#2DD4BF"}
          className="h-10 w-16 rounded-card border border-line bg-black/30"
        />
      </label>
      <Input label="Logo URL (optional)" name="logoUrl" defaultValue={initial.logoUrl} />
      <Input
        label="Custom domain (optional)"
        name="customDomain"
        defaultValue={initial.customDomain}
        placeholder="portal.agency.com"
      />
      <Input label="Email from (optional)" name="emailFrom" defaultValue={initial.emailFrom} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hideXenon" defaultChecked={initial.hideXenon} />
        Hide Xenon branding in the client portal
      </label>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-green">Saved.</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save white-label"}
      </Button>
    </form>
  );
}
