import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PORTAL_COOKIE } from "@/lib/portal/session";

export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  store.delete(PORTAL_COOKIE);
  return NextResponse.json({ ok: true }, { status: 200 });
}
