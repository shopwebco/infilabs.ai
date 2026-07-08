import type { WorkspaceRole } from "@prisma/client";

// ADMIN > MANAGER > STAFF (docs/PRODUCT_SPEC.md §2).
export const ROLE_RANK: Record<WorkspaceRole, number> = {
  STAFF: 1,
  MANAGER: 2,
  ADMIN: 3,
};

/** True when `role` is at least as privileged as `min`. */
export function hasRole(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** 403 — authenticated but not permitted. Enforced server-side; UI hiding is never a substitute. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** 404 — resource does not exist, or is outside the caller's tenant (do not leak which). */
export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}
