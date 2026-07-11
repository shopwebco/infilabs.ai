import { NextResponse } from "next/server";

/**
 * Maps a thrown error carrying a numeric `status` (ForbiddenError, NotFoundError,
 * PlanRequiredError, etc.) to a JSON response. Rethrows anything unexpected so it
 * surfaces as a 500 rather than being swallowed.
 */
export function errorResponse(err: unknown): NextResponse {
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    const status = (err as { status: number }).status;
    const message =
      err instanceof Error ? err.message : "Request could not be completed.";
    return NextResponse.json({ error: message }, { status });
  }
  throw err;
}
