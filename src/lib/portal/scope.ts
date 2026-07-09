import { cookies } from "next/headers";
import { PORTAL_COOKIE, verifyPortalSessionValue } from "./session";
import { ForbiddenError } from "@/lib/auth/rbac";

export async function getPortalSession() {
  const store = await cookies();
  return verifyPortalSessionValue(store.get(PORTAL_COOKIE)?.value);
}

/**
 * Client-portal scope guard: the session's clientProjectId must equal the
 * requested project. Cross-tenant access is a hard 403 — a portal user can only
 * ever read their own project's data (invariant 1 / PRODUCT_SPEC §2).
 */
export async function requireClientScope(clientProjectId: string) {
  const session = await getPortalSession();
  if (!session || session.clientProjectId !== clientProjectId) {
    throw new ForbiddenError("You are not authorized for this portal.");
  }
  return session;
}
