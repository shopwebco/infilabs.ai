"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function DirectoryToggle({
  workspaceId,
  listed,
}: {
  workspaceId: string;
  listed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch("/api/admin/directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, listed: !listed }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <Button variant={listed ? "ghost" : "primary"} disabled={busy} onClick={toggle}>
      {listed ? "Unlist" : "Approve listing"}
    </Button>
  );
}
