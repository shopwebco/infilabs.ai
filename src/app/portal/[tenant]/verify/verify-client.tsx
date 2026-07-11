"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function VerifyClient({ tenant, token }: { tenant: string; token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // single-use token: never POST twice
    ran.current = true;

    (async () => {
      const res = await fetch("/api/portal/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "This link could not be verified.");
        return;
      }
      router.replace(`/portal/${tenant}`);
    })();
  }, [tenant, token, router]);

  if (error) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
        <Link href={`/portal/${tenant}/login`} className="text-sm text-ice underline">
          Request a new link
        </Link>
      </div>
    );
  }
  return <p className="text-sm text-muted">Signing you in…</p>;
}
