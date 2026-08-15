import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth callback route. The app uses anonymous sign-in via the
 * `ensureUser` server helper, so this is just a safety net for
 * any future OAuth provider redirects. It returns the user to
 * the dashboard with no error.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
