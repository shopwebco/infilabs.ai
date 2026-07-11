"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function PortalLogoutButton({ tenant }: { tenant: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await fetch("/api/portal/logout", { method: "POST" });
        router.push(`/portal/${tenant}/login`);
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
