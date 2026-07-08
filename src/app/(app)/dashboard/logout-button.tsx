"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";

export function LogoutButton() {
  return (
    <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
      Log out
    </Button>
  );
}
