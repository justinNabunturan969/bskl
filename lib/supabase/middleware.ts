import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { nodeHttpsFetch } from "./fetch";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
      global: {
        // Bypass the broken global fetch — see lib/supabase/fetch.ts.
        fetch: nodeHttpsFetch,
      },
    }
  );

  // Read current user (if any). Don't create a new session here —
  // the save action and other server actions call `ensureUser` which
  // handles anonymous sign-in. If the middleware created a session too,
  // each request could end up with a different anonymous user_id, and
  // queries like `recordings.user_id = user.id` would miss rows.
  try {
    const { data } = await supabase.auth.getUser();
    // Touch the user so TS doesn't warn about unused var; nothing to do.
    void data.user;
  } catch {
    // No session / Supabase unreachable — let the request through; the
    // page or action will handle the null user.
  }

  // No redirects. Anyone can access any page; the page itself decides
  // what to render when there's no user.
  return response;
}