import { NextResponse, type NextRequest } from "next/server";

function appHostname(): string {
  try {
    return new URL(process.env.APP_URL ?? "http://localhost:3000").hostname;
  } catch {
    return "localhost";
  }
}

/**
 * Custom-domain resolution (docs/ARCHITECTURE.md §3). The middleware runs on the
 * edge and cannot touch the DB, so it only inspects the Host header: requests on
 * a non-app host are rewritten under /d/<host>, where a Node server component
 * resolves the host → workspace via WhiteLabelSettings.customDomain.
 */
export function middleware(req: NextRequest) {
  const host = ((req.headers.get("host") ?? "").split(":")[0] ?? "").toLowerCase();
  const app = appHostname();
  const isAppHost =
    host === "" ||
    host === app ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app");

  const { pathname } = req.nextUrl;
  if (
    !isAppHost &&
    !pathname.startsWith("/d/") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = `/d/${host}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
