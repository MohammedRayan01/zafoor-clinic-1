import { NextResponse, type NextRequest } from "next/server"

// Lightweight presence check only — middleware runs on the Edge runtime and
// can't reach Postgres, so it can't validate the session against the DB
// (expiry, revocation). Every server action and page still calls
// `getCurrentUser()` from src/lib/auth.ts, which does the real DB-backed
// check; this middleware exists purely to bounce obviously-signed-out
// visitors to /login before any page code runs.
const SESSION_COOKIE = "zafoor_session"
const PUBLIC_PATHS = ["/login"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // The public website API (/api/public/*) is intentionally unauthenticated —
  // never bounce it to /login. The matcher below already excludes /api, but
  // this guard keeps the exemption explicit if the matcher ever changes.
  if (pathname.startsWith("/api/public")) {
    return NextResponse.next()
  }

  const hasSession = request.cookies.has(SESSION_COOKIE)

  if (PUBLIC_PATHS.includes(pathname)) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return NextResponse.next()
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads).*)"],
}
